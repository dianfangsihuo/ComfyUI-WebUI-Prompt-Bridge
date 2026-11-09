import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {importPlaywright} from './playwright_import.mjs';
const {chromium}=await importPlaywright();
const source=readFileSync(new URL('../web/webui_prompt_bridge.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'');
const browser=await chromium.launch({headless:true});
try {
 const page=await browser.newPage({viewport:{width:1280,height:900}});
 await page.goto('about:blank');
 await page.addScriptTag({content:'const app={registerExtension:()=>{},graph:{_nodes:[]}};const api=new EventTarget();'+source+`
 bridgeJson=async response=>response.json();
 window.boot=()=>{
  document.body.replaceChildren();window.calls=[];window.saved=[];window.block=false;
  window.state={promptAllInOne:{favorites:{positive:[{id:'a',prompt:'blue sky',name:'blue sky',category:'scenes'},
    {id:'b',prompt:'1girl',name:'My custom name'},{id:'c',prompt:'red hair',name:'red hair'},
    ...Array.from({length:25},(_,i)=>({id:'x'+i,prompt:'test '+i,name:'test '+i}))],negative:[]}}};
  api.fetchApi=async(url,options)=>{
   const data=JSON.parse(options.body);calls.push({url,data});
   if(url.includes('translate_preview')){
    if(block)await new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('aborted')),{once:true}));
    const item=state.promptAllInOne.favorites.positive.find(i=>i.id===data.id);
    return {ok:true,json:async()=>data.id==='c'?{status:'failed',message:'no match'}:{id:item.id,prompt:item.prompt,expected_name:item.name,name:'蓝天',status:'ready'}};
   }
   saved=data.items;return {ok:true,json:async()=>({changed:saved.length,favorites:state.promptAllInOne.favorites})};
  };showFavoriteChineseDialog('positive',state,()=>{});
 };addStyles();`});
 await page.evaluate(()=>boot());
 assert.equal(await page.getByLabel('选择 1girl',{exact:true}).count(),0,'Custom name must be excluded');
 await page.getByLabel('选择 blue sky',{exact:true}).check();
 await page.getByRole('button',{name:'翻译选中（最多20条）',exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('.webui-bridge-favorite-translate-result').textContent==='蓝天');
 assert.equal(await page.evaluate(()=>saved.length),0,'Preview must not save');
 await page.getByRole('button',{name:'确认保存中文说明',exact:true}).click();
 await page.waitForFunction(()=>saved.length===1);
 assert.deepEqual(await page.evaluate(()=>({prompt:saved[0].prompt,name:saved[0].name,expected:saved[0].expected_name})),{prompt:'blue sky',name:'蓝天',expected:'blue sky'});
 await page.evaluate(()=>boot());
 const boxes=page.getByRole('checkbox');for(let i=0;i<21;i++)await boxes.nth(i).click();
 assert.equal(await page.locator('input[type=checkbox]:checked').count(),20);
 await page.evaluate(()=>boot());
 await page.getByLabel('选择 red hair',{exact:true}).check();await page.getByRole('button',{name:'翻译选中（最多20条）'}).click();
 await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.startsWith('完成'));
 assert.equal(await page.getByRole('button',{name:'确认保存中文说明'}).isEnabled(),false);
 await page.evaluate(()=>{boot();block=true});
 await page.getByLabel('选择 blue sky',{exact:true}).check();await page.getByLabel('选择 red hair',{exact:true}).check();
 await page.getByRole('button',{name:'翻译选中（最多20条）'}).click();await page.waitForFunction(()=>calls.length===1);
 await page.getByRole('button',{name:'停止 / 关闭'}).click();
 await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.startsWith('已停止'));
 assert.equal(await page.evaluate(()=>calls.length),1);assert.equal(await page.evaluate(()=>saved.length),0);
 await page.getByRole('button',{name:'停止 / 关闭'}).click();assert.equal(await page.getByRole('dialog').count(),0);
 await page.evaluate(()=>boot());await page.getByLabel('选择 blue sky',{exact:true}).check();await page.getByRole('button',{name:'翻译选中（最多20条）'}).click();
 await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.startsWith('完成'));
 if(process.env.SCREENSHOT_PATH)await page.screenshot({path:process.env.SCREENSHOT_PATH});
 console.log('PASS favorite Chinese UI: protected custom names, explicit preview/save, 20 selection cap, failure and cancel without next request');
}finally{await browser.close()}
