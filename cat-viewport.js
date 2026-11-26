(function(root){'use strict';
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
function parseView(s){const v=String(s).trim().split(/[\s,]+/).map(Number);if(v.length!==4||!v.every(Number.isFinite)||v[2]<=0||v[3]<=0)throw Error('Invalid viewBox');return v;}
function constrain(view,base,maxZoom=3){
 const zoom=clamp(base[2]/view[2],1,maxZoom),w=base[2]/zoom,h=base[3]/zoom;
 return [clamp(view[0],base[0],base[0]+base[2]-w),clamp(view[1],base[1],base[1]+base[3]-h),w,h];
}
function transform(view,base,from,to,ratio=1,maxZoom=3){
 if(!Number.isFinite(ratio)||ratio<=0)ratio=1;
 const zoom=clamp(base[2]/view[2]*ratio,1,maxZoom),w=base[2]/zoom,h=base[3]/zoom;
 return constrain([view[0]+from[0]*view[2]-to[0]*w,view[1]+from[1]*view[3]-to[1]*h,w,h],base,maxZoom);
}
function relativePoint(clientX,clientY,rect,view){
 const scale=Math.min(rect.width/view[2],rect.height/view[3]);if(!(scale>0))return [.5,.5];
 return [(clientX-rect.left-(rect.width-view[2]*scale)/2)/(view[2]*scale),(clientY-rect.top-(rect.height-view[3]*scale)/2)/(view[3]*scale)];
}
const api={parseView,constrain,transform,relativePoint};root.CatViewport=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
