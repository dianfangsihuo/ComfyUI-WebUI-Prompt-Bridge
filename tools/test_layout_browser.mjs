// Run only against a disposable local ComfyUI. No image jobs are submitted.
// node tools/test_layout_browser.mjs --isolated --url=http://127.0.0.1:8190
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const url = process.argv.find(a => a.startsWith("--url="))?.slice(6);
assert(url && process.argv.includes("--isolated"), "Supply --isolated --url=... for a disposable instance");
assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname));
const filter = process.argv.find(a => a.startsWith("--case="))?.slice(7);
const phase = process.argv.find(a => a.startsWith("--phase="))?.slice(8) || "final";
assert(/^[a-z0-9-]+$/i.test(phase));
let playwright;
for (const candidate of [process.env.PLAYWRIGHT_IMPORT, "playwright",
    "C:/Users/Administrator/AppData/Roaming/npm/node_modules/playwright/index.mjs",
    "C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs"].filter(Boolean)) {
    try { playwright = await import(/^[A-Za-z]:/.test(candidate) ? pathToFileURL(candidate).href : candidate); break; }
    catch (error) { if (error.code !== "ERR_MODULE_NOT_FOUND") throw error; }
}
assert(playwright, "Install Playwright or set PLAYWRIGHT_IMPORT");
const out = fileURLToPath(new URL(`../output/maintenance/blank-panel-2026-11-08/layout-${phase}/`, import.meta.url));
await mkdir(out, { recursive: true });
const browser = await playwright.chromium.launch({ headless: true });
const results = [];
const defaultLayout = { version: 1, top_row_height: 620, extra_height: 320, sidebar_width: 320,
    positive_textarea_height: 180, negative_textarea_height: 96, positive_chip_height: 104,
    negative_chip_height: 104, positive_tag_height: 190, negative_tag_height: 220,
    extra_collapsed: false, sidebar_collapsed: false, negative_collapsed: false };

async function settle(page) {
    await page.waitForFunction(() => {
        const n = window.app?.graph?._nodes.find(n => n.type === "WebUIPromptBridge");
        return n?.__webuiBridgePanel?.isConnected && n.__webuiBridgePanel.offsetHeight > 100;
    });
    // The production host schedules repair passes up to several seconds after load.
    await page.waitForTimeout(3200);
    await page.evaluate(()=>{
        for(const element of document.querySelectorAll('[data-layout-test-node]'))element.removeAttribute('data-layout-test-node');
        for(const node of app.graph._nodes.filter(n=>n.type==='WebUIPromptBridge')) {
            if(node.__webuiBridgePanel)node.__webuiBridgePanel.dataset.layoutTestNode=String(node.id);
        }
    });
}
const panel=page=>page.locator('[data-layout-test-node="1"]');
async function load(page, { size = [1180, 1060], layout = defaultLayout, count = 1 } = {}) {
    await page.evaluate(async ({ size, layout, count }) => {
        for (const key of Object.keys(localStorage)) if (key.startsWith("webui-bridge-")) localStorage.removeItem(key);
        const template = { type: "WebUIPromptBridge", flags: {}, order: 0, mode: 0 };
        const nodes = Array.from({ length: count }, (_, i) => ({ ...structuredClone(template), id: i + 1,
            pos: [240 + i * 1250, 200], size, properties: { webui_prompt_bridge_layout: Array.isArray(layout) ? layout[i] : layout } }));
        await app.loadGraphData({ version: 0.4, nodes, links: [], groups: [], config: {}, extra: {} });
        app.canvas.ds.scale = 0.55;
        app.canvas.ds.offset = [0, 0];
        app.canvas.setDirty(true, true);
    }, { size, layout, count });
    await settle(page);
    if(count===1) {
        await panel(page).locator('.webui-bridge-positive-prompt-row textarea').fill('layout test, blue sky');
        await page.waitForFunction(()=>app.graph._nodes[0].widgets.find(w=>w.name==='positive_prompt').value==='layout test, blue sky');
        await page.waitForTimeout(200);
    }
}
async function metrics(page) {
    return page.evaluate(() => app.graph._nodes.filter(n => n.type === "WebUIPromptBridge").map(n => {
        const p = n.__webuiBridgePanel, top = p.querySelector(".webui-bridge-toprow"), extra = p.querySelector(".webui-bridge-extra");
        const rect = p.getBoundingClientRect(), scale = rect.height / p.offsetHeight || 1;
        const style = getComputedStyle(p);
        const bottom = getComputedStyle(extra).display === "none" ? top : extra;
        const clippedAncestors=[];
        for(let e=p.parentElement;e&&e!==document.body;e=e.parentElement){
            if(e.classList.contains('lg-node'))break;
            const s=getComputedStyle(e);
            if(/hidden|clip/.test(s.overflow+s.overflowY) && (e.clientHeight<8||e.clientWidth<8))clippedAncestors.push(e.className);
            if(e.classList.contains('dom-widget'))break;
        }
        return { id: n.id, size: Array.from(n.size).map(Math.round), panel: p.offsetHeight, top: top.offsetHeight,
            extra: extra.offsetHeight, blank: Math.round((rect.bottom - bottom.getBoundingClientRect().bottom) / scale),
            overflowX: p.scrollWidth - p.clientWidth, overflowY: p.scrollHeight - p.clientHeight,
            connected: p.isConnected, display: style.display, widgets: n.widgets.filter(w => w.name === "webui_prompt_frontend").length,
            layout: p.__webuiBridgeGetLayoutState(),
            positive: n.widgets.find(w => w.name === "positive_prompt").value,
            failure: Boolean(n.__webuiBridgePanelFailureWidget),clippedAncestors };
    }));
}
function healthy(m, { blank = 100, size } = {}) {
    assert(m.connected && m.widgets === 1 && !m.failure, JSON.stringify(m));
    assert.deepEqual(m.clippedAncestors,[],`Connected panel is visually clipped: ${JSON.stringify(m)}`);
    assert(m.top >= 220 && m.extra >= 42 && m.overflowX <= 2, JSON.stringify(m));
    // Allow one footer/gap of host rounding; never a clipped content section.
    assert(m.blank <= blank && m.blank >= -24 && m.overflowY <= 24, `Unused/overflowing panel space: ${JSON.stringify(m)}`);
    if (size) assert.deepEqual(m.size, size, JSON.stringify(m));
}
async function drag(page, selector, dx, dy) {
    const box = await panel(page).locator(selector).first().boundingBox();
    assert(box && box.height > 0, `Missing visible handle: ${selector}`);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 12 });
    await page.mouse.up();
    await settle(page);
}
const cases = {
    async saved_minimum_split(page) {
        await load(page, { size: [1539, 1705], layout: { ...defaultLayout, top_row_height: 220, extra_height: 96 } });
        const m = (await metrics(page))[0]; healthy(m, { size: [1539, 1705] });
        assert(m.extra >= 220 && m.top >= 420, JSON.stringify(m)); return m;
    },
    async valid_manual_split(page) {
        await load(page); const before = (await metrics(page))[0];
        assert.equal(before.top, 620); assert.equal(before.extra, 320);
        await panel(page).getByRole("tab", { name: "反向提示词", exact: true }).click();
        await panel(page).getByRole("tab", { name: "正向提示词", exact: true }).click(); await settle(page);
        const after = (await metrics(page))[0];
        assert.equal(after.top, before.top); assert.equal(after.extra, before.extra); return after;
    },
    async set_size_roundtrip(page) {
        await load(page);
        const samples = [];
        for (const size of [[1180, 760], [1539, 1705], [640, 900], [1380, 1180]]) {
            await page.evaluate(size => app.graph._nodes[0].setSize(size), size); await settle(page);
            const m = (await metrics(page))[0]; healthy(m, { size }); samples.push(m);
        } return samples;
    },
    async native_resize(page) {
        await load(page, { size: [1000, 800], layout: { ...defaultLayout, top_row_height: 450, extra_height: 250 } });
        await page.waitForTimeout(3000);
        // Host resize can mutate the size array before calling setSize/onResize (LiteGraph/Vue).
        await page.evaluate(() => { const n=app.graph._nodes[0]; n.size[1]=1500; n.setSize(n.size); n.onResize?.(n.size); app.canvas.setDirty(true,true); });
        await settle(page); const m=(await metrics(page))[0]; healthy(m, {size:[1000,1500]}); return m;
    },
    async bridge_handle_resize(page) {
        await load(page, { size: [1000, 800], layout: { ...defaultLayout, top_row_height: 450, extra_height: 250 } });
        await drag(page, ".webui-bridge-resize-grip", 60, 140);
        const m=(await metrics(page))[0]; healthy(m);
        assert(m.size[0]>1000&&m.size[1]>800,`Pointer drag did not resize node: ${JSON.stringify(m)}`);return m;
    },
    async reload_and_pan_zoom(page) {
        await load(page, { size:[1539,1705],layout:{...defaultLayout,top_row_height:220,extra_height:96} });
        const before=(await metrics(page))[0]; healthy(before);
        const graph=await page.evaluate(()=>app.graph.serialize());
        assert.deepEqual(graph.nodes[0].size,before.size,`Serialized dimensions: ${JSON.stringify(graph.nodes[0].size)}`);
        await page.reload(); await page.waitForFunction(()=>window.app?.graph&&window.LiteGraph?.registered_node_types?.WebUIPromptBridge);
        await page.waitForTimeout(2200);
        await page.evaluate(async graph=>{await app.loadGraphData(graph);app.canvas.ds.scale=0.55;app.canvas.ds.offset=[0,0];app.canvas.setDirty(true,true)},graph);
        await settle(page); const reloaded=(await metrics(page))[0];healthy(reloaded,{size:before.size});
        assert(Math.abs(reloaded.top-before.top)<=2 && Math.abs(reloaded.extra-before.extra)<=2,JSON.stringify({before,reloaded}));
        await page.evaluate(()=>{app.canvas.ds.offset=[-20000,-20000];app.canvas.setDirty(true,true);});
        await page.waitForTimeout(1600);
        for(const zoom of [0.35,1,0.55]) {
            await page.evaluate(zoom=>{app.canvas.ds.offset=[0,0];app.canvas.ds.scale=zoom;app.canvas.setDirty(true,true);},zoom);
            await settle(page); const m=(await metrics(page))[0];healthy(m,{size:before.size});
            assert(Math.abs(m.top-before.top)<=2&&Math.abs(m.extra-before.extra)<=2,JSON.stringify({before,m}));
        } return {before,reloaded,after:(await metrics(page))[0]};
    },
    async collapse_and_overlay(page) {
        await load(page); const before=(await metrics(page))[0];
        await panel(page).getByRole("button",{name:"隐藏 LoRA",exact:true}).click(); await settle(page);
        const collapsed=(await metrics(page))[0]; healthy(collapsed); assert.equal(collapsed.extra,42);
        await panel(page).getByRole("button",{name:"显示 LoRA",exact:true}).click(); await settle(page);
        let m=(await metrics(page))[0];assert.equal(m.top,before.top);assert.equal(m.extra,before.extra);
        await panel(page).getByRole("button",{name:"快速添加 LoRA",exact:true}).click();
        await page.locator('[data-layout-test-node="1"].lora-overlay').waitFor();
        await panel(page).locator(".webui-bridge-lora-overlay-close").click(); await settle(page);
        m=(await metrics(page))[0];healthy(m);assert.equal(m.top,before.top);assert.equal(m.extra,before.extra);
        return {before,collapsed,after:m};
    },
    async sidebar_and_tabs(page) {
        await load(page);const before=(await metrics(page))[0];
        await panel(page).getByRole("button",{name:"隐藏侧栏",exact:true}).click();await settle(page);
        const collapsed=(await metrics(page))[0];healthy(collapsed);
        await panel(page).getByRole("button",{name:"显示侧栏",exact:true}).click();await settle(page);
        for(const tab of ["生成","图生图","模块","模型"]) await panel(page).getByRole("tab",{name:tab,exact:true}).click();
        await settle(page);const m=(await metrics(page))[0];healthy(m);
        assert.equal(m.top,before.top);assert.equal(m.extra,before.extra);assert.equal(m.layout.positive_textarea_height,180);
        return {before,collapsed,after:m};
    },
    async split_drag_and_inner_height(page) {
        await load(page);const before=(await metrics(page))[0];
        await drag(page,".webui-bridge-panel-splitter",0,60);
        const moved=(await metrics(page))[0];healthy(moved);
        assert(moved.top>before.top+50&&moved.extra<before.extra-50,JSON.stringify({before,moved}));
        await drag(page,".webui-bridge-panel-splitter",0,-60);
        const m=(await metrics(page))[0];healthy(m);
        assert(Math.abs(m.top-before.top)<=4&&Math.abs(m.extra-before.extra)<=4,JSON.stringify({before,m}));
        assert.equal(m.layout.positive_textarea_height,180);return {before,moved,after:m};
    },
    async node_size_fields(page) {
        await load(page);
        await panel(page).getByText("布局与工具",{exact:true}).click();
        const input=panel(page).locator('input[title="输入节点高度"]');
        const samples=[];
        for(const height of [760,1400,900]) {
            await input.fill(String(height));await input.press("Enter");await settle(page);
            const m=(await metrics(page))[0];healthy(m,{size:[1180,height]});samples.push(m);
        }return samples;
    },
    async independent_nodes(page) {
        await load(page,{count:2,layout:[defaultLayout,{...defaultLayout,top_row_height:500,extra_height:450,sidebar_width:360}]});
        const before=await metrics(page); assert.equal(before[0].top,620,JSON.stringify(before));assert.equal(before[1].top,500,JSON.stringify(before));
        assert.equal(before[0].layout.top_row_height,before[0].top,JSON.stringify(before));
        assert.equal(before[1].layout.top_row_height,before[1].top,JSON.stringify(before));
        const graph=await page.evaluate(()=>app.graph.serialize());
        await page.evaluate(async graph=>{await app.loadGraphData(graph)},graph);await settle(page);
        const after=await metrics(page);
        for(let i=0;i<2;i++){assert.equal(after[i].top,before[i].top);assert.equal(after[i].extra,before[i].extra);}
        return {before,after};
    },
    async presets_and_reset(page) {
        await load(page);await panel(page).getByText("布局与工具",{exact:true}).click();
        const samples=[];
        for(const preset of ["compact","roomy","positive_focus","minimal_lora","default"]) {
            await panel(page).locator(`.webui-bridge-layout-preset[data-preset="${preset}"]`).click();await settle(page);
            const m=(await metrics(page))[0];healthy(m);samples.push({preset,...m});
        }
        await panel(page).getByRole("button",{name:"默认尺寸",exact:true}).click();await settle(page);
        const m=(await metrics(page))[0];healthy(m);samples.push({preset:"reset",...m});return samples;
    },
    async minimum_and_maximum(page) {
        await load(page);const samples=[];
        for(const size of [[640,220],[1800,3200],[640,620]]) {
            await page.evaluate(size=>app.graph._nodes[0].setSize(size),size);await settle(page);
            const m=(await metrics(page))[0];healthy(m);samples.push(m);
        }return samples;
    },
    async prompt_editor_resize(page) {
        const samples=[];
        for(const type of ['WebUIPromptBridgePositivePrompt','WebUIPromptBridgeNegativePrompt']) {
            await page.evaluate(async type=>{
                await app.loadGraphData({version:0.4,nodes:[{id:1,type,pos:[240,120],size:[560,420],flags:{},properties:{},order:0,mode:0}],links:[],groups:[],config:{},extra:{}});
                app.canvas.ds.scale=0.8;app.canvas.ds.offset=[0,0];app.canvas.setDirty(true,true);
            },type);
            await page.waitForFunction(()=>app.graph._nodes[0]?.__webuiBridgePromptOnlyPanel?.isConnected);
            await page.waitForTimeout(1000);
            const current=page.locator('.webui-bridge-prompt-only-panel:visible');
            const size=()=>page.evaluate(()=>Array.from(app.graph._nodes[0].size));
            const before=await size();
            assert.deepEqual(before,[560,420],`Prompt-only node grew before interaction: ${type}`);
            await current.locator('.webui-bridge-prompt-only-library-toggle').click();
            await page.waitForTimeout(800);const expanded=await size();assert(expanded[1]>=before[1]);
            await current.locator('.webui-bridge-prompt-only-library-toggle').click();
            await page.waitForTimeout(800);assert.deepEqual(await size(),before);
            await page.evaluate(()=>app.graph._nodes[0].setSize([640,500]));
            const graph=await page.evaluate(()=>app.graph.serialize());
            await page.evaluate(async graph=>await app.loadGraphData(graph),graph);
            await page.waitForTimeout(1200);assert.deepEqual(await size(),[640,500]);
            const bounds=await page.evaluate(()=>{
                const n=app.graph._nodes[0],p=n.__webuiBridgePromptOnlyPanel,host=p.closest('.lg-node');
                if(!host)return null;
                const pr=p.getBoundingClientRect(),hr=host.getBoundingClientRect();
                return {panelTop:pr.top,panelBottom:pr.bottom,hostTop:hr.top,hostBottom:hr.bottom,hostHeight:host.offsetHeight,nodeHeight:n.size[1]};
            });
            if(bounds){assert(bounds.panelTop>=bounds.hostTop&&bounds.panelBottom<=bounds.hostBottom+2,JSON.stringify(bounds));
                assert(bounds.hostHeight<=bounds.nodeHeight+40,JSON.stringify(bounds));}
            samples.push({type,before,expanded,restored:await size()});
        }return samples;
    },
};
try {
    for (const vue of [false, true]) {
      for(const [name,run] of Object.entries(cases)) {
        if(filter && !filter.split(',').some(part=>name.includes(part))) continue;
        const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
        const errors=[];
        const settings={data_source:"builtin",translation_source:"builtin",tag_translation_source:"builtin",layout_preset:"default",node_tutorial_popup:"off",show_startup_wizard:false,zoom_summary_threshold:0};
        await context.route("**/webui_prompt_bridge/**", async route => {
            const endpoint=new URL(route.request().url()).pathname.split("/").pop();
            if(endpoint==='settings'&&route.request().method()==='POST')Object.assign(settings,route.request().postDataJSON());
            const fixtures={
                settings:{settings},
                loras:{loras:Array.from({length:64},(_,i)=>({name:`layout-test-${i}.safetensors`,display_name:`Layout test ${i}`,folder:"Test",prompt:`<lora:layout-test-${i}:1>`}))},
                models:{models:[],checkpoints:[],diffusion_models:[]},styles:{styles:[]},
                prompt_all_in_one:{groups:[],translations:{}},webui_integration:{configured:false,available:false},
            };
            if(Object.hasOwn(fixtures,endpoint)) await route.fulfill({json:fixtures[endpoint]});
            else await route.continue();
        });
        const page=await context.newPage();
        page.setDefaultTimeout(10000);
        page.on("pageerror",e=>errors.push(e.message));
        await page.goto(url);
        await page.waitForFunction(()=>window.app?.graph && window.LiteGraph?.registered_node_types?.WebUIPromptBridge);
        await page.waitForTimeout(1800);
        const close=page.getByRole("button",{name:/关闭对话框|Close dialog/i}); if(await close.count()) await close.first().click();
        await page.evaluate(async enabled=>await app.ui.settings.setSettingValue("Comfy.VueNodes.Enabled",enabled),vue);
        await page.waitForTimeout(500);
            const key=`${vue?"vue":"litegraph"}-${name}`; const firstError=errors.length;
            try { const detail=await run(page); assert.equal(errors.length,firstError,errors.slice(firstError).join("\n"));
                results.push({key,ok:true,detail}); console.log(`PASS ${key}`);
            } catch(error) {results.push({key,ok:false,error:error.message});console.log(`FAIL ${key}: ${error.message}`);}
            await page.screenshot({path:`${out}/${key}.png`});
        await context.close();
      }
    }
} finally {await browser.close();}
await writeFile(`${out}/results.json`,JSON.stringify({ok:results.every(r=>r.ok),results},null,2));
console.log(JSON.stringify({passed:results.filter(r=>r.ok).length,failed:results.filter(r=>!r.ok).length,out}));
if(results.some(r=>!r.ok)) process.exitCode=1;
