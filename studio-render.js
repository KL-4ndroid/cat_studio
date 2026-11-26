/* Shared production renderer extracted from V4.7.2; no localStorage or network. */
(function(root){'use strict';
function create(design){
const ranges={"top.x":[51,89],"top.y":[19,36],"mid.x":[52,89],"mid.y":[36,56],"bottom.x":[52,90],"bottom.y":[52,77],"seamWave":[0,13],"gapWidth":[0,23],"bridgeWidth":[3,24],"leftInner.x":[38,65],"leftInner.y":[49,83],"leftOuter.x":[18,39],"leftOuter.y":[50,86],"rightInner.x":[80,108],"rightInner.y":[49,83],"rightOuter.x":[106,124],"rightOuter.y":[50,86],"leftEarDepth":[30,67],"rightEarDepth":[30,67],"leftCheek.x":[25,54],"leftCheek.y":[73,105],"leftCheek.rx":[0,26],"leftCheek.ry":[0,26],"rightCheek.x":[87,116],"rightCheek.y":[73,105],"rightCheek.rx":[0,26],"rightCheek.ry":[0,26],"muzzle.x":[52,88],"muzzle.y":[64,95],"muzzle.rx":[8,47],"muzzle.ry":[8,38],"softness":[1,9],"stripeY":[26,42],"stripeLength":[4,18],"stripeSpread":[5,16],"stripeWidth":[1,5]};
const g=design.geometry, palette=design.palette;
if(!Array.isArray(palette)||!palette.length||palette.length>100||palette.some(p=>!p||!/^#[0-9a-f]{6}$/i.test(p.hex)||!(/^[A-Za-z0-9_-]{1,48}$/).test(p.id)))throw Error('製作色票格式錯誤');
for(const [k,[min,max]] of Object.entries(ranges)){const v=k.split('.').reduce((x,y)=>x?.[y],g);if(!Number.isFinite(v)||v<min||v>max)throw Error('版型參數錯誤')}
const ids=new Set(palette.map(p=>p.id)), zoneKeys=['leftEar','rightEar','leftForehead','rightForehead','centerForehead','leftCheek','rightCheek','muzzle'];
for(const st of [design.left,design.same?design.left:design.right]){if(!st||![1,2,3].includes(st.mode)||!Array.isArray(st.cols)||st.cols.length!==3||!st.cols.every(x=>ids.has(x))||!zoneKeys.every(k=>[0,1,2].includes(st.zones?.[k]))||!['meet','bridge','gap'].includes(st.join)||!['solid','soft'].includes(st.finish)||![0,1,2].includes(st.muzzle)||![0,1,2].includes(st.stripe))throw Error('設計格式錯誤');const ops=st.drawing||[];if(!Array.isArray(ops)||ops.length>120||!ops.every(o=>o&&['brush','shape','erase'].includes(o.tool)&&ids.has(o.color)&&Number.isFinite(o.width)&&o.width>=2&&o.width<=24&&Array.isArray(o.points)&&o.points.length>0&&o.points.length<=8192&&o.points.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=-100&&n<=240))))throw Error('筆畫格式錯誤')}
let state=design.left;
const gNow=()=>g,availablePalette=()=>palette.filter(p=>p.enabled!==false),colorData=id=>palette.find(p=>p.id===id)||palette[0];
const colAt=i=>colorData(state.cols[Math.max(0,Math.min(i,state.mode-1))]).hex;
const colorFor=k=>colAt(state.zones[k]);
function nearestColor(src){const a=availablePalette();const rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));const c=rgb(src);return a.slice().sort((x,y)=>{const d=p=>rgb(p.hex).reduce((t,v,i)=>t+(v-c[i])**2,0);return d(x)-d(y);})[0];}
function seamPath(g,reverse=false,offset=0){
 const a={x:g.top.x+offset,y:g.top.y},b={x:g.mid.x+offset,y:g.mid.y},c={x:g.bottom.x+offset,y:g.bottom.y},w=g.seamWave;
 if(!reverse)return `C ${a.x-w} ${a.y+10} ${b.x+w} ${b.y-10} ${b.x} ${b.y} C ${b.x-w} ${b.y+8} ${c.x+w} ${c.y-8} ${c.x} ${c.y}`;
 return `C ${c.x+w} ${c.y-8} ${b.x-w} ${b.y+8} ${b.x} ${b.y} C ${b.x+w} ${b.y-10} ${a.x-w} ${a.y+10} ${a.x} ${a.y}`;
}
function foreheadShapes(g,join){
 const delta=join==='gap'?g.gapWidth:0;
 const left=`M20 17 L${g.top.x-delta} ${g.top.y} ${seamPath(g,false,-delta)} C ${g.bottom.x-delta-8} ${g.bottom.y-6} ${g.leftInner.x+8} ${g.leftInner.y-6} ${g.leftInner.x} ${g.leftInner.y} Q ${g.leftOuter.x+13} ${g.leftOuter.y-6} ${g.leftOuter.x} ${g.leftOuter.y} L20 17Z`;
 const right=`M${g.top.x+delta} ${g.top.y} L122 17 L${g.rightOuter.x} ${g.rightOuter.y} Q ${g.rightOuter.x-13} ${g.rightOuter.y-6} ${g.rightInner.x} ${g.rightInner.y} C ${g.rightInner.x-9} ${g.rightInner.y-6} ${g.bottom.x+delta+8} ${g.bottom.y-6} ${g.bottom.x+delta} ${g.bottom.y} ${seamPath(g,true,delta)} Z`;
 // No seam gap in meet mode: both paths use exactly reverse-shared geometry.
 return [left,right];
}
function bridgeShape(g){const {top:a,mid:b,bottom:c}=g;const w=g.bridgeWidth;return `M${a.x-w} ${a.y} Q${b.x-w-2} ${b.y-8} ${c.x-w} ${c.y-5} Q${c.x} ${c.y+5} ${c.x+w} ${c.y-5} Q${b.x+w+2} ${b.y-8} ${a.x+w} ${a.y} Z`;}
function earShape(g,side){return side==='left'?`M20 9 Q37 6 53 12 L62 33 Q52 43 32 ${g.leftEarDepth} L20 ${g.leftEarDepth+3} Z`:`M88 11 Q101 4 122 8 L122 ${g.rightEarDepth+4} Q111 ${g.rightEarDepth-4} 94 42 L80 32 Z`}
function cheekShape(g,side){const a=side==='left'?g.leftCheek:g.rightCheek;return `<ellipse cx="${a.x}" cy="${a.y}" rx="${a.rx}" ry="${a.ry}" fill="${colorFor(side+'Cheek')}" />`;}
function tabbyShapes(g){const xs=[70-g.stripeSpread,70,70+g.stripeSpread];return xs.map((x,i)=>`M${x} ${g.stripeY} Q${x+(i===0?3:i===2?-3:0)} ${g.stripeY+g.stripeLength*.55} ${x+(i===0?4:i===2?-4:0)} ${g.stripeY+g.stripeLength}`);}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

// CAT6 front silhouette in the original 140 × 130 drawing coordinates.
const headPath='M39.3 16.0 Q40.1 15.7 41.2 15.9 Q42.3 16.0 46.9 18.4 Q51.5 20.7 53.3 23.5 Q55.0 26.3 56.0 26.7 Q57.0 27.1 62.8 26.1 Q68.5 25.0 76.6 26.0 Q84.7 27.0 92.6 24.0 Q100.5 21.0 102.1 21.0 Q103.8 20.9 105.4 21.7 Q107.0 22.5 107.6 23.7 Q108.3 24.9 109.4 31.2 Q110.5 37.6 113.2 46.0 Q115.9 54.4 116.2 56.8 Q116.6 59.2 115.4 68.7 Q114.2 78.1 113.3 80.7 Q112.5 83.2 111.1 85.1 Q109.7 87.0 105.5 90.5 Q101.3 93.9 96.9 96.6 Q92.4 99.3 86.2 100.7 Q80.0 102.0 69.8 102.0 Q59.5 102.0 54.6 101.3 Q49.7 100.6 46.5 99.2 Q43.2 97.9 39.3 94.6 Q35.4 91.2 32.8 87.6 Q30.3 83.9 29.3 80.8 Q28.3 77.7 27.6 68.2 Q26.9 58.8 28.0 52.2 Q29.1 45.5 30.9 40.7 Q32.6 35.9 33.2 30.7 Q33.7 25.4 35.0 22.1 Q36.4 18.8 37.5 17.5 Q38.6 16.2 39.3 16.0 Z';
function hexMix(a,b,t){const parse=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));const A=parse(a),B=parse(b);return '#'+A.map((x,i)=>Math.round(x*(1-t)+B[i]*t).toString(16).padStart(2,'0')).join('');}
function stripeColor(){const main=state.join==='bridge'?colorFor('centerForehead'):colorFor('leftForehead');return nearestColor(hexMix(main,'#2b211c',.65));}
function drawingMarkup(id,ops){let art='',defs='';for(let i=0;i<(ops||[]).length;i++){const o=ops[i];const pts=o.points;const d=pts.map((p,j)=>`${j?'L':'M'}${p[0]} ${p[1]}`).join(' ')+(o.tool==='shape'&&pts.length>=3?' Z':pts.length===1?' l.01 0':'');const color=colorData(o.color).hex;const stroke=`<path d="${d}" fill="${o.tool==='shape'&&pts.length>=3?color:'none'}" stroke="${color}" stroke-width="${o.tool==='shape'?0.5:o.width}" stroke-linecap="round" stroke-linejoin="round"/>`;if(o.tool==='erase'){const mid=id+'erase'+i;defs+=`<mask id="${mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="140" height="130"><rect width="140" height="130" fill="white"/><path d="${d}" fill="none" stroke="black" stroke-width="${o.width}" stroke-linecap="round" stroke-linejoin="round"/></mask>`;art=`<g mask="url(#${mid})">${art}</g>`;}else art+=stroke;}return `<defs>${defs}</defs>${art}`;}
function paintCat(id,x){
 let forehead='';
 const g=gNow();
 const [left,right]=foreheadShapes(g,state.join);
 if(state.finish==='soft'){
  // Ragdoll/point-cat: ear tips fade naturally into the base enamel color.
  forehead=`<g filter="url(#softMark)">
   <path d="M19 4 Q38 0 60 12 Q68 23 61 39 Q53 52 22 ${g.leftEarDepth+7} L19 4Z" fill="${colorFor('leftEar')}" opacity=".91"/>
   <path d="M82 12 Q104 0 124 4 L124 ${g.rightEarDepth+7} Q89 51 81 39 Q74 22 82 12Z" fill="${colorFor('rightEar')}" opacity=".91"/>
   <path d="${left}" fill="${colorFor('leftForehead')}" opacity=".29"/>
   <path d="${right}" fill="${colorFor('rightForehead')}" opacity=".29"/>
  </g>`;
 }else{
  forehead=`<path d="${earShape(g,"left")}" fill="${colorFor('leftEar')}"/>
  <path d="${earShape(g,"right")}" fill="${colorFor('rightEar')}"/>
  <path d="${left}" fill="${colorFor('leftForehead')}"/>
  <path d="${right}" fill="${colorFor('rightForehead')}"/>`;
 }
 if(state.join==='bridge'){
  forehead+=`<path d="${bridgeShape(g)}" fill="${colorFor('centerForehead')}" opacity="${state.finish==='soft'?.44:1}" ${state.finish==='soft'?'filter="url(#softMark)"':''}/>`;
 }
 const noseGradient=state.muzzle?`<ellipse cx="${g.muzzle.x}" cy="${g.muzzle.y}" rx="${g.muzzle.rx}" ry="${g.muzzle.ry}" fill="url(#${id}noseGrad)" filter="url(#noseSoft)" opacity="${state.muzzle===1?.72:1}"/>`:'';
 let stripes='';
 if(state.stripe){
  const stroke=stripeColor().hex;
  stripes=`<g stroke="${stroke}" stroke-width="${state.stripe===1?g.stripeWidth*.75:g.stripeWidth}" fill="none" stroke-linecap="round" opacity="${state.stripe===1?.46:.73}">${tabbyShapes(g).map(d=>`<path d="${d}"/>`).join('')}</g>`;
 }
 return `<g transform="translate(${x} 55) scale(1.38)">
  <ellipse cx="72" cy="120" rx="48" ry="5" fill="#6d695f" opacity=".075"/>
  <path d="M67 92 L67 110 Q67 119 73 119 Q79 119 79 109 L79 92" fill="url(#gold)" stroke="#b18843" stroke-width=".8"/>
  <path d="M69 104 L69 110 Q70 113 73 113" fill="none" stroke="#fff5bf" stroke-width="1.4" opacity=".65"/>
  <ellipse cx="71" cy="27" rx="14" ry="6.5" fill="none" stroke="#b68e50" stroke-width="5.3"/>
  <ellipse cx="71" cy="27" rx="14" ry="6.5" fill="none" stroke="url(#gold)" stroke-width="3.4"/>
  <defs><clipPath id="${id}clip"><path d="${headPath}"/></clipPath>
   <radialGradient id="${id}noseGrad" cx="50%" cy="46%" r="75%">
    <stop offset="0%" stop-color="${colorFor('muzzle')}" stop-opacity=".86"/>
    <stop offset="40%" stop-color="${colorFor('muzzle')}" stop-opacity=".58"/>
    <stop offset="72%" stop-color="${colorFor('muzzle')}" stop-opacity=".14"/>
    <stop offset="100%" stop-color="${colorFor('muzzle')}" stop-opacity="0"/>
   </radialGradient>
  </defs>
  <g filter="url(#shadow)">
   <path d="${headPath}" fill="${colAt(0)}"/>
   <g clip-path="url(#${id}clip)">
    ${forehead}
    ${state.finish==='solid'?`${cheekShape(g,"left")}${cheekShape(g,"right")}`:''}
    ${noseGradient}
    ${stripes}
    ${drawingMarkup(id,state.drawing)}
    <path d="M35 48 Q43 31 54 33" stroke="white" stroke-width="3.2" opacity=".30" fill="none" stroke-linecap="round"/>
    <path d="M88 32 Q98 35 105 48" stroke="white" stroke-width="2.5" opacity=".20" fill="none" stroke-linecap="round"/>
    <path d="M35 87 Q60 106 91 91" stroke="white" stroke-width="4.1" opacity=".17" fill="none" stroke-linecap="round"/>
    <path d="M28 60 Q24 83 42 94" stroke="#fff" stroke-width="2.5" opacity=".16" fill="none"/>
   </g>
   <path d="${headPath}" fill="none" stroke="#c6bfae" stroke-width=".75" opacity=".6"/>
   <circle cx="70" cy="67" r="5.5" fill="url(#gold)" stroke="#ae803e" stroke-width=".8"/>
   <ellipse cx="68.5" cy="65.3" rx="2.1" ry="1.2" fill="#fff0ba" opacity=".95"/>
  </g>
 </g>`;
}
function raw(ear,limit=-1){const st=ear==='right'&&!design.same?design.right:design.left;state={...st,drawing:limit>=0?(st.drawing||[]).slice(0,limit):st.drawing};return paintCat('cat',0)}
function render(ear,mode='normal',color='',limit=-1,prefix='studio50'){
 if(!['left','right'].includes(ear)||!['normal','flat','color','grid'].includes(mode)||!(/^[a-zA-Z0-9_-]+$/).test(prefix))throw Error('製作視圖參數不符');
 const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('xmlns',ns);svg.setAttribute('viewBox',mode==='normal'?'0 55 195 177':'22 10 100 99');svg.setAttribute('role','img');svg.setAttribute('aria-label',ear==='left'?'左耳環製作圖':'右耳環製作圖');
 svg.innerHTML=`<defs>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2=".5"><stop offset="0" stop-color="#a96e2a"/><stop offset=".24" stop-color="#f5d987"/><stop offset=".52" stop-color="#bc8739"/><stop offset=".78" stop-color="#f9e5a4"/><stop offset="1" stop-color="#a97436"/></linearGradient>
  <radialGradient id="back" cx=".5" cy=".44" r=".8"><stop offset="0" stop-color="#fffdfa"/><stop offset="1" stop-color="#f5f3ec"/></radialGradient>
  <filter id="shadow" x="-30%" y="-25%" width="165%" height="175%"><feDropShadow dx="1.8" dy="5" stdDeviation="3" flood-color="#796753" flood-opacity=".17"/></filter>
  <filter id="softMark" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${gNow().softness}"/></filter>
  <filter id="noseSoft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="1.5"/></filter>
 </defs>`+raw(ear,limit);
 const cat=svg.lastElementChild;
 if(mode!=='normal'){
  cat.removeAttribute('transform');const face=cat.querySelector('g[filter="url(#shadow)"]');face.removeAttribute('filter');[...cat.children].filter(x=>x!==face&&x.localName!=='defs').forEach(x=>x.remove());const clipped=face.querySelector('g[clip-path]');
  [...clipped.children].filter(x=>x.localName==='path'&&['M35 48 Q43 31 54 33','M88 32 Q98 35 105 48','M35 87 Q60 106 91 91','M28 60 Q24 83 42 94'].includes(x.getAttribute('d'))).forEach(x=>x.remove());
  face.querySelector('circle')?.setAttribute('fill','#c6b793');face.querySelector(':scope > ellipse')?.remove();
  if(mode==='color'){const selected=palette.find(p=>p.id===color)?.hex.toUpperCase();const hexes=new Set(palette.map(p=>p.hex.toUpperCase()));for(const n of [face.firstElementChild,...clipped.querySelectorAll('*'),...cat.querySelectorAll('radialGradient stop')]){if(n.closest('mask'))continue;for(const a of ['fill','stroke','stop-color']){const v=n.getAttribute(a);if(v&&hexes.has(v.toUpperCase()))n.setAttribute(a,v.toUpperCase()===selected?v:'#eeeeea')}}}
  if(mode==='grid'){const lines=document.createElementNS(ns,'g');lines.setAttribute('clip-path','url(#catclip)');lines.setAttribute('stroke','#596c63');lines.setAttribute('stroke-width','.35');lines.setAttribute('stroke-dasharray','1 1');lines.setAttribute('opacity','.65');for(let i=20;i<=120;i+=10){const p=document.createElementNS(ns,'path');p.setAttribute('d','M'+i+' 10V110 M20 '+i+'H120');lines.append(p)}face.append(lines)}
 }
 svg.innerHTML=svg.innerHTML.replace(/id="([^"]+)"/g,(_,k)=>'id="'+prefix+'-'+k+'"').replace(/url\(#([^)]+)\)/g,(_,k)=>'url(#'+prefix+'-'+k+')');return svg;
}
return {raw,render};
}
root.StudioRender50={create};if(typeof module!=='undefined')module.exports={create};
})(typeof globalThis!=='undefined'?globalThis:this);
