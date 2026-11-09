import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {importPlaywright} from './playwright_import.mjs';
const {chromium}=await importPlaywright();
const source=readFileSync(new URL('../web/webui_prompt_bridge.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'');
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage();await page.goto('about:blank');
 await page.addScriptTag({content:'const app={registerExtension:()=>{},graph:{_nodes:[]}};const api=new EventTarget();'+source+`
 window.check=async()=>{
  const calls=[];let active=0,maxActive=0;
  translatePromptAllInOne=async text=>{
   calls.push(text);active++;maxActive=Math.max(maxActive,active);
   await new Promise(r=>setTimeout(r,text.includes('third')?200:20));active--;
   return {tags:text.split(', ').map(input=>({input,local:'translated_'+input,matched:true}))};
  };
  buildLocalTagMap=()=>new Map([['known','Known translation']]);
  const row=document.createElement('div'),ta=document.createElement('textarea');
  ta.value='known, first, second, third, fourth';row.chips=document.createElement('div');row.append(ta,row.chips);document.body.append(row);
  const state={autocomplete:[],loras:[],promptAllInOne:{group_tags:[],favorites:{positive:[],negative:[]}}};
  renderPromptChips(row,ta,state,()=>{});
  const chips=[...row.chips.querySelectorAll('.webui-bridge-prompt-chip')];
  const labels=()=>chips.map(c=>c.querySelector('.webui-bridge-chip-local').textContent);
  const observer=new MutationObserver(records=>{for(const record of records)if(record.target===row.chips&&record.removedNodes.length)removed++;});let removed=0;observer.observe(row.chips,{childList:true});
  await new Promise(r=>setTimeout(r,90));const early=labels();
  await new Promise(r=>setTimeout(r,220));const final=labels();
  const before=calls.length;await translateTagsToLocal(['first','first']);const cached=calls.length===before;
  const live=chips[1];live.__bridgeTagRef.value='different';applyTranslatedPromptChipLocal(live,'first','wrong stale translation');const staleIgnored=live.querySelector('.webui-bridge-chip-local').textContent==='translated_first';
  observer.disconnect();return {calls,maxActive,early,final,cached,staleIgnored,removed,connected:chips.every(c=>c.isConnected)};
 };`});
 const result=await page.evaluate(()=>check());
 assert.deepEqual(result.calls,['first, second','third, fourth']);
 assert.equal(result.maxActive,2);assert.equal(result.early[1],'translated_first');assert.equal(result.early[3].trim(),'');
 assert.equal(result.final[0],'Known translation');assert.equal(result.final[4],'translated_fourth');
 assert(result.cached&&result.staleIgnored&&result.connected);assert.equal(result.removed,0);
 console.log(JSON.stringify({ok:true,...result},null,2));
} finally {await browser.close();}
