// Vercel Node serverless endpoint. Private keys are used here only.
const {createHash,createHmac}=require('node:crypto');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ID=/^[A-Za-z0-9_-]{1,48}$/;
const ZONES=['leftEar','rightEar','leftForehead','rightForehead','centerForehead','leftCheek','rightCheek','muzzle'];
const STATUSES=['待確認','等待製作','製作中','品質檢查','已完成'];
const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
const str=(v,max)=>typeof v==='string'&&v.length<=max;
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const canonical=v=>Array.isArray(v)?'['+v.map(canonical).join(',')+']':object(v)?'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}':JSON.stringify(v);
function config(){
 const url=process.env.SUPABASE_URL,anon=process.env.SUPABASE_ANON_KEY,service=process.env.SUPABASE_SERVICE_ROLE_KEY,salt=process.env.STUDIO_RATE_SECRET;
 if(!url||!anon||!service||!salt||salt.length<32)fail(503,'雲端工作室尚未設定');
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url.replace(/\/$/,'')))fail(503,'資料庫網址設定不符');
 return {url:url.replace(/\/$/,''),anon,service,salt};
}
async function call(c,path,{method='GET',token=c.service,apikey=c.service,body}={}){
 const r=await fetch(c.url+path,{method,headers:{apikey,Authorization:'Bearer '+token,'Content-Type':'application/json',Accept:'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(12000)});
 let data;try{data=await r.json()}catch(_){data=null}
 if(!r.ok){
  const m=String(data?.message||data?.error_description||'');
  if(m.includes('version_conflict'))fail(409,'製作單已由其他裝置更新，請重新載入');
  if(m.includes('request_conflict'))fail(409,'送出識別碼已使用，請重新整理後再送');
  if(m.includes('palette_changed'))fail(409,'色票已有新版，請重新開始或下載作品與工作室聯絡');
  if(m.includes('rate_limited'))fail(429,'送出次數過多，請稍後再試');
  if(r.status===401||r.status===403||m.includes('forbidden'))fail(403,'沒有此操作權限，請重新登入');
  fail(502,'資料庫操作未完成');
 }
 return data;
}
const pub=p=>p.filter(x=>x.enabled!==false).map(x=>({id:x.id,name:x.name,hex:x.hex,enabled:true}));
function validatePalette(p){
 if(!Array.isArray(p)||p.length<1||p.length>100||!p.some(x=>x?.enabled!==false))fail(400,'顏料數量或啟用狀態不符');
 const ids=new Set(),codes=new Set();
 return p.map(x=>{if(!object(x)||!ID.test(x.id||'')||ids.has(x.id)||!str(x.name,30)||!x.name.trim()||!/^#[0-9a-f]{6}$/i.test(x.hex||'')||!str(x.code??'',40)||typeof (x.enabled??true)!=='boolean')fail(400,'顏料格式不符');const code=(x.code||'').trim();if(x.enabled!==false&&!code)fail(400,'每種啟用顏料都必須填入實體編號');if(code&&codes.has(code))fail(400,'顏料編號重複');ids.add(x.id);if(code)codes.add(code);return {id:x.id,name:x.name.trim(),hex:x.hex.toUpperCase(),code,enabled:x.enabled!==false}});
}
function geometry(v){
 let count=0;function visit(x,depth){if(++count>300||depth>6)fail(400,'版型資料過大');if(typeof x==='number'&&Number.isFinite(x)&&Math.abs(x)<=10000)return x;if(!object(x))fail(400,'版型須為數值物件');const out=Object.create(null);for(const [k,y] of Object.entries(x)){if(!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(k)||['constructor','prototype','__proto__'].includes(k))fail(400,'版型欄位不符');out[k]=visit(y,depth+1)}return out}
 if(!object(v)||Object.keys(v).length===0)fail(400,'缺少版型');return visit(v,0);
}
function cleanState(st,ids){
 if(!object(st)||![1,2,3].includes(st.mode)||!Array.isArray(st.cols)||st.cols.length!==3||!st.cols.every(x=>ids.has(x))||!object(st.zones)||!ZONES.every(k=>[0,1,2].includes(st.zones[k]))||!['meet','bridge','gap'].includes(st.join)||!['solid','soft'].includes(st.finish)||![0,1,2].includes(st.muzzle)||![0,1,2].includes(st.stripe))fail(400,'耳環配色資料不符');
 const ops=st.drawing??[];if(!Array.isArray(ops)||ops.length>120)fail(400,'筆畫數超出限制');
 const drawing=ops.map(o=>{if(!object(o)||!['brush','shape','erase'].includes(o.tool)||!ids.has(o.color)||!Number.isFinite(o.width)||o.width<2||o.width>24||!Array.isArray(o.points)||o.points.length<1||o.points.length>8192||!o.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=-100&&n<=240)))fail(400,'筆畫格式不符');return {tool:o.tool,color:o.color,width:o.width,points:o.points}});
 return {name:str(st.name,80)?st.name:'我的自由手繪',mode:st.mode,cols:st.cols,zones:Object.fromEntries(ZONES.map(k=>[k,st.zones[k]])),join:st.join,finish:st.finish,muzzle:st.muzzle,stripe:st.stripe,drawing};
}
function cleanDesign(d,version){
 if(!object(d)||d.format!=='MILUBANBAN-CAT-DESIGN-V4'||d.version!==4||typeof d.same!=='boolean'||!Array.isArray(d.palette))fail(400,'作品格式不符');
 const p=pub(version.palette),ids=new Set(p.map(x=>x.id));
 const submitted=d.palette.filter(x=>x?.enabled!==false).map(x=>({id:x.id,name:x.name,hex:x.hex,enabled:true}));
 if(canonical(submitted)!==canonical(p)||canonical(d.geometry)!==canonical(version.geometry))fail(409,'作品使用不同色票或版型，請下載設計檔另行確認');
 const left=cleanState(d.left,ids),right=d.same?left:cleanState(d.right,ids);
 // Ignore client-provided codes, productionColors, specification, receipt and status.
 return {format:'MILUBANBAN-CAT-DESIGN-V4',version:4,revision:'5.0',same:d.same,left,right,geometry:version.geometry,palette:version.palette.filter(x=>x.enabled!==false),title:str(d.title,40)?d.title:'未命名貓咪',code:str(d.code,64)?d.code:''};
}
async function activeVersion(c){
 const rows=await call(c,'/rest/v1/studio_config?singleton=eq.true&select=active_version');
 if(!rows?.length)fail(503,'工作室尚未發布實體色票');
 return rows[0].active_version;
}
async function versionById(c,id){if(!UUID.test(id||''))fail(400,'色票版本不符');const rows=await call(c,'/rest/v1/studio_palette_versions?id=eq.'+id+'&select=id,palette,geometry');if(!rows?.length)fail(409,'色票版本不存在');return rows[0]}
async function staff(c,req){
 const token=(req.headers.authorization||'').match(/^Bearer ([A-Za-z0-9._-]+)$/)?.[1];if(!token)fail(401,'請先登入');
 const user=await call(c,'/auth/v1/user',{apikey:c.anon,token});
 if(!UUID.test(user?.id||''))fail(401,'登入狀態已失效');
 const members=await call(c,'/rest/v1/studio_members?user_id=eq.'+user.id+'&select=role,active',{apikey:c.anon,token});
 if(!members?.[0]?.active||!['owner','staff'].includes(members[0].role))fail(403,'此帳號沒有工作室權限');
 return {id:user.id,role:members[0].role,token};
}
function payload(req){
 let b=req.body;if(typeof b==='string'){if(Buffer.byteLength(b)>950000)fail(413,'作品檔過大，請下載檔案聯絡工作室');try{b=JSON.parse(b)}catch(_){fail(400,'資料格式不符')}}
 if(!object(b))fail(400,'資料格式不符');if(Buffer.byteLength(JSON.stringify(b))>950000)fail(413,'作品檔過大，請下載檔案聯絡工作室');return b;
}
async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 try{
  const c=config(),action=String(req.query?.action||'');
  if(req.method==='GET'&&action==='palette'){const v=await versionById(c,await activeVersion(c));return res.status(200).json({version:v.id,palette:pub(v.palette),geometry:v.geometry})}
  if(req.method==='POST'&&action==='submit'){
   const b=payload(req);if(!UUID.test(b.requestId||''))fail(400,'送出識別碼不符');const v=await versionById(c,b.version),design=cleanDesign(b.design,v);
   const hash=createHash('sha256').update(canonical({version:v.id,design})).digest('hex');
   const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-real-ip']||'unknown').split(',')[0].trim();
   const bucket=createHmac('sha256',c.salt).update(ip).digest('hex');
   const receipt=await call(c,'/rest/v1/rpc/studio_submit',{method:'POST',body:{p_request:b.requestId,p_hash:hash,p_version:v.id,p_design:design,p_bucket:bucket}});
   return res.status(200).json(receipt);
  }
  if(req.method==='POST'&&action==='login'){
   const b=payload(req);if(!str(b.email,254)||!str(b.password,256))fail(400,'登入資料不符');
   const session=await call(c,'/auth/v1/token?grant_type=password',{method:'POST',apikey:c.anon,token:c.anon,body:{email:b.email,password:b.password}});
   if(!session?.access_token)fail(401,'登入失敗');
   const a=await staff(c,{headers:{authorization:'Bearer '+session.access_token}});
   return res.status(200).json({accessToken:session.access_token,role:a.role,expiresIn:session.expires_in});
  }
  const a=await staff(c,req),user={apikey:c.anon,token:a.token};
  if(req.method==='GET'&&action==='orders'){
   const offset=Math.max(0,Math.min(100000,Number.parseInt(req.query?.offset,10)||0));
   const rows=await call(c,'/rest/v1/studio_orders?select=id,receipt,status,ref,assignee,due,qc,revision,created_at,updated_at&order=created_at.desc,id.desc&limit=50&offset='+offset,user);
   return res.status(200).json({orders:rows,next:rows.length===50?offset+50:null});
  }
  if(req.method==='GET'&&action==='order'){
   const id=String(req.query?.id||'');if(!UUID.test(id))fail(400,'訂單識別碼不符');const rows=await call(c,'/rest/v1/studio_orders?id=eq.'+id+'&select=id,receipt,status,ref,note,assignee,due,checks,qc,revision,design,created_at,updated_at',user);if(!rows?.length)fail(404,'找不到製作單');return res.status(200).json(rows[0]);
  }
  if(req.method==='POST'&&action==='update'){
   const b=payload(req);if(!UUID.test(b.id||'')||!Number.isInteger(b.revision)||b.revision<1||!STATUSES.includes(b.status)||!str(b.ref,80)||!str(b.note,3000)||!str(b.assignee,60)||typeof b.qc!=='boolean'||b.status==='已完成'&&!b.qc||!(b.due===null||/^\d{4}-\d{2}-\d{2}$/.test(b.due||'')))fail(400,'製作單資料不符');
   if(!object(b.checks)||!['left','right'].every(k=>Array.isArray(b.checks[k])&&b.checks[k].length<=100&&b.checks[k].every(x=>ID.test(x))))fail(400,'上色勾選資料不符');
   const row=await call(c,'/rest/v1/rpc/studio_update_order',{...user,method:'POST',body:{p_id:b.id,p_expected:b.revision,p_status:b.status,p_ref:b.ref,p_note:b.note,p_assignee:b.assignee,p_due:b.due,p_checks:b.checks,p_qc:b.qc}});
   return res.status(200).json({id:row.id,revision:row.revision,status:row.status});
  }
  if(req.method==='POST'&&action==='publish'){
   if(a.role!=='owner')fail(403,'只有工作室管理者可以發布色票');const b=payload(req),p=validatePalette(b.palette),g=geometry(b.geometry);
   const version=await call(c,'/rest/v1/rpc/studio_publish',{method:'POST',body:{p_actor:a.id,p_palette:p,p_geometry:g}});
   return res.status(200).json({version});
  }
  if(req.method==='POST'&&action==='logout'){await call(c,'/auth/v1/logout',{...user,method:'POST'});return res.status(200).json({ok:true})}
  fail(404,'找不到功能');
 }catch(e){return res.status(e.status||500).json({error:e.status?e.message:'雲端操作未完成，請稍後再試'})}
}
module.exports=handler;
