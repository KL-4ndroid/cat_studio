const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const src=fs.readFileSync(path.join(__dirname,'../api/studio.js'),'utf8'),actor='11111111-1111-4111-8111-111111111111',version='22222222-2222-4222-8222-222222222222';
const p={id:'cat_test',name:'三花',layout:'split',colors:['#FFFFFF','#000000'],enabled:true};
async function request(action,{method='GET',body,role='owner',anonymous=false,missing=false,conflict=false}={}){
 const calls=[],env={SUPABASE_URL:'https://test.supabase.co',SUPABASE_ANON_KEY:'anon',SUPABASE_SERVICE_ROLE_KEY:'service',STUDIO_RATE_SECRET:'12345678901234567890123456789012'};
 const row={revision:2,presets:[p,{...p,id:'hidden',enabled:false}],created_at:'2026-11-27T00:00:00Z'};
 const mock=async(url,opts)=>{calls.push({url,opts});const resp=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});
 if(url.includes('/auth/v1/user'))return resp({id:actor});
 if(url.includes('/studio_members?'))return resp([{role,active:true}]);
 if(url.includes('/studio_preset_versions?'))return missing?resp({code:'PGRST205'},404):resp([row]);
 if(url.includes('/studio_config?'))return resp([{active_version:version}]);
 if(url.includes('/studio_palette_versions?'))return resp([{id:version,palette:[{id:'white',name:'白',hex:'#FFFFFF',code:'PRIVATE',enabled:true},{id:'black',name:'黑',hex:'#000000',enabled:true}]}]);
 if(url.endsWith('/rpc/studio_publish_presets'))return conflict?resp({message:'preset_version_conflict'},400):resp({configured:true,revision:3,presets:JSON.parse(opts.body).p_presets});
 throw Error('unexpected '+url)};
 const m={exports:{}};new Function('require','module','process','fetch','AbortSignal','Buffer',src)(require,m,{env},mock,{timeout:()=>undefined},Buffer);
 let status,data;const res={setHeader(){},status(n){status=n;return this},json(v){data=v;return v}};await m.exports({method,query:{action},headers:anonymous?{}:{authorization:'Bearer abc'},body},res);return {status,data,calls};
}
const draft={revision:2,paletteVersion:version,presets:[p]};
test('public preset endpoint returns only enabled rows, no pigment codes, and missing schema fallback',async()=>{const r=await request('presets',{anonymous:true});assert.equal(r.status,200);assert.deepEqual(r.data.presets,[p]);assert.equal(r.calls.length,1);assert.equal((await request('presets',{anonymous:true,missing:true})).data.configured,false)});
test('admin preset endpoint restricts staff and anonymous and strips private pigment codes',async()=>{assert.equal((await request('presets-admin',{role:'staff'})).status,403);assert.equal((await request('presets-admin',{anonymous:true})).status,401);const r=await request('presets-admin');assert.equal(r.data.presets.length,2);assert.equal('code' in r.data.palette[0],false)});
test('publishing validates current palette, owner, and expected revision',async()=>{for(const [body,status] of [[{...draft,revision:1},409],[{...draft,paletteVersion:actor},409],[{...draft,presets:[{...p,colors:['#FF0000','#000000']}]},400],[{...draft,presets:[{...p,extra:1}]},400]])assert.equal((await request('publish-presets',{method:'POST',body})).status,status);assert.equal((await request('publish-presets',{method:'POST',body:draft,role:'staff'})).status,403);assert.equal((await request('publish-presets',{method:'POST',body:draft,conflict:true})).status,409);assert.equal((await request('publish-presets',{method:'POST',body:draft,missing:true})).status,503);const ok=await request('publish-presets',{method:'POST',body:draft});assert.equal(ok.status,200);assert.equal(ok.data.revision,3);assert.deepEqual(JSON.parse(ok.calls.find(x=>x.url.endsWith('/rpc/studio_publish_presets')).opts.body),{p_actor:actor,p_expected:2,p_presets:[p]})});
