import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {importPlaywright} from './playwright_import.mjs';
const {chromium}=await importPlaywright();
const source=readFileSync(process.env.BRIDGE_SOURCE || new URL('../web/webui_prompt_bridge.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'');
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1200,height:700}});
 await page.goto('about:blank');
 await page.addScriptTag({content:'const app={registerExtension:()=>{},graph:{_nodes:[]}};const api=new EventTarget();'+source+`
 translateTagsToLocal=async tags=>tags.map(()=>"");
 window.boot=(text)=>{
  document.body.replaceChildren();const row=document.createElement('div');row.className='webui-bridge-panel';row.style.cssText='padding:60px;width:1000px';
  const ta=document.createElement('textarea');ta.value=text;row.chips=document.createElement('div');row.chips.style.cssText='display:flex;gap:8px;padding:60px';row.append(ta,row.chips);document.body.append(row);
  const state={autocomplete:[],loras:[],promptAllInOne:{group_tags:[],favorites:{positive:[{id:'old',prompt:'alpha',name:'first'}],negative:[]}}};
  const render=()=>renderPromptChips(row,ta,state,render);window.review={row,ta,state,render};render();
 };addStyles();`});
 const report=await page.evaluate(async()=>{
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  boot('alpha, beta');const chip=review.row.chips.querySelector('[data-prompt-index="0"]');const toolbar=chip.querySelector('.webui-bridge-chip-tools');chip.classList.add('show-tools');const continuity=[];
  for(const label of ['+','+','-','()','[]']){[...toolbar.querySelectorAll('button')].find(b=>b.textContent===label).click();await sleep(350);continuity.push({label,connected:chip.isConnected,toolbarConnected:toolbar.isConnected,value:review.ta.value});}
  boot('alpha, beta');const c=review.row.chips.querySelector('[data-prompt-index="0"]');const weight=c.querySelector('.webui-bridge-chip-weight');weight.value='2';weight.dispatchEvent(new Event('change',{bubbles:true}));await sleep(350);
  const formatted=review.ta.value;const favorite=c.querySelector('.favorite')?.textContent;
  c.dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));const disabled=review.row.__webuiBridgeDisabledTags.map(t=>t.value);review.row.chips.querySelector('.disabled').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}));const restored=review.ta.value;
  boot('alpha, beta');const w=review.row.chips.querySelector('.webui-bridge-chip-weight');for(const value of ['', 'nonsense']){w.value=value;w.dispatchEvent(new Event('change',{bubbles:true}));}const invalid=review.ta.value;
  return {continuity,formatted,favorite,disabled,restored,invalid};
 });
 assert(report.continuity.every(x=>x.connected&&x.toolbarConnected),'attention edits detached DOM');
 assert.equal(report.formatted,'(alpha:2), beta');assert.equal(report.favorite,'☆','favorite action retained old tag state');assert.deepEqual(report.disabled,['(alpha:2)']);assert(report.restored.includes('(alpha:2)'));assert.equal(report.invalid,'alpha, beta');
 await page.evaluate(()=>boot('alpha, beta'));
 await page.locator('[data-prompt-index="0"]').press('Enter');
 const editor=page.locator('.webui-bridge-chip-edit');await editor.waitFor();
 assert.equal(await editor.evaluate(el=>el.tagName),'INPUT');
 await editor.fill('alphabet');await editor.dblclick();
 assert(await editor.evaluate(el=>el.selectionEnd>el.selectionStart),'double click did not select text');
 const box=await editor.boundingBox();assert(box.width<=241&&box.height<=30);
 await editor.evaluate(el=>el.setSelectionRange(0,0));await page.waitForTimeout(500);
 await page.mouse.move(box.x+8,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width-8,box.y+box.height/2,{steps:8});await page.mouse.up();
 assert(await editor.evaluate(el=>el.selectionEnd>el.selectionStart),'drag did not select text');
 await editor.dispatchEvent('keydown',{key:'Enter',isComposing:true});assert.equal(await editor.count(),1,'IME enter committed editor');
 await editor.press('Escape');assert.equal(await page.evaluate(()=>review.ta.value),'alpha, beta');
 assert(await page.locator('[data-prompt-index="0"]').evaluate(el=>el.draggable));
 await page.locator('[data-prompt-index="0"]').press('Enter');await page.locator('.webui-bridge-chip-edit').fill('changed');await page.locator('.webui-bridge-chip-edit').press('Enter');assert.equal(await page.evaluate(()=>review.ta.value),'changed, beta');
 if(process.env.SCREENSHOT_PATH){
  await page.evaluate(()=>{boot('alpha, beta, gamma');review.row.style.background='#10141d';const c=review.row.chips.querySelector('[data-prompt-index="0"]');c.classList.add('show-tools');const w=c.querySelector('.webui-bridge-chip-weight');w.value='2';w.dispatchEvent(new Event('change',{bubbles:true}));});
  await page.locator('.webui-bridge-panel').screenshot({path:process.env.SCREENSHOT_PATH});
 }
 console.log(JSON.stringify({ok:true,browser:browser.version(),...report,selection:'double click and drag passed',ime:'composition Enter retained editor',editorSize:box},null,2));
} finally {await browser.close();}
