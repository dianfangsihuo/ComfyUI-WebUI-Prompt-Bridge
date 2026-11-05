// Integration test. Use ONLY a disposable ComfyUI instance: this creates test
// workflows and changes that instance's Nodes 2.0 setting, never queues images.
// node tools/test_panel_mount_browser.mjs --isolated --url=http://127.0.0.1:8190
import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

const url = process.argv.find(arg => arg.startsWith("--url="))?.slice(6);
assert(url && process.argv.includes("--isolated"), "Supply --isolated --url=... for a disposable ComfyUI instance");
assert(["127.0.0.1", "localhost", "[::1]"].includes(new URL(url).hostname), "Use a local test instance");
let playwright;
for (const candidate of [process.env.PLAYWRIGHT_IMPORT, "playwright",
    "C:/Users/Administrator/AppData/Roaming/npm/node_modules/playwright/index.mjs",
    "C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs"].filter(Boolean)) {
    try {
        playwright = await import(/^[A-Za-z]:/.test(candidate) ? pathToFileURL(candidate).href : candidate);
        break;
    } catch (error) {
        if (error.code !== "ERR_MODULE_NOT_FOUND") throw error;
    }
}
assert(playwright, "Install Playwright or supply PLAYWRIGHT_IMPORT");
const out = fileURLToPath(new URL("../output/maintenance/issue14/browser/", import.meta.url));
await mkdir(out, { recursive: true });
const browser = await playwright.chromium.launch({ headless: true });
const results = [];
try {
    for (const vue of [false, true]) {
      for (const scenario of ["normal", "delayed", "blocked", "retry"]) {
        console.log(`Checking ${vue ? "Vue" : "LiteGraph"}/${scenario}`);
        const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
        // Keep evidence free of private local models, prompts and integration settings.
        await context.route("**/webui_prompt_bridge/**", async route => {
            const endpoint = new URL(route.request().url()).pathname.split("/").pop();
            const fixtures = {
                loras: { loras: [] }, models: { models: [], checkpoints: [], diffusion_models: [] },
                styles: { styles: [] }, prompt_all_in_one: { groups: [], translations: {} },
                webui_integration: { configured: false, available: false },
                settings: { settings: { data_source: "builtin", translation_source: "builtin", tag_translation_source: "builtin",
                    show_startup_wizard: false, node_tutorial_popup: "off" } },
            };
            if (Object.hasOwn(fixtures, endpoint)) {
                await route.fulfill({ json: fixtures[endpoint] });
            } else await route.continue();
        });
        const page = await context.newPage();
        await page.goto(url);
        await page.waitForFunction(() => window.app?.graph && window.LiteGraph?.registered_node_types?.WebUIPromptBridge);
        await page.evaluate(async enabled => {
            const { app } = await import("/scripts/app.js");
            await app.ui.settings.setSettingValue("Comfy.VueNodes.Enabled", enabled);
            await app.loadGraphData({ version: 0.4, nodes: [], links: [], groups: [], config: {}, extra: {} });
        }, vue);
        // Dismiss the host's templates dialog if present (not Bridge's UI).
        const close = page.getByRole("button", { name: /关闭对话框|Close dialog/i });
        if (await close.count()) await close.first().click();
            await page.evaluate(async ({ scenario }) => {
                const { app } = await import("/scripts/app.js");
                window.__bridgeMountTest?.observer?.disconnect();
                await app.loadGraphData({ version: 0.4, nodes: [], links: [], groups: [], config: {}, extra: {} });
                const proto = window.LiteGraph.registered_node_types.WebUIPromptBridge.prototype;
                const original = proto.__testOriginalAddDOMWidget || proto.addDOMWidget;
                proto.__testOriginalAddDOMWidget = original;
                const state = window.__bridgeMountTest = { attempts: 0, unregisters: 0, detached: [], node: null, owner: null };
                const held = new Map();
                const watched = new Set();
                const started = performance.now();
                const block = () => {
                    if (scenario === "normal" || (scenario === "retry" && state.attempts > 1) ||
                        (scenario === "delayed" && performance.now() - started >= 250)) return;
                    for (const element of watched) {
                        if (element.isConnected) {
                            held.set(element, element.parentElement);
                            element.remove();
                        }
                    }
                };
                state.observer = new MutationObserver(block);
                state.observer.observe(document.body, { childList: true, subtree: true });
                proto.addDOMWidget = function (...args) {
                    if (args[0] !== "webui_prompt_frontend") return original.apply(this, args);
                    state.owner ||= this;
                    if (this !== state.owner) return original.apply(this, args);
                    if (++state.attempts > 20) throw new Error("Test safety limit: unbounded Bridge remount loop");
                    const widget = original.apply(this, args);
                    watched.add(args[2]);
                    const remove = widget.onRemove;
                    widget.onRemove = function (...values) {
                        state.unregisters++;
                        return remove?.apply(this, values);
                    };
                    return widget;
                };
                state.restore = () => { proto.addDOMWidget = original; state.observer.disconnect(); };
                const node = window.LiteGraph.createNode("WebUIPromptBridge");
                node.pos = [280, 200];
                app.graph.add(node);
                state.node = node;
                node.widgets.find(w => w.name === "positive_prompt").value = "mount recovery test";
                // Prove recovery doesn't depend on a renderer calling this hook.
                if (scenario !== "normal") node.onDrawForeground = () => {};
                if (scenario === "delayed") setTimeout(() => {
                    state.observer.disconnect();
                    for (const [element, parent] of held) {
                        if (parent.isConnected && node.__webuiBridgePanel === element) parent.append(element);
                    }
                }, 250);
                app.canvas.ds.scale = 0.75;
                app.canvas.ds.offset = [40, 0];
                app.canvas.setDirty(true, true);
            }, { scenario });
            await page.waitForFunction(scenario => {
                const state = window.__bridgeMountTest;
                const node = state?.node;
                if (scenario === "blocked") return !!node?.__webuiBridgePanelFailureWidget;
                return !!node?.__webuiBridgePanel?.isConnected &&
                    (scenario !== "retry" || state.attempts === 2) &&
                    (scenario !== "delayed" || performance.now() - node.__webuiBridgePanelMountStartedAt >= 250);
            }, scenario, { timeout: 15000 }).catch(async error => {
                console.error(await page.evaluate(() => {
                    const state = window.__bridgeMountTest;
                    const node = state?.node;
                    return { attempts: state?.attempts, connected: !!node?.__webuiBridgePanel?.isConnected,
                        error: node?.__webuiBridgePanelInstallError, retries: node?.__webuiBridgeDetachedPanelRetries,
                        sinceMount: performance.now() - node?.__webuiBridgePanelMountStartedAt,
                        inGraph: window.app.graph._nodes.includes(node), hasGraph: !!node?.graph,
                        panelCount: document.querySelectorAll(".webui-bridge-panel").length };
                }));
                await page.screenshot({ path: `${out}/failure-${vue ? "vue" : "litegraph"}-${scenario}.png` });
                throw error;
            });
            const result = await page.evaluate(() => {
                const { node, attempts, unregisters } = window.__bridgeMountTest;
                const positive = node.widgets.find(w => w.name === "positive_prompt");
                return { attempts, unregisters, connected: !!node.__webuiBridgePanel?.isConnected,
                    nativeVisible: !positive.hidden && !positive.__webuiBridgeHidden,
                    value: positive.value, failure: !!node.__webuiBridgePanelFailureWidget,
                    domWidgets: node.widgets.filter(w => w.name === "webui_prompt_frontend").length };
            });
            assert.equal(result.attempts, scenario === "blocked" || scenario === "retry" ? 2 : 1,
                `${vue ? "Vue" : "LiteGraph"}/${scenario}: ${JSON.stringify(result)}`);
            assert.equal(result.value, "mount recovery test");
            assert.equal(result.nativeVisible, scenario === "blocked");
            assert.equal(result.domWidgets, scenario === "blocked" ? 0 : 1);
            assert.equal(result.unregisters, scenario === "blocked" ? 2 : scenario === "retry" ? 1 : 0);
            if (scenario === "blocked") {
                const native = page.locator("textarea").filter({ visible: true });
                assert(await native.count() > 0, "Restored native textarea is not rendered");
                assert(await page.evaluate(() => {
                    const node = window.__bridgeMountTest.node;
                    return node.widgets[0] === node.__webuiBridgePanelFailureWidget;
                }), "Retry control is buried below the native parameter list");
            } else {
                await page.locator(".webui-bridge-positive-prompt-row textarea").fill("mount recovery test");
                assert(await page.locator(".webui-bridge-panel").isVisible());
            }
            await page.screenshot({ path: `${out}/${vue ? "vue" : "litegraph"}-${scenario}.png` });
            if (scenario === "blocked") {
                await page.evaluate(() => {
                    const state = window.__bridgeMountTest;
                    state.restore();
                    state.node.__webuiBridgePanelFailureWidget.callback();
                });
                await page.locator(".webui-bridge-positive-prompt-row textarea").waitFor({ state: "visible" });
                const value = await page.locator(".webui-bridge-positive-prompt-row textarea").inputValue();
                assert.equal(value, "mount recovery test", "Manual retry lost the user's prompt");
            }
            await page.evaluate(() => window.__bridgeMountTest.restore());
            results.push({ renderer: vue ? "Vue" : "LiteGraph", scenario, ...result });
        await context.close();
      }
    }
    await writeFile(`${out}/results.json`, JSON.stringify({ ok: true, results }, null, 2), "utf8");
    console.log(JSON.stringify({ ok: true, results }, null, 2));
} finally {
    await browser.close();
}
