const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../cat-preview-3d.js'),'utf8');
function harness(){
 const draws=[],deleted=[],listeners={},frames=new Map();let counter=0,view,angle,base,texture,hardware,zoom,lost=0,copies=0;
 const gl=new Proxy({NO_ERROR:0,getError:()=>0,isContextLost:()=>false,getShaderParameter:()=>true,getProgramParameter:()=>true,getUniformLocation:(_,name)=>name,
 createTexture:()=>({texture:++counter}),createProgram:()=>({}),createShader:()=>({}),createBuffer:()=>({}),createVertexArray:()=>({}),
 viewport:(...a)=>{view=a},uniform2f:(n,...a)=>{if(n==='angle')angle=a},uniform1f:(n,a)=>{if(n==='zoom')zoom=a},uniform3fv:(n,a)=>{if(n==='base')base=[...a]},uniform1i:(n,a)=>{if(n==='hardware')hardware=a},
 bindTexture:(_,t)=>{texture=t},drawElements:()=>draws.push({view:[...view],angle:[...angle],base:[...base],texture:texture.texture,hardware,zoom}),
 deleteTexture:t=>deleted.push(t.texture),getExtension:()=>({loseContext(){lost++}})}, {get:(t,k)=>k in t?t[k]:()=>{}});
 const canvas={width:0,height:0,clientWidth:401,clientHeight:300,getContext:()=>gl,addEventListener:(n,f)=>{listeners[n]=f},getBoundingClientRect:()=>({left:0,width:401}),setPointerCapture(){}};
 const doc={createElement:()=>({width:0,height:0,getContext:()=>({drawImage(){copies++}})})};
 const request=f=>{const id=++counter;frames.set(id,f);return id},cancel=id=>frames.delete(id);
 const parts=[0,1].map(()=>({position:new Float32Array(9),normal:new Float32Array(9),uv:new Float32Array(6),indices:new Uint16Array([0,1,2])}));
 const src=source.replaceAll('export function ','function ').replace('import.meta.url',"'https://example.invalid/preview.js'")+'\nloadModel=async()=>parts;decodeArtwork=async svg=>({svg});return {createPreview,previewRects};';
 const mod=new Function('document','requestAnimationFrame','cancelAnimationFrame','ResizeObserver','AbortController','parts',src)(doc,request,cancel,class{observe(){}disconnect(){}},class{constructor(){this.signal={}}abort(){}},parts);
 const api=mod.createPreview(canvas,()=>{},{fixedSize:[401,300]});
 const key=k=>listeners.keydown({key:k,preventDefault(){}});
 function capture(){draws.length=0;const out=api.capture();return {draws:draws.slice(),out}}
 return {mod,api,key,capture,deleted,stats:()=>({lost,copies})};
}
const artworks=[{svg:'left',color:'#FF0000'},{svg:'right',color:'#0000FF'}];
test('pair viewports cover odd-width surface and single mode preserves full view',()=>{const {mod,api}=harness();assert.deepEqual(mod.previewRects(401,300,true),[[0,0,200,300],[200,0,201,300]]);assert.deepEqual(mod.previewRects(401,300,false),[[0,0,401,300]]);api.dispose()});
test('pair uses independent textures and correct enamel/hardware dispatch',async()=>{const h=harness();await h.api.setArtworks(artworks);const {draws,out}=h.capture();assert.equal(draws.length,4);assert.deepEqual(draws.map(d=>d.hardware),[0,1,0,1]);assert.deepEqual(draws[0].base,[1,0,0]);assert.deepEqual(draws[2].base,[0,0,1]);assert.notEqual(draws[0].texture,draws[2].texture);assert.equal(draws[0].texture,draws[1].texture);assert.equal(out.width,401);assert.equal(out.height,300);assert.equal(h.stats().copies,1);h.api.dispose()});
test('linked and independent rotation, zoom and reset affect intended ear',async()=>{const h=harness();await h.api.setArtworks(artworks);h.key('ArrowRight');let d=h.capture().draws;assert.deepEqual(d[0].angle,d[2].angle);h.api.setLinked(false);h.api.setActive(1);h.key('ArrowRight');h.key('+');d=h.capture().draws;assert.equal(d[0].angle[0],.15);assert.equal(d[2].angle[0],.3);assert.equal(d[0].zoom,1);assert.equal(d[2].zoom,1.1);h.api.setLinked(true);d=h.capture().draws;assert.deepEqual(d[0].angle,d[2].angle);h.api.reset();d=h.capture().draws;assert.deepEqual(d[0].angle,[0,0]);assert.equal(d[2].zoom,1);h.api.dispose()});
test('legacy STUDIO single setArtwork still works after pair and releases GPU once',async()=>{const h=harness();await h.api.setArtworks(artworks);await h.api.setArtwork('right','#0000FF');const d=h.capture().draws;assert.equal(d.length,2);assert.deepEqual(d[0].base,[0,0,1]);assert.deepEqual(d[0].view,[0,0,401,300]);h.api.dispose();h.api.dispose();assert.equal(h.deleted.length,2);assert.equal(h.stats().lost,1);assert.throws(()=>h.api.capture())});
test('out-of-order artwork changes keep latest selection',async()=>{const h=harness();await Promise.all([h.api.setArtworks(artworks),h.api.setArtwork('new','#00FF00')]);const d=h.capture().draws;assert.equal(d.length,2);assert.deepEqual(d[0].base,[0,1,0]);h.api.dispose()});
