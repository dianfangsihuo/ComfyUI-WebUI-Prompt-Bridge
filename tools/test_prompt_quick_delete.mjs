import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_IMPORT || 'playwright');
const source=readFileSync(process.env.BRIDGE_SOURCE || new URL('../web/webui_prompt_bridge.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'');
const browser=await chromium.launch({headless:true});
try{
 const page=await browser.newPage({viewport:{width:1200,height:700}});await page.goto('about:blank');
 await page.addScriptTag({content:'const app={registerExtension:()=>{},graph:{_nodes:[]}};const api=new EventTarget();api.fetchApi=async()=>({ok:true,json:async()=>({})});'+source+`
 translateTagsToLocal=async tags=>tags.map(()=>"");
 window.boot=(text)=>{
  document.body.replaceChildren();const row=document.createElement('div');row.className='webui-bridge-panel';row.style.cssText='padding:60px;width:1000px;background:#10141d';
  const ta=document.createElement('textarea');ta.value=text;row.chips=document.createElement('div');row.chips.style.cssText='display:flex;gap:12px;padding:60px';row.append(ta,row.chips);document.body.append(row);
  const state={autocomplete:[],loras:[],promptAllInOne:{group_tags:[],favorites:{positive:[],negative:[]}}};
  const render=()=>renderPromptChips(row,ta,state,render);window.review={row,ta,state,render};render();
 };addStyles();`});
 await page.evaluate(()=>boot('alpha, beta, alpha, gamma'));
 const first=page.locator('[data-prompt-index="0"]');const before=await first.boundingBox();
 assert.equal(await first.locator('.webui-bridge-chip-quick-delete').evaluate(el=>getComputedStyle(el).opacity),'0');
 await first.hover();await page.waitForTimeout(110);
 assert.equal(await first.locator('.webui-bridge-chip-quick-delete').evaluate(el=>getComputedStyle(el).opacity),'1');
 assert.equal((await first.boundingBox()).width,before.width);
 await first.locator('.webui-bridge-chip-quick-delete').click();await page.waitForTimeout(300);
 assert.equal(await page.evaluate(()=>review.ta.value),'beta, alpha, gamma');assert.equal(await page.locator('.webui-bridge-chip-edit').count(),0);
 await page.evaluate(()=>boot('alpha, beta, gamma'));await page.locator('[data-prompt-index="1"]').dblclick();
 const disabled=page.locator('.webui-bridge-prompt-chip.disabled');await disabled.hover();await disabled.locator('.webui-bridge-chip-quick-delete').click();
 assert.equal(await page.evaluate(()=>review.ta.value),'alpha, gamma');assert.equal(await disabled.count(),0);
 await page.evaluate(()=>boot('<lora:example:1>, beta'));await first.hover();await first.locator('.webui-bridge-chip-quick-delete').click();assert.equal(await page.evaluate(()=>review.ta.value),'beta');
 await page.evaluate(()=>boot('alpha, beta'));await first.locator('.webui-bridge-chip-quick-delete').focus();await first.locator('.webui-bridge-chip-quick-delete').press('Enter');assert.equal(await page.evaluate(()=>review.ta.value),'beta');
 await page.evaluate(()=>boot('alpha, beta, gamma'));await first.hover();
 if(process.env.SCREENSHOT_PATH)await page.locator('.webui-bridge-panel').screenshot({path:process.env.SCREENSHOT_PATH});
 console.log(JSON.stringify({ok:true,browser:browser.version(),checks:['hover without resizing','delete clicked duplicate occurrence','disabled deletion without reactivation','LoRA deletion','no editor after deletion','keyboard Enter']},null,2));
}finally{await browser.close();}
