// node --test tests/production-work.test.cjs
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../api/studio.js'),'utf8');
const actor='11111111-1111-4111-8111-111111111111',order='22222222-2222-4222-8222-222222222222',session='33333333-3333-4333-8333-333333333333';
async function request(action,{method='GET',query={},body,role='staff',anonymous=false,missing=false,conflict='',active=true}={}){
 const calls=[],env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',STUDIO_RATE_SECRET:'12345678901234567890123456789012'};
 const mock=async(url,opts)=>{calls.push({url,opts});const resp=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
 if(url.includes('/auth/v1/user'))return resp({id:actor});
 if(url.includes('/studio_members?'))return resp([{role,active}]);
 if(url.includes('/rpc/studio_work_')){if(missing)return resp({code:'PGRST202'},404);if(conflict)return resp({message:conflict},400);
 return url.endsWith('snapshot')?resp({configured:true,active:null,ownDaily:{seconds:0},teamDaily:role==='owner'?{seconds:0}:null}):resp({id:session,revision:1,state:'running'})}
 throw Error('unexpected URL '+url)};
 const m={exports:{}};new Function('require','module','process','fetch','AbortSignal','Buffer',source)(require,m,{env},mock,{timeout:()=>undefined},Buffer);
 let status,data;const res={setHeader(){},status(n){status=n;return this},json(v){data=v;return v}};
 await m.exports({method,query:{action,...query},headers:anonymous?{}:{authorization:'Bearer abc'},body},res);return {status,data,calls};
}
const start={command:'start',orderId:order,sessionId:session,revision:0,phase:'上色'};
test('work endpoints require active staff authentication',async()=>{for(const [action,method] of [['work','GET'],['work-command','POST']]){assert.equal((await request(action,{method,anonymous:true,body:start})).status,401);assert.equal((await request(action,{method,active:false,body:start})).status,403)}});
test('snapshot sends authenticated actor and validated date; absent schema remains disabled',async()=>{const r=await request('work',{query:{id:order,day:'2026-11-27'}});assert.equal(r.status,200);const rpc=r.calls.find(x=>x.url.endsWith('snapshot'));assert.deepEqual(JSON.parse(rpc.opts.body),{p_actor:actor,p_order:order,p_day:'2026-11-27'});assert.equal((await request('work',{query:{day:'2026-02-30'}})).status,400);assert.equal((await request('work',{missing:true})).data.configured,false)});
test('start ignores client actor and timestamps, validates command and phase',async()=>{const r=await request('work-command',{method:'POST',body:{...start,workerId:'fake',startedAt:'fake'}});assert.equal(r.status,200);const rpc=r.calls.find(x=>x.url.endsWith('command'));assert.deepEqual(JSON.parse(rpc.opts.body),{p_actor:actor,p_order:order,p_session:session,p_expected:0,p_action:'start',p_phase:'上色'});for(const b of [{...start,phase:'invalid'},{...start,revision:1},{...start,sessionId:'bad'},{...start,command:'finish',revision:0}])assert.equal((await request('work-command',{method:'POST',body:b})).status,400)});
test('pause, resume, finish use expected revision and never client elapsed time',async()=>{for(const command of ['pause','resume','finish']){const r=await request('work-command',{method:'POST',body:{command,orderId:order,sessionId:session,revision:2,seconds:9999}});assert.equal(r.status,200);const b=JSON.parse(r.calls.find(x=>x.url.endsWith('command')).opts.body);assert.equal(b.p_expected,2);assert.equal(b.p_action,command);assert.equal(b.p_phase,null);assert.equal('seconds' in b,false)}});
test('conflicts, wrong owner and missing schema fail safely',async()=>{for(const conflict of ['work_conflict','work_already_open','work_order_not_ready'])assert.equal((await request('work-command',{method:'POST',body:start,conflict})).status,409);assert.equal((await request('work-command',{method:'POST',body:start,conflict:'forbidden'})).status,403);assert.equal((await request('work-command',{method:'POST',body:start,missing:true})).status,503)});
