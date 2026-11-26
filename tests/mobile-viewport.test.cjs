const test=require('node:test'),assert=require('node:assert/strict'),v=require('../cat-viewport.js');
const base=[28,65,142,144];
test('center zoom preserves center and bounds',()=>{assert.deepEqual(v.transform(base,base,[.5,.5],[.5,.5],2),[63.5,101,71,72]);assert.deepEqual(v.transform(base,base,[.5,.5],[.5,.5],100),[28+142/3,65+48,142/3,48])});
test('pan clamps to original drawable extent',()=>{const zoom=[63.5,101,71,72];assert.deepEqual(v.transform(zoom,base,[.5,.5],[10,10],1),[28,65,71,72]);assert.deepEqual(v.transform(zoom,base,[.5,.5],[-10,-10],1),[99,137,71,72])});
test('zoom out returns base and invalid scale is neutral',()=>{const zoom=[63.5,101,71,72];assert.deepEqual(v.transform(zoom,base,[.5,.5],[.5,.5],.1),base);assert.deepEqual(v.transform(zoom,base,[.5,.5],[.5,.5],NaN),zoom)});
test('relative mapping accounts for centered SVG letterboxing',()=>{assert.deepEqual(v.relativePoint(100,50,{left:0,top:0,width:200,height:100},[0,0,100,100]),[.5,.5]);assert.deepEqual(v.relativePoint(50,0,{left:0,top:0,width:200,height:100},[0,0,100,100]),[0,0])});
