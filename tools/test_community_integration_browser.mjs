import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {importPlaywright} from './playwright_import.mjs';
const {chromium}=await importPlaywright();
const url=process.argv.find(a=>a.startsWith('--url='))?.slice(6);
assert(url && process.argv.includes('--isolated') && ['127.0.0.1','localhost'].includes(new URL(url).hostname),'Disposable local instance required');
const out=fileURLToPath(new URL('../output/maintenance/community-integration-2026-11-09/interaction-browser/',import.meta.url));await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});const results=[];
try{
 for(const vue of [false,true]){
  const context=await browser.newContext({viewport:{width:1600,height:1200}});
  const calls=[],errors=[];let active=0,maxActive=0;
  await context.route('**/webui_prompt_bridge/**',async route=>{
   const endpoint=new URL(route.request().url()).pathname.split('/').pop();
   if(endpoint==='translate'){
    const {text,to}=route.request().postDataJSON();calls.push({text,to});active++;maxActive=Math.max(maxActive,active);
    await new Promise(r=>setTimeout(r,text.includes('slow_')?650:120));active--;
    await route.fulfill({json:{tags:text.split(', ').map(input=>({input,prompt:input,local:`中文_${input}`,matched:true}))}}).catch(()=>{});return;
   }
   const fixtures={settings:{settings:{data_source:'builtin',translation_source:'builtin',tag_translation_source:'builtin',layout_preset:'default',node_tutorial_popup:'off',show_startup_wizard:false,zoom_summary_threshold:0}},
    models:{models:[],checkpoints:[],diffusion_models:[]},loras:{loras:[]},styles:{styles:[]},
    prompt_all_in_one:{group_tags:[],favorites:{positive:[],negative:[]}},webui_integration:{configured:false,available:false}};
   if(Object.hasOwn(fixtures,endpoint))await route.fulfill({json:fixtures[endpoint]});else await route.continue();
  });
  const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  try{
   await page.goto(url);await page.waitForFunction(()=>window.app?.graph&&window.LiteGraph?.registered_node_types?.WebUIPromptBridge);
   await page.waitForTimeout(1500);
   const close=page.getByRole('button',{name:/关闭对话框|Close dialog/i});if(await close.count())await close.first().click();
   await page.evaluate(async vue=>{
    await app.ui.settings.setSettingValue('Comfy.VueNodes.Enabled',vue);
    await app.loadGraphData({version:0.4,nodes:[{id:1,type:'WebUIPromptBridge',pos:[240,240],size:[1180,1060],flags:{},properties:{webui_prompt_bridge_layout:{version:1,top_row_height:620,extra_height:320,positive_textarea_height:180,positive_chip_height:140,sidebar_width:320}},order:0,mode:0}],links:[],groups:[],config:{},extra:{}});
    app.canvas.ds.scale=0.8;app.canvas.ds.offset=[0,0];app.canvas.setDirty(true,true);
   },vue);
   await page.waitForFunction(()=>app.graph._nodes[0].__webuiBridgePanel?.isConnected);await page.waitForTimeout(2000);
   await page.evaluate(()=>app.graph._nodes[0].__webuiBridgePanel.dataset.prTestPanel='1');
   const p=page.locator('[data-pr-test-panel="1"]'),row=p.locator('.webui-bridge-positive-prompt-row'),ta=row.locator('textarea');
   const value=()=>ta.inputValue();const fill=async text=>{await ta.fill(text);await page.waitForTimeout(450)};
   const chip=()=>row.locator('.webui-bridge-prompt-chip[data-prompt-index="0"]');
   await fill('alpha, beta');
   await chip().hover();await page.waitForTimeout(500);
   await page.evaluate(()=>{window.__beforePrChip=app.graph._nodes[0].__webuiBridgePanel.querySelector('.webui-bridge-positive-prompt-row [data-prompt-index="0"]')});
   for(let i=0;i<2;i++){await chip().locator('button[title="提高权重 0.1"]').click();await page.waitForTimeout(450);}
   assert.equal(await value(),'(alpha:1.2), beta');
   assert(await page.evaluate(()=>window.__beforePrChip===app.graph._nodes[0].__webuiBridgePanel.querySelector('.webui-bridge-positive-prompt-row [data-prompt-index="0"]')),'Repeated weight edit detached chip in real host');
   const weight=chip().locator('.webui-bridge-chip-weight');await weight.fill('2');await weight.press('Tab');await page.waitForTimeout(500);
   assert.equal(await value(),'(alpha:2), beta');
   if(!(await chip().locator('.webui-bridge-chip-tools').isVisible()))await chip().locator('.webui-bridge-chip-tools-toggle').click();await chip().locator('button[title="禁用关键词"]').click();await page.waitForTimeout(300);
   assert.equal(await value(),'beta');
   const disabled=row.locator('.webui-bridge-prompt-chip.disabled');await disabled.dblclick();await page.waitForTimeout(300);assert((await value()).includes('(alpha:2)'));
   await fill('alpha, beta');await chip().press('Enter');
   const edit=row.locator('.webui-bridge-chip-edit');await edit.fill('新的词');await edit.dispatchEvent('keydown',{key:'Enter',isComposing:true});assert.equal(await edit.count(),1);
   await edit.press('Escape');assert.equal(await value(),'alpha, beta');
   const zooms=[];
   for(const zoom of [1,0.65,0.35]){
    await page.evaluate(z=>{app.canvas.ds.scale=z;app.canvas.ds.offset=[0,0];app.canvas.setDirty(true,true)},zoom);await page.waitForTimeout(250);
    await fill('alpha, beta, alpha, gamma');const before=await chip().boundingBox();await chip().hover();await page.waitForTimeout(450);
    const button=chip().locator('.webui-bridge-chip-quick-delete');const buttonBox=await button.boundingBox();
    if(zoom<0.55){assert.equal(buttonBox,null,'Low zoom must use safer tools, not a tiny destructive target');zooms.push({zoom,quickDeleteHidden:true});continue;}
    assert(buttonBox && buttonBox.width>=21,`Quick-delete hit area too small: ${JSON.stringify({zoom,buttonBox})}`);await button.click();await page.waitForTimeout(450);assert.equal(await value(),'beta, alpha, gamma');
    assert.equal(await row.locator('.webui-bridge-chip-edit').count(),0);zooms.push({zoom,chipWidth:before.width,deleteWidth:buttonBox.width,deleteHeight:buttonBox.height});
   }
   await page.evaluate(()=>{app.canvas.ds.scale=0.8;app.canvas.setDirty(true,true)});
   await fill('alpha, beta');await chip().press('Enter');await row.locator('.webui-bridge-chip-edit').fill('changed');await row.locator('.webui-bridge-chip-edit').press('Enter');await page.waitForTimeout(350);assert.equal(await value(),'changed, beta');
   const saved=await page.evaluate(()=>app.graph.serialize());
   await page.evaluate(async graph=>{await app.loadGraphData(graph);app.canvas.ds.scale=0.8;app.canvas.ds.offset=[0,0];app.canvas.setDirty(true,true)},saved);
   await page.waitForTimeout(2200);await page.evaluate(()=>{document.querySelectorAll('[data-pr-test-panel]').forEach(p=>p.removeAttribute('data-pr-test-panel'));app.graph._nodes[0].__webuiBridgePanel.dataset.prTestPanel='1'});
   assert.equal(await value(),'changed, beta');
   await fill('fast_one, fast_two, slow_three, slow_four');
   await page.waitForFunction(()=>[...document.querySelectorAll('[data-pr-test-panel] .webui-bridge-positive-prompt-row .webui-bridge-chip-local')].some(x=>x.textContent==='中文_fast_one'));
   const early=await row.locator('.webui-bridge-chip-local').allTextContents();
   await page.waitForTimeout(800);const translated=await row.locator('.webui-bridge-chip-local').allTextContents();
   assert(translated.includes('中文_slow_four'));assert(maxActive<=2,`Client concurrency was ${maxActive}`);
   const state=await page.evaluate(()=>{const n=app.graph._nodes[0];return {size:Array.from(n.size),widgets:n.widgets.filter(w=>w.name==='webui_prompt_frontend').length,positive:n.widgets.find(w=>w.name==='positive_prompt').value}});
   assert.equal(state.widgets,1);
   const relatedErrors=errors.filter(x=>/bridge|prompt/i.test(x));assert.equal(relatedErrors.length,0,relatedErrors.join('\n'));
   results.push({vue,ok:true,zooms,maxActive,early,translated,state});console.log(`PASS ${vue?'Vue':'LiteGraph'} real host interaction + translation`);
  }catch(e){results.push({vue,ok:false,error:e.stack});console.log(`FAIL ${vue?'Vue':'LiteGraph'} ${e.message}`)}
  await page.screenshot({path:out+`/${vue?'vue':'litegraph'}.png`});await context.close();
 }
}finally{await browser.close()}
await writeFile(out+'/results.json',JSON.stringify(results,null,2));
if(results.some(r=>!r.ok))process.exitCode=1;
