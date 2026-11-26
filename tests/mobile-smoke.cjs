// Run from repository root: npm install --no-save playwright; npx playwright install chromium; node tests/mobile-smoke.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const html=fs.readFileSync(path.join(__dirname,'../index.html'));
const server=http.createServer((req,res)=>{res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});res.end(html)});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true});
 const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const [width,height] of [[320,568],[375,667],[390,844],[430,932]]){
   const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>{errors.push('Unexpected native '+d.type());d.dismiss()});
   await page.goto(base);await page.waitForFunction(()=>document.body.classList.contains('lab46-mobile'));
   await page.locator('#drawSvg').waitFor({state:'visible'});
   const bounds=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth,canvas:document.querySelector('#drawSvg').getBoundingClientRect().width}));
   assert.ok(bounds.scroll<=bounds.viewport+1,JSON.stringify(bounds));assert.ok(bounds.canvas>150,JSON.stringify(bounds));
   await page.locator('#lab46Colors').click();await page.locator('#lab46Fullpalette button').first().click();assert.equal(await page.locator('#v42Editor').evaluate(e=>e.classList.contains('lab46-sheet-open')),false);
   await page.locator('#lab46Focus').click();assert.equal(await page.locator('body').evaluate(e=>e.classList.contains('lab46-focus')),true);await page.locator('#lab46Focus').click();
   await page.locator('#lab46More').click();await page.locator('#v42Blank').click();await page.locator('#catuxDialog[open]').waitFor();await page.locator('#catuxDialog').getByRole('button',{name:'繼續畫',exact:true}).click();assert.equal(await page.locator('#catuxDialog').evaluate(e=>e.open),false);await page.locator('#lab46Close').click();
   await page.locator('#v42DoneTop').click();await page.locator('#v42Finish').waitFor({state:'visible'});assert.deepEqual(errors,[]);
   console.log('PASS customer '+width+'x'+height, bounds);await page.close();
  }
  const admin=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});const errors=[];admin.on('pageerror',e=>errors.push(e.message));
  await admin.goto(base+'/?studio=1');await admin.locator('#adminWorkspace').waitFor({state:'visible'});
  await admin.locator('[data-sm44-tab="palette"]').click();await admin.locator('#sm47AddPigment').click();await admin.locator('#sm47PName').fill('驗收測試色');await admin.locator('#sm47PCode').fill('QA-001');await admin.locator('#sm47PHex').fill('#123456');await admin.locator('#sm47SavePigment').click();
  await admin.locator('#sm47Pigments').getByRole('button',{name:/驗收測試色/}).waitFor();
  await admin.locator('[data-sm44-tab="settings"]').click();await admin.locator('[data-sm-go="backup"]').click();await admin.locator('#sm47Restore').waitFor({state:'visible'});
  const b=await admin.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(b.scroll<=b.viewport+1,JSON.stringify(b));assert.deepEqual(errors,[]);console.log('PASS studio mobile palette and backup');await admin.close();
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error(e);process.exitCode=1});
