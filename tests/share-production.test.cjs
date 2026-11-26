// Run: node --test tests/share-production.test.cjs
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const check=require('../cat-production-check.js'),renderer=require('../studio-render.js');
const apiSource=fs.readFileSync(path.join(__dirname,'../api/studio.js'),'utf8');
const ranges=JSON.parse(apiSource.match(/const GEOMETRY_RANGES=(.*);/)[1]),geometry={};
for(const [k,[a,b]] of Object.entries(ranges)){const p=k.split('.'),v=(a+b)/2;if(p.length===1)geometry[p[0]]=v;else(geometry[p[0]]??={})[p[1]]=v}
const palette=[{id:'cream',name:'白',hex:'#F6EFE0',code:'TEST01',enabled:true},{id:'blue',name:'藍',hex:'#889AA8',code:'TEST02',enabled:true},{id:'dark',name:'深色',hex:'#443A37',code:'TEST03',enabled:true}];
const zones=Object.fromEntries(['leftEar','rightEar','leftForehead','rightForehead','centerForehead','leftCheek','rightCheek','muzzle'].map(k=>[k,0]));
const blank={mode:1,cols:['cream','cream','cream'],zones,join:'meet',finish:'solid',muzzle:0,stripe:0,drawing:[]};
const design={format:'MILUBANBAN-CAT-DESIGN-V4',version:4,same:true,left:blank,right:blank,palette,geometry};
const fine={...blank,drawing:[{tool:'brush',color:'blue',width:1,points:[[40,45],[50,55]]},{tool:'shape',color:'dark',width:1,points:[[40,40],[41,40],[41,42]]},{tool:'erase',color:'cream',width:4,points:[[40,45],[50,55]]}]};
test('plain pair has no obvious preliminary warning',()=>{const r=check.analyze(design);assert.equal(r.review,false);assert.equal(r.ears[0].colors.length,1)});
test('asymmetric thin strokes and small shapes flagged; eraser not counted as paint',()=>{const r=check.analyze({...design,same:false,right:fine});assert.equal(r.ears[0].flags.length,0);assert.equal(r.ears[1].thin,1);assert.equal(r.ears[1].small,1);assert.equal(r.ears[1].erased,1);assert.equal(r.ears[1].strokes,2);assert.equal(r.review,true)});
test('automatic tabby pigment included and soft gradient reviewed',()=>{const left={...blank,mode:2,cols:['cream','blue','cream'],finish:'soft',stripe:1,muzzle:1};const r=check.analyze({...design,left});assert.ok(r.ears[0].gradient);assert.ok(r.ears[0].colors.some(p=>p.id==='dark'));assert.ok(r.ears[0].flags.includes('虎斑細節需確認'))});
test('studio texture uses editor UV dimensions, erase mask, and separate ear colors',()=>{const r=renderer.create({...design,same:false,left:fine,right:{...blank,cols:['blue','blue','blue']}});const l=r.texture('left'),rr=r.texture('right');assert.ok(l.svg.includes('viewBox="0 0 140 130"'));assert.ok(l.svg.includes('mask="url(#faceerase2)"'));assert.notEqual(l.color,rr.color);assert.ok(!l.svg.includes('url(#gold)'));assert.notEqual(l.svg,rr.svg)});
test('synchronized ears use the same original artwork',()=>{const r=renderer.create({...design,left:fine});assert.deepEqual(r.texture('left'),r.texture('right'))});
