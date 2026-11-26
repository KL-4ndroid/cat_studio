(function(root){'use strict';
function analyze(design) {
  // V1 heuristic only; dimensions are approximate CAT6 projection, not factory tolerances.
  const scale=10.339/(115.96-27.04),limits={thinMm:.35,smallMm:.55,colors:5,strokes:20};
  const palette=new Map((design.palette||[]).map(p=>[p.id,p]));
  const ears=['left','right'].map(ear=>{
    const st=ear==='right'&&!design.same?design.right:design.left;
    if(!st||!Array.isArray(st.cols))throw Error('設計資料不完整');
    const ids=new Set([st.cols[0]]);
    for(const [key,value] of Object.entries(st.zones||{})){
      if(key==='centerForehead'&&st.join!=='bridge'||key==='muzzle'&&!st.muzzle||key.endsWith('Cheek')&&st.finish==='soft')continue;
      ids.add(st.cols[Math.max(0,Math.min(Number(value)||0,st.mode-1))]);
    }
    if(st.stripe){
      const id=st.cols[Math.min(st.zones?.[st.join==='bridge'?'centerForehead':'leftForehead']??0,st.mode-1)];
      const main=palette.get(id),rgb=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
      if(main&&/^#[0-9a-f]{6}$/i.test(main.hex)){
        const target=rgb(main.hex).map((v,i)=>Math.round(v*.35+rgb('#2b211c')[i]*.65));
        const candidates=[...palette.values()].filter(p=>p.enabled!==false&&/^#[0-9a-f]{6}$/i.test(p.hex));
        const dist=p=>rgb(p.hex).reduce((t,v,i)=>t+(v-target[i])**2,0);
        const nearest=candidates.sort((a,b)=>dist(a)-dist(b))[0];if(nearest)ids.add(nearest.id);
      }
    }
    let strokes=0,thin=0,small=0,erased=0;
    for(const op of st.drawing||[]){
      if(op.tool==='erase'){erased++;continue;}
      ids.add(op.color);strokes++;
      if(op.tool==='brush'&&Number.isFinite(op.width)&&op.width*scale<limits.thinMm)thin++;
      if(op.tool==='shape'&&Array.isArray(op.points)&&op.points.length>=3){
        let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
        for(const [x,y] of op.points){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}
        if(Math.min(maxX-minX,maxY-minY)*scale<limits.smallMm)small++;
      }
    }
    const colors=[...ids].filter(id=>palette.has(id)).map(id=>palette.get(id));
    const gradient=st.mode>1&&(st.finish==='soft'||!!st.muzzle);
    const flags=[];
    if(thin)flags.push('細筆畫 '+thin+' 筆');
    if(small)flags.push('細小色塊 '+small+' 筆');
    if(colors.length>limits.colors)flags.push('候選色較多');
    if(strokes>limits.strokes)flags.push('手繪步驟較多');
    if(gradient)flags.push('柔邊／漸層需確認');
    if(st.stripe)flags.push('虎斑細節需確認');
    return {ear,strokes,thin,small,erased,gradient,colors,flags};
  });
  const detail=ears.some(e=>e.thin||e.small||e.strokes>50||e.colors.length>7);
  const review=ears.some(e=>e.flags.length);
  return {version:'V1',level:detail?'細節需覆核':review?'需確認':'未發現明顯提醒',review,ears,limits,notice:'依設計筆畫與候選色初步分析，可能包含被覆蓋或擦除的筆畫，非實際製作保證。最終由工作室確認。'};
}
function measureVisible(rgba,mask,width,height,palette,mmPerPixel){
  const n=width*height;if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||n>300000||rgba.length!==n*4||mask.length!==n||!(mmPerPixel>0))throw Error('無效的圖案取樣');
  const unique=new Map();for(const p of palette){if(/^#[0-9a-f]{6}$/i.test(p.hex||'')){const hex=p.hex.toUpperCase();if(!unique.has(hex))unique.set(hex,{hex,names:[],rgb:[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16))});unique.get(hex).names.push(p.name||p.id||hex);}}
  const colors=[...unique.values()];if(!colors.length||colors.length>100)throw Error('無有效色票');
  const labels=new Int16Array(n);labels.fill(-2);const counts=new Uint32Array(colors.length),cache=new Map();let total=0,unknown=0;
  for(let i=0;i<n;i++){if(mask[i]<250)continue;total++;const j=i*4,key=(rgba[j]<<16)|(rgba[j+1]<<8)|rgba[j+2];let label=cache.get(key);if(label===undefined){let best=Infinity,chosen=-1,tie=false;for(let k=0;k<colors.length;k++){const c=colors[k].rgb,d=(rgba[j]-c[0])**2+(rgba[j+1]-c[1])**2+(rgba[j+2]-c[2])**2;if(d<best){best=d;chosen=k;tie=false}else if(d===best)tie=true}label=best<=144&&!tie?chosen:-1;if(cache.size<8192)cache.set(key,label)}labels[i]=label;if(label<0)unknown++;else counts[label]++;}
  if(!total)throw Error('找不到貓咪頭範圍');
  const seen=new Uint8Array(n),queue=new Int32Array(n);let tiny=0,regions=0,boundary=0;const tinyArea=Math.PI*(.55/2)**2,minPixels=4;
  for(let i=0;i<n;i++){const label=labels[i];if(label<0)continue;const x=i%width;if(x+1<width&&labels[i+1]>=0&&labels[i+1]!==label)boundary++;if(i+width<n&&labels[i+width]>=0&&labels[i+width]!==label)boundary++;
    if(seen[i])continue;let head=0,tail=1;queue[0]=i;seen[i]=1;
    while(head<tail){const j=queue[head++],xj=j%width;for(const k of [xj>0?j-1:-1,xj+1<width?j+1:-1,j-width,j+width]){if(k<0||k>=n||seen[k]||labels[k]!==label)continue;seen[k]=1;queue[tail++]=k}}
    if(tail>=minPixels){regions++;if(tail*mmPerPixel**2<tinyArea)tiny++}
  }
  return {coverage:(total-unknown)/total,colors:colors.map((p,i)=>({hex:p.hex,names:p.names,fraction:counts[i]/total,pixels:counts[i]})).filter(p=>p.pixels>=minPixels).sort((a,b)=>b.pixels-a.pixels),regions,tinyRegions:tiny,boundaryMm:boundary*mmPerPixel,unknownFraction:unknown/total};
}
async function analyzeArtwork(svg,palette){
  // Sample the final composited artwork (including masks), not the brush history.
  const doc=new DOMParser().parseFromString(svg,'image/svg+xml'),head=doc.querySelector('clipPath#textureHead path')?.getAttribute('d');
  if(!head||doc.querySelector('parsererror'))throw Error('無法讀取設計輪廓');
  const w=420,h=390,canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});if(!ctx)throw Error('無法取樣');
  const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml;charset=utf-8'}));
  try{const img=new Image();await new Promise((ok,no)=>{img.onload=ok;img.onerror=no;img.src=url});ctx.drawImage(img,0,0,w,h);const rgba=ctx.getImageData(0,0,w,h).data;
    ctx.clearRect(0,0,w,h);ctx.setTransform(3,0,0,3,0,0);ctx.fillStyle='#fff';ctx.fill(new Path2D(head));const raw=ctx.getImageData(0,0,w,h).data,mask=new Uint8Array(w*h);for(let i=0;i<mask.length;i++)mask[i]=raw[i*4+3];
    return measureVisible(rgba,mask,w,h,palette,10.339/(115.96-27.04)/3);
  }finally{URL.revokeObjectURL(url)}
}
const api={analyze,measureVisible,analyzeArtwork};root.CatProductionCheck=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
