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
const api={analyze};root.CatProductionCheck=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
