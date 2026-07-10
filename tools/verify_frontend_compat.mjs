import { access, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const comfyRoot = path.resolve(repoRoot, "..", "..");
const defaultBaseUrl = "http://127.0.0.1:8188";
const bridgeImageInputNode = "WebUIPromptBridgeImageInput";
const switchIds = [10, 15, 19, 24, 40, 47, 196, 197, 198];
const rightColumnIds = [6, 8, 9, 11, 199, 200, 201, 202, 221];
const customLayoutIds = [];
const oldSwitchPositions = new Map([
    [10, [1040, 60]],
    [15, [1040, 155]],
    [19, [1040, 250]],
    [24, [1040, 345]],
    [40, [1040, 440]],
    [47, [1040, 535]],
    [196, [1040, 660]],
    [197, [1040, 755]],
    [198, [1040, 850]],
]);
const oldRightPositions = new Map([
    [6, [1390, 60]],
    [8, [1760, 60]],
    [9, [1760, 590]],
    [11, [1380, 40]],
    [63, [1298, 106]],
    [73, [1298, 201]],
    [79, [1298, 296]],
    [85, [1298, 391]],
    [108, [1298, 486]],
    [120, [1298, 581]],
    [199, [1420, 660]],
    [200, [1420, 755]],
    [201, [1420, 850]],
    [202, [1685, 850]],
    [221, [1420, 945]],
]);
customLayoutIds.push(...new Set([...switchIds, ...rightColumnIds, ...oldRightPositions.keys()]));

function parseArgs() {
    const options = {
        baseUrl: process.env.COMFYUI_URL || defaultBaseUrl,
        queue: false,
        headed: false,
        focusedFixes: false,
    };
    for (const arg of process.argv.slice(2)) {
        if (arg === "--queue") {
            options.queue = true;
        } else if (arg === "--headed") {
            options.headed = true;
        } else if (arg === "--focused-fixes") {
            options.focusedFixes = true;
        } else if (arg.startsWith("--url=")) {
            options.baseUrl = arg.slice("--url=".length);
        } else {
            throw new Error(`Unknown argument: ${arg}`);
        }
    }
    return options;
}

async function importPlaywright() {
    const candidates = [
        "playwright",
        process.env.PLAYWRIGHT_IMPORT,
        "C:/Users/Administrator/AppData/Roaming/npm/node_modules/playwright/index.mjs",
        "C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs",
    ].filter(Boolean);
    const errors = [];
    for (const candidate of candidates) {
        try {
            if (/^[A-Za-z]:[\\/]/.test(candidate)) {
                await access(candidate);
                return await import(pathToFileURL(candidate).href);
            }
            return await import(candidate);
        } catch (error) {
            errors.push(`${candidate}: ${error.message}`);
        }
    }
    throw new Error(`Unable to import Playwright. Tried:\n${errors.join("\n")}`);
}

function assert(condition, message, details = null) {
    if (!condition) {
        const suffix = details ? `\n${JSON.stringify(details, null, 2)}` : "";
        throw new Error(`${message}${suffix}`);
    }
}

async function fetchBridgeSettings(baseUrl) {
    const response = await fetch(`${baseUrl}/webui_prompt_bridge/settings`, { cache: "no-store" });
    assert(response.ok, "Bridge settings GET failed", { status: response.status });
    return await response.json();
}

async function saveBridgeSettingsForTest(baseUrl, settings) {
    const response = await fetch(`${baseUrl}/webui_prompt_bridge/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
    });
    const text = await response.text();
    assert(response.ok, "Bridge settings POST failed", { status: response.status, text });
    return JSON.parse(text);
}

function workflowPositions(workflow, ids) {
    const positions = {};
    for (const id of ids) {
        const node = workflow.nodes?.find((item) => item.id === id);
        positions[id] = node?.pos ? Array.from(node.pos) : null;
    }
    return positions;
}

function changedPositions(before, after, ids) {
    const changes = [];
    for (const id of ids) {
        const from = before?.[id];
        const to = after?.[id];
        if (!Array.isArray(from) || !Array.isArray(to) || from.length < 2 || to.length < 2 ||
            Math.abs(from[0] - to[0]) > 0.5 || Math.abs(from[1] - to[1]) > 0.5) {
            changes.push({ id, before: from ?? null, after: to ?? null });
        }
    }
    return changes;
}

function mockLoraItems(count = 160) {
    return Array.from({ length: count }, (_, index) => {
        const name = `mock-folder/mock-lora-${String(index + 1).padStart(3, "0")}.safetensors`;
        const alias = name.replace(/\.[^.]+$/, "");
        return {
            name,
            alias,
            folder: "mock-folder",
            file_name: name.split("/").pop(),
            base_name: alias.split("/").pop(),
            aliases: [],
            metadata_title: "",
            metadata_output_name: "",
            thumbnail: "",
            thumbnail_unknown: true,
            description: "",
            user_metadata: {},
            manual_category: "",
            category: "",
            activation_text: "",
            negative_text: "",
            preferred_weight: 0,
            sd_version: "",
            notes: "",
            training_tags: [],
            search_terms: name,
            created: 0,
            modified: 0,
            prompt: `<lora:${alias}:1>`,
        };
    });
}

async function graphPositions(page, ids) {
    return await page.evaluate((nodeIds) => {
        const positions = {};
        for (const id of nodeIds) {
            const node = window.app.graph.getNodeById(id);
            positions[id] = node?.pos ? Array.from(node.pos) : null;
        }
        return positions;
    }, ids);
}

async function dragElementCenterBy(page, selector, deltaX = 0, deltaY = 0, nth = 0) {
    const box = await page.evaluate(({ selector, nth }) => {
        const element = [...document.querySelectorAll(selector)][nth];
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            width: rect.width,
            height: rect.height,
            text: element.textContent || "",
        };
    }, { selector, nth });
    assert(box, `Could not find draggable element ${selector}`, { selector, nth });
    await page.mouse.move(box.x, box.y);
    await page.mouse.down();
    await page.mouse.move(box.x + deltaX, box.y + deltaY, { steps: 14 });
    await page.mouse.up();
    await page.waitForTimeout(900);
    return box;
}

async function dragElementCenter(page, selector, deltaY, nth = 0) {
    return await dragElementCenterBy(page, selector, 0, deltaY, nth);
}

async function bridgeBottomBlankMetrics(page, label = "metrics") {
    return await page.evaluate((metricLabel) => {
        const panel = document.querySelector(".webui-bridge-panel");
        const topRow = document.querySelector(".webui-bridge-toprow");
        const extra = document.querySelector(".webui-bridge-extra");
        const splitter = document.querySelector(".webui-bridge-panel-splitter");
        const negativeRow = [...document.querySelectorAll(".webui-bridge-prompt-row")]
            .find((row) => !row.classList.contains("webui-bridge-positive-prompt-row"));
        const bridge = window.app.graph._nodes.find((node) => node.type === "WebUIPromptBridge");
        const rect = (element) => {
            if (!element) return null;
            const item = element.getBoundingClientRect();
            return {
                top: item.top,
                bottom: item.bottom,
                height: item.height,
            };
        };
        return {
            label: metricLabel,
            blankBelowExtra: panel && extra ? panel.getBoundingClientRect().bottom - extra.getBoundingClientRect().bottom - 8 : null,
            panel: rect(panel),
            topRow: rect(topRow),
            splitter: rect(splitter),
            extra: rect(extra),
            negativeCollapsed: Boolean(negativeRow?.classList.contains("collapsed")),
            layoutState: bridge?.__webuiBridgePanel?.__webuiBridgeGetLayoutState?.() || null,
            extraMaxHeight: extra?.__webuiBridgeMaxHeight || null,
            nodeSize: Array.from(bridge?.size || []),
        };
    }, label);
}

async function bridgeLayoutStabilitySnapshot(page, label = "metrics") {
    return await page.evaluate((metricLabel) => {
        const bridge = window.app.graph._nodes.find((node) => node.type === "WebUIPromptBridge");
        const panel = document.querySelector(".webui-bridge-panel");
        const topRow = document.querySelector(".webui-bridge-toprow");
        const action = document.querySelector(".webui-bridge-action-column");
        const extra = document.querySelector(".webui-bridge-extra");
        const regionalInputs = [...document.querySelectorAll(".webui-bridge-regional-canvas-size")];
        const widgetValue = (name) => bridge?.widgets?.find((widget) => widget.name === name)?.value ?? null;
        const rect = (element) => {
            if (!element) return null;
            const item = element.getBoundingClientRect();
            return {
                left: Math.round(item.left),
                top: Math.round(item.top),
                width: Math.round(item.width),
                height: Math.round(item.height),
                bottom: Math.round(item.bottom),
            };
        };
        const promptContentBlank = () => {
            const prompts = document.querySelector(".webui-bridge-prompts");
            if (!prompts) return null;
            const promptsRect = prompts.getBoundingClientRect();
            const childBottoms = [...prompts.children]
                .filter((child) => child.getClientRects?.().length && getComputedStyle(child).display !== "none")
                .map((child) => child.getBoundingClientRect().bottom);
            if (!childBottoms.length) return null;
            return Math.round(promptsRect.bottom - Math.max(...childBottoms));
        };
        const style = topRow ? getComputedStyle(topRow) : null;
        return {
            label: metricLabel,
            nodeSize: bridge?.size ? Array.from(bridge.size).map((value) => Math.round(value)) : null,
            desiredSize: bridge?.__webuiBridgeDesiredSize ? Array.from(bridge.__webuiBridgeDesiredSize).map((value) => Math.round(value)) : null,
            savedSize: bridge?.__webuiBridgeSavedPanelSize ? Array.from(bridge.__webuiBridgeSavedPanelSize).map((value) => Math.round(value)) : null,
            canvasOffset: window.app.canvas.ds.offset ? Array.from(window.app.canvas.ds.offset).map((value) => Math.round(value)) : null,
            panel: rect(panel),
            topRow: rect(topRow),
            action: rect(action),
            extra: rect(extra),
            sidebarWidthVar: style?.getPropertyValue("--webui-bridge-sidebar-width")?.trim() || null,
            gridTemplate: style?.gridTemplateColumns || null,
            localTopHeight: localStorage.getItem("webui-bridge-toprow-height"),
            localExtraHeight: localStorage.getItem("webui-bridge-extra-height"),
            localActionWidth: localStorage.getItem("webui-bridge-action-column-width"),
            layoutState: bridge?.__webuiBridgePanel?.__webuiBridgeGetLayoutState?.() || null,
            promptContentBlank: promptContentBlank(),
            regional: {
                inputValues: regionalInputs.slice(0, 2).map((input) => input.value),
                widgetWidth: widgetValue("regional_canvas_width"),
                widgetHeight: widgetValue("regional_canvas_height"),
                auto: widgetValue("regional_canvas_auto"),
            },
        };
    }, label);
}

function assertRoundedArrayEqual(actual, expected, message, details = null) {
    const same = Array.isArray(actual) &&
        Array.isArray(expected) &&
        actual.length === expected.length &&
        actual.every((value, index) => Math.abs(value - expected[index]) <= 1);
    assert(same, message, details || { actual, expected });
}

function assertBridgeLayoutStable(before, after, message) {
    for (const key of ["nodeSize", "desiredSize", "savedSize"]) {
        assertRoundedArrayEqual(after[key], before[key], `${message}: ${key} changed`, { before, after });
    }
    for (const key of ["panel", "topRow", "action", "extra"]) {
        for (const dim of ["width", "height"]) {
            const from = before[key]?.[dim];
            const to = after[key]?.[dim];
            assert(Number.isFinite(from) && Number.isFinite(to) && Math.abs(from - to) <= 2,
                `${message}: ${key}.${dim} changed`, { before, after });
        }
    }
    assert(before.sidebarWidthVar === after.sidebarWidthVar, `${message}: sidebar CSS width changed`, { before, after });
    assert(before.gridTemplate === after.gridTemplate, `${message}: top row grid changed`, { before, after });
    assert(before.localActionWidth === after.localActionWidth, `${message}: sidebar width preference changed`, { before, after });
}

async function promptInnerLayoutSnapshot(page, label = "metrics") {
    return await page.evaluate((metricLabel) => {
        const rect = (selector) => {
            const element = document.querySelector(selector);
            if (!element) return null;
            const box = element.getBoundingClientRect();
            return {
                top: Math.round(box.top),
                height: Math.round(box.height),
                bottom: Math.round(box.bottom),
            };
        };
        const bridge = window.app.graph._nodes.find((node) => node.type === "WebUIPromptBridge");
        const grid = document.querySelector(".webui-bridge-card-grid");
        return {
            label: metricLabel,
            nodeSize: bridge?.size ? Array.from(bridge.size).map((value) => Math.round(value)) : null,
            topRow: rect(".webui-bridge-toprow"),
            extra: rect(".webui-bridge-extra"),
            positiveTextarea: rect(".webui-bridge-positive-prompt-row textarea"),
            positiveChips: rect(".webui-bridge-positive-prompt-row .webui-bridge-prompt-chips"),
            negativeTextarea: rect(".webui-bridge-prompt-row:not(.webui-bridge-positive-prompt-row) textarea"),
            grid: grid ? {
                top: Math.round(grid.getBoundingClientRect().top),
                height: Math.round(grid.getBoundingClientRect().height),
                scrollTop: Math.round(grid.scrollTop || 0),
            } : null,
            local: {
                loraScroll: localStorage.getItem("webui-bridge-lora-scroll-top"),
                positiveText: localStorage.getItem("webui-bridge-textarea-height-prompt"),
                negativeText: localStorage.getItem("webui-bridge-textarea-height-negative-prompt"),
                positiveChip: localStorage.getItem("webui-bridge-chip-size-positive"),
                negativeChip: localStorage.getItem("webui-bridge-chip-size-negative"),
                positiveTag: localStorage.getItem("webui-bridge-aio-panel-height-positive"),
                negativeTag: localStorage.getItem("webui-bridge-aio-panel-height-negative"),
            },
        };
    }, label);
}

async function waitForComfy(page, baseUrl) {
    const response = await page.goto(`${baseUrl}/?webui_bridge_verify=${Date.now()}`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
    });
    assert(response?.ok(), `ComfyUI did not return OK at ${baseUrl}`, {
        status: response?.status(),
    });
    await page.waitForFunction(() => Boolean(window.app?.graph && window.app?.canvas && window.LiteGraph), null, {
        timeout: 60000,
    });
}

async function loadWorkflow() {
    const workflowPath = path.join(repoRoot, "workflows", "anima-webui-prompt-bridge.json");
    return JSON.parse(await readFile(workflowPath, "utf8"));
}

function makeOldWorkflow(workflow) {
    const oldWorkflow = JSON.parse(JSON.stringify(workflow));
    delete oldWorkflow.extra;
    for (const node of oldWorkflow.nodes || []) {
        if (oldSwitchPositions.has(node.id)) node.pos = [...oldSwitchPositions.get(node.id)];
        if (oldRightPositions.has(node.id)) node.pos = [...oldRightPositions.get(node.id)];
        if (node.type === "WebUIPromptBridge" && Array.isArray(node.widgets_values)) {
            node.widgets_values = node.widgets_values.slice(0, 6);
        }
    }
    return oldWorkflow;
}

function makeCustomRightSideWorkflow(workflow) {
    const customWorkflow = JSON.parse(JSON.stringify(workflow));
    for (const node of customWorkflow.nodes || []) {
        if (switchIds.includes(node.id)) {
            node.pos = [1900, Number(node.pos?.[1]) || 60];
        } else if (oldRightPositions.has(node.id)) {
            const y = Number(node.pos?.[1]) || oldRightPositions.get(node.id)[1];
            const tiny = ["SetNode", "GetNode"].includes(String(node.type || "")) && Number(node.size?.[0] || 0) <= 90;
            node.pos = [tiny ? 2184 : 2400 + ((node.id % 4) * 90), y];
        } else if (rightColumnIds.includes(node.id)) {
            node.pos = [2400 + ((node.id % 4) * 90), Number(node.pos?.[1]) || 60];
        }
    }
    return customWorkflow;
}

async function screenshot(page, name) {
    const outDir = path.join(repoRoot, "output", "playwright");
    await mkdir(outDir, { recursive: true });
    const file = path.join(outDir, name);
    await page.screenshot({ path: file, fullPage: false });
    return file;
}

async function newComfyPage(browser, baseUrl, consoleMessages, viewport = { width: 1400, height: 1000 }, beforeGoto = null) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();
    page.on("console", (message) => {
        consoleMessages.push({ type: message.type(), text: message.text() });
    });
    page.on("pageerror", (error) => {
        consoleMessages.push({ type: "pageerror", text: String(error?.stack || error) });
    });
    if (beforeGoto) await beforeGoto(page);
    await waitForComfy(page, baseUrl);
    return { context, page };
}

async function clickSwitch(page, id) {
    const before = await page.evaluate((switchId) => {
        const node = window.app.graph.getNodeById(switchId);
        if (!node?.widgets?.[0]) throw new Error(`Missing switch widget ${switchId}`);
        node.widgets[0].value = false;
        if (Array.isArray(node.widgets_values)) node.widgets_values[0] = false;
        const canvasRect = document.querySelector("#graph-canvas").getBoundingClientRect();
        const graphPoint = [node.pos[0] + 80, node.pos[1] + (node.widgets[0].y || 26) + 9];
        const canvasPoint = window.app.canvas.convertOffsetToCanvas(graphPoint);
        const client = [canvasPoint[0] + canvasRect.left, canvasPoint[1] + canvasRect.top];
        const hit = window.app.graph.getNodeOnPos(graphPoint[0], graphPoint[1], null, 0);
        const dom = document.elementFromPoint(client[0], client[1]);
        return {
            title: node.title,
            value: node.widgets[0].value,
            client,
            graphHitId: hit?.id ?? null,
            graphHitType: hit?.type ?? null,
            dom: dom ? `${dom.tagName}.${String(dom.className || "").replace(/\s+/g, ".")}` : null,
        };
    }, id);
    await page.mouse.click(before.client[0], before.client[1]);
    await page.waitForTimeout(180);
    const after = await page.evaluate((switchId) => window.app.graph.getNodeById(switchId)?.widgets?.[0]?.value, id);
    return { id, ...before, after };
}

async function verifyBridgeDoesNotCancelCanvasWidgets(browser, baseUrl) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1200, height: 900 });
    try {
        await page.evaluate(() => {
            window.app.graph.clear();
            const bridge = window.LiteGraph.createNode("WebUIPromptBridge");
            bridge.id = 950000;
            bridge.pos = [60, 40];
            window.app.graph.add(bridge);
            const sw = window.LiteGraph.createNode("ImpactBoolean");
            sw.id = 950001;
            sw.title = "Switch beside bridge after fix";
            sw.pos = [1300, 120];
            window.app.graph.add(sw);
            window.app.canvas.ds.offset = [-820, 70];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        });
        await page.waitForTimeout(2000);
        const results = [];
        for (const point of [[20, 35], [80, 35], [140, 35], [220, 35]]) {
            const result = await page.evaluate(([gxOff, gyOff]) => {
                const node = window.app.graph.getNodeById(950001);
                node.widgets[0].value = false;
                const canvasRect = document.querySelector("#graph-canvas").getBoundingClientRect();
                const graphPoint = [node.pos[0] + gxOff, node.pos[1] + gyOff];
                const canvasPoint = window.app.canvas.convertOffsetToCanvas(graphPoint);
                const client = [canvasPoint[0] + canvasRect.left, canvasPoint[1] + canvasRect.top];
                const hit = window.app.graph.getNodeOnPos(graphPoint[0], graphPoint[1], null, 0);
                return { client, graphHitId: hit?.id ?? null, before: node.widgets[0].value };
            }, point);
            await page.mouse.click(result.client[0], result.client[1]);
            await page.waitForTimeout(180);
            result.after = await page.evaluate(() => window.app.graph.getNodeById(950001).widgets[0].value);
            results.push(result);
        }
        await screenshot(page, "compat-minimal-with-bridge.png");
        const pointerCancelCount = consoleMessages.filter((message) => message.text.includes("Pointer cancel")).length;
        assert(results.every((result) => result.after === true), "ImpactBoolean did not toggle beside WebUIPromptBridge", results);
        assert(pointerCancelCount === 0, "Canvas pointer was canceled while clicking a normal widget", {
            pointerCancelCount,
        });
        return { toggles: results.length, pointerCancelCount };
    } finally {
        await context.close();
    }
}

async function verifyCommonWidgetCompatibility(browser, baseUrl) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1200, height: 900 });
    try {
        await page.evaluate(() => {
            window.app.graph.clear();
            const bridge = window.LiteGraph.createNode("WebUIPromptBridge");
            bridge.id = 960000;
            bridge.pos = [60, 40];
            window.app.graph.add(bridge);
            const specs = [
                ["ImpactBoolean", 960001, [1300, 100], false],
                ["BOOLConstant", 960002, [1300, 190], true],
                ["FloatConstant", 960003, [1300, 280], 0],
                ["INTConstant", 960004, [1300, 370], 0],
            ];
            for (const [type, id, pos, value] of specs) {
                const node = window.LiteGraph.createNode(type);
                if (!node) throw new Error(`Missing node type ${type}`);
                node.id = id;
                node.pos = pos;
                if (node.widgets?.[0]) node.widgets[0].value = value;
                if (Array.isArray(node.widgets_values)) node.widgets_values[0] = value;
                window.app.graph.add(node);
            }
            window.app.canvas.ds.offset = [-820, 70];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        });
        await page.waitForTimeout(2000);
        const results = [];
        for (const id of [960001, 960002, 960003, 960004]) {
            const before = await page.evaluate((nodeId) => {
                const node = window.app.graph.getNodeById(nodeId);
                if (!node?.widgets?.[0]) throw new Error(`Missing widget for ${nodeId}`);
                const canvasRect = document.querySelector("#graph-canvas").getBoundingClientRect();
                const isNumber = node.widgets[0].type === "number";
                const graphPoint = [
                    node.pos[0] + (isNumber ? node.size[0] - 22 : Math.min(node.size[0] - 34, 232)),
                    node.pos[1] + 35,
                ];
                const canvasPoint = window.app.canvas.convertOffsetToCanvas(graphPoint);
                const client = [canvasPoint[0] + canvasRect.left, canvasPoint[1] + canvasRect.top];
                const hit = window.app.graph.getNodeOnPos(graphPoint[0], graphPoint[1], null, 0);
                return {
                    id: nodeId,
                    type: node.type,
                    widgetType: node.widgets[0].type,
                    before: node.widgets[0].value,
                    client,
                    graphHitId: hit?.id ?? null,
                };
            }, id);
            await page.mouse.click(before.client[0], before.client[1]);
            await page.waitForTimeout(220);
            before.after = await page.evaluate((nodeId) => window.app.graph.getNodeById(nodeId)?.widgets?.[0]?.value, id);
            results.push(before);
        }
        await screenshot(page, "compat-common-widget-clicks.png");
        const pointerCancelCount = consoleMessages.filter((message) => message.text.includes("Pointer cancel")).length;
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(results.every((result) => result.graphHitId === result.id), "Common widget click point is not owned by its node", results);
        assert(results.every((result) => result.after !== result.before), "A common widget did not respond to click beside WebUIPromptBridge", results);
        assert(pointerCancelCount === 0, "Pointer cancel appeared while clicking common widgets", {
            pointerCancelCount,
        });
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during common widget compatibility check", bridgeConsoleErrors);
        return {
            clickedWidgets: results.map((item) => `${item.type}:${item.widgetType}`),
            pointerCancelCount,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyFullWorkflowSwitches(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "anima-webui-prompt-bridge.json",
            });
        }, workflow);
        await page.waitForTimeout(2200);
        await page.evaluate(() => {
            window.app.canvas.ds.offset = [-820, 70];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.deselectAll?.();
            window.app.canvas.setDirty(true, true);
        });
        await page.waitForTimeout(400);
        const results = [];
        for (const id of switchIds) results.push(await clickSwitch(page, id));
        await screenshot(page, "compat-full-workflow-switches.png");
        const pointerCancelCount = consoleMessages.filter((message) => message.text.includes("Pointer cancel")).length;
        assert(results.every((result) => result.graphHitId === result.id), "Switch click point is not owned by its switch node", results);
        assert(results.every((result) => result.after === true), "Not every workflow switch toggled to true", results);
        assert(pointerCancelCount === 0, "Pointer cancel appeared during full workflow switch clicking", {
            pointerCancelCount,
        });
        return { toggles: results.length, pointerCancelCount };
    } finally {
        await context.close();
    }
}

async function verifyCurrentWorkflowLayoutIdempotency(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages);
    const ids = [...switchIds, ...rightColumnIds];
    try {
        const expected = workflowPositions(workflow, ids);
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "current-layout-idempotency.json",
            });
        }, workflow);
        await page.waitForTimeout(2200);
        const afterInitialLoad = await graphPositions(page, ids);
        await page.evaluate(async () => {
            const graphData = window.app.graph.serialize();
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "current-layout-idempotency-reload.json",
            });
        });
        await page.waitForTimeout(2200);
        const afterReload = await graphPositions(page, ids);
        const changedFromWorkflow = changedPositions(expected, afterInitialLoad, ids);
        const changedAfterReload = changedPositions(afterInitialLoad, afterReload, ids);
        await screenshot(page, "compat-current-layout-idempotency.png");
        assert(changedFromWorkflow.length === 0, "Current workflow layout changed while loading", changedFromWorkflow);
        assert(changedAfterReload.length === 0, "Current workflow layout changed after a second load", changedAfterReload);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors while loading current workflow", bridgeConsoleErrors);
        return {
            checkedNodes: ids.length,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyCustomWorkflowLayoutPreserved(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages);
    const customWorkflow = makeCustomRightSideWorkflow(workflow);
    const expected = workflowPositions(customWorkflow, customLayoutIds);
    try {
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "custom-layout-preservation.json",
            });
        }, customWorkflow);
        await page.waitForTimeout(2600);
        const afterLoad = await graphPositions(page, customLayoutIds);
        const changedAfterLoad = changedPositions(expected, afterLoad, customLayoutIds);
        await page.evaluate(async () => {
            const graphData = window.app.graph.serialize();
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "custom-layout-preservation-reload.json",
            });
        });
        await page.waitForTimeout(2200);
        const afterReload = await graphPositions(page, customLayoutIds);
        const changedAfterReload = changedPositions(afterLoad, afterReload, customLayoutIds);
        await screenshot(page, "compat-custom-layout-preserved.png");
        assert(changedAfterLoad.length === 0, "Custom control-node layout changed while loading", changedAfterLoad);
        assert(changedAfterReload.length === 0, "Custom control-node layout changed after reload", changedAfterReload);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during custom layout preservation check", bridgeConsoleErrors);
        return {
            checkedNodes: customLayoutIds.length,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyBridgeUiErgonomics(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "ui-ergonomics.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        }, workflow);
        await page.waitForTimeout(3000);
        const scrollReport = await page.evaluate(() => {
            const prompts = document.querySelector(".webui-bridge-prompts");
            const positiveRow = document.querySelector(".webui-bridge-positive-prompt-row");
            const extra = document.querySelector(".webui-bridge-extra");
            if (!prompts || !positiveRow || !extra) {
                return { missing: { prompts: !prompts, positiveRow: !positiveRow, extra: !extra } };
            }
            const beforeTop = positiveRow.getBoundingClientRect().top;
            prompts.scrollTop = Math.min(220, prompts.scrollHeight - prompts.clientHeight);
            const afterTop = positiveRow.getBoundingClientRect().top;
            return {
                beforeTop,
                afterTop,
                movedBy: beforeTop - afterTop,
                promptsScrollableBy: prompts.scrollHeight - prompts.clientHeight,
                extraHeight: extra.getBoundingClientRect().height,
                extraMaxHeight: extra.__webuiBridgeMaxHeight || null,
            };
        });
        assert(!scrollReport.missing, "Bridge UI did not render expected prompt/LoRA regions", scrollReport);
        assert(scrollReport.promptsScrollableBy > 120, "Prompt column is not scrollable enough to verify wheel behavior", scrollReport);
        assert(scrollReport.movedBy > 80, "Positive prompt row stayed fixed while prompt column scrolled", scrollReport);
        assert(scrollReport.extraMaxHeight === 520, "LoRA inline max height was not capped at 520px", scrollReport);

        const collapseReport = await page.evaluate(() => {
            const prompts = document.querySelector(".webui-bridge-prompts");
            if (prompts) prompts.scrollTop = 0;
            const collapseButton = [...document.querySelectorAll(".webui-bridge-collapse-btn")]
                .find((button) => /折叠反向|展开反向/.test(button.textContent || ""));
            if (!collapseButton) return { missingCollapseButton: true };
            if ((collapseButton.textContent || "").includes("折叠")) collapseButton.click();
            return { clicked: true };
        });
        assert(!collapseReport.missingCollapseButton, "Negative prompt collapse button was not found", collapseReport);
        await page.waitForTimeout(1500);

        const layoutReport = await page.evaluate(() => {
            const panel = document.querySelector(".webui-bridge-panel");
            const negativeRow = [...document.querySelectorAll(".webui-bridge-prompt-row")]
                .find((row) => !row.classList.contains("webui-bridge-positive-prompt-row"));
            const extra = document.querySelector(".webui-bridge-extra");
            const topRow = document.querySelector(".webui-bridge-toprow");
            const rect = (element) => {
                if (!element) return null;
                const item = element.getBoundingClientRect();
                return { top: item.top, bottom: item.bottom, height: item.height };
            };
            return {
                collapsed: negativeRow?.classList.contains("collapsed") || false,
                panel: rect(panel),
                topRow: rect(topRow),
                negative: rect(negativeRow),
                extra: rect(extra),
                blankBelowExtra: panel && extra ? panel.getBoundingClientRect().bottom - extra.getBoundingClientRect().bottom : null,
                extraMaxHeight: extra?.__webuiBridgeMaxHeight || null,
            };
        });
        await screenshot(page, "compat-ui-ergonomics.png");
        assert(layoutReport.collapsed, "Negative prompt row did not collapse", layoutReport);
        assert(layoutReport.negative?.height <= 48, "Collapsed negative prompt row remained too tall", layoutReport);
        assert(layoutReport.extra?.height <= 520, "LoRA region exceeded its inline height cap", layoutReport);
        assert(layoutReport.extra?.height >= 180, "LoRA region did not reclaim space after collapsing the negative prompt", layoutReport);
        assert(layoutReport.blankBelowExtra !== null && layoutReport.blankBelowExtra <= 36, "Large blank space remained below LoRA after negative prompt collapse", layoutReport);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during UI ergonomics check", bridgeConsoleErrors);
        return {
            promptScrollMovedBy: Math.round(scrollReport.movedBy),
            loraHeightAfterNegativeCollapse: Math.round(layoutReport.extra.height),
            blankBelowExtra: Math.round(layoutReport.blankBelowExtra),
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyBridgeImageInputPanelErgonomics(browser, baseUrl) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1000, height: 760 });
    try {
        await page.evaluate((nodeType) => {
            window.app.graph.clear();
            const node = window.LiteGraph.createNode(nodeType);
            if (!node) throw new Error(`Missing node type ${nodeType}`);
            node.id = 950020;
            node.pos = [80, 60];
            window.app.graph.add(node);
            window.app.canvas.setDirty(true, true);
        }, bridgeImageInputNode);
        await page.waitForSelector(".webui-bridge-image-input-panel", { timeout: 20000 });
        await page.waitForTimeout(600);
        const metrics = await page.evaluate(() => {
            const panel = document.querySelector(".webui-bridge-image-input-panel");
            const status = panel?.querySelector(".webui-bridge-image-input-status");
            const panelRect = panel?.getBoundingClientRect();
            const statusRect = status?.getBoundingClientRect();
            return {
                enableRows: panel?.querySelectorAll(".webui-bridge-image-input-enable").length || 0,
                clientHeight: panel?.clientHeight || 0,
                scrollHeight: panel?.scrollHeight || 0,
                overflowY: panel ? getComputedStyle(panel).overflowY : "",
                statusInside: Boolean(panelRect && statusRect && statusRect.bottom <= panelRect.bottom + 2),
                nodeSize: Array.from(window.app.graph.getNodeById(950020)?.size || []),
            };
        });
        assert(metrics.enableRows === 0, "Standalone image input still shows a non-functional enable switch", metrics);
        assert(metrics.statusInside || ["auto", "scroll"].includes(metrics.overflowY), "Image input panel clips its bottom controls", metrics);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(!bridgeConsoleErrors.length, "Bridge image input emitted console errors", bridgeConsoleErrors);
        return { ...metrics, bridgeConsoleErrors: bridgeConsoleErrors.length };
    } finally {
        await context.close();
    }
}

async function verifyStartupWizardRequiresLoadedConfiguration(browser, baseUrl) {
    const scenarios = [
        { label: "settings failed", failSettings: true, failWebui: false, expectWizard: false },
        { label: "webui status failed", failSettings: false, failWebui: true, expectWizard: false },
        { label: "both loaded and unconfigured", failSettings: false, failWebui: false, expectWizard: true },
    ];
    const results = [];
    for (const scenario of scenarios) {
        const consoleMessages = [];
        const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1200, height: 900 }, async (newPage) => {
            await newPage.addInitScript(() => {
                localStorage.setItem("webui-bridge-node-tutorial-seen-v2", "1");
                window.__webuiBridgeStartupWizardShown = false;
            });
            await newPage.route("**/webui_prompt_bridge/settings", async (route) => {
                if (scenario.failSettings) {
                    await route.fulfill({
                        status: 503,
                        contentType: "application/json",
                        body: JSON.stringify({ error: "mock settings failure" }),
                    });
                    return;
                }
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({
                        settings: {
                            show_startup_wizard: true,
                            node_tutorial_popup: "first_time",
                        },
                        custom_tag_count: 0,
                        assets: null,
                        module_assets: null,
                    }),
                });
            });
            await newPage.route("**/webui_prompt_bridge/webui_integration", async (route) => {
                if (scenario.failWebui) {
                    await route.fulfill({
                        status: 503,
                        contentType: "application/json",
                        body: JSON.stringify({ error: "mock webui status failure" }),
                    });
                    return;
                }
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({ configured: false, webui_root: "", checks: {} }),
                });
            });
        });
        try {
            await page.evaluate(() => {
                window.app.graph.clear();
                const bridge = window.LiteGraph.createNode("WebUIPromptBridge");
                bridge.id = 950022;
                bridge.pos = [60, 40];
                window.app.graph.add(bridge);
                window.app.canvas.setDirty(true, true);
            });
            await page.waitForFunction(() => document.querySelector(".webui-bridge-panel")?.__webuiBridgeDataLoaded, null, { timeout: 30000 });
            if (scenario.expectWizard) {
                await page.waitForSelector(".webui-bridge-startup", { timeout: 3000 });
            } else {
                await page.waitForTimeout(700);
            }
            const metrics = await page.evaluate(() => ({
                wizardCount: document.querySelectorAll(".webui-bridge-startup").length,
                status: document.querySelector(".webui-bridge-status")?.textContent || "",
            }));
            assert(
                scenario.expectWizard ? metrics.wizardCount === 1 : metrics.wizardCount === 0,
                `Startup wizard gating failed for ${scenario.label}`,
                metrics,
            );
            results.push({ label: scenario.label, ...metrics });
        } finally {
            await context.close();
        }
    }
    return results;
}

async function verifyMaskEditorLoadGuardsAndCanvasBudget(browser, baseUrl) {
    const consoleMessages = [];
    const largeSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="6000" height="6000" viewBox="0 0 6000 6000"><rect width="6000" height="6000" fill="#7890ab"/></svg>';
    const maskSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="white"/></svg>';
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1000, height: 760 }, async (newPage) => {
        await newPage.route("**/view?*", async (route) => {
            const filename = new URL(route.request().url()).searchParams.get("filename") || "";
            if (filename === "large.png") {
                await new Promise((resolve) => setTimeout(resolve, 220));
                await route.fulfill({ status: 200, contentType: "image/svg+xml", body: largeSvg });
                return;
            }
            if (filename === "valid-mask.png") {
                await new Promise((resolve) => setTimeout(resolve, 520));
                await route.fulfill({ status: 200, contentType: "image/svg+xml", body: maskSvg });
                return;
            }
            if (filename === "broken-mask.png") {
                await route.fulfill({ status: 200, contentType: "image/png", body: "not-an-image" });
                return;
            }
            await route.continue();
        });
    });
    const openEditor = async () => {
        await page.getByRole("button", { name: "涂抹局部" }).click();
        await page.waitForSelector(".webui-bridge-image-editor-panel");
    };
    const closeEditor = async () => {
        await page.locator(".webui-bridge-image-editor-panel .webui-bridge-config-head button").click();
        await page.waitForSelector(".webui-bridge-image-editor-panel", { state: "detached" });
    };
    const setMask = async (value) => {
        await page.evaluate((maskValue) => {
            const node = window.app.graph.getNodeById(950023);
            const widget = node?.widgets?.find((item) => item.name === "mask");
            if (!widget) throw new Error("Image input mask widget is missing");
            widget.value = maskValue;
            node.__webuiBridgeImageInputPanel?.__webuiBridgeRender?.();
        }, value);
    };
    try {
        await page.evaluate(() => {
            window.app.graph.clear();
            const node = window.LiteGraph.createNode("WebUIPromptBridgeImageInput");
            node.id = 950023;
            node.pos = [80, 60];
            const imageWidget = node.widgets?.find((item) => item.name === "image");
            const maskWidget = node.widgets?.find((item) => item.name === "mask");
            if (!imageWidget || !maskWidget) throw new Error("Image input widgets are missing");
            imageWidget.value = "webui_prompt_bridge/large.png";
            maskWidget.value = "";
            window.app.graph.add(node);
            node.__webuiBridgeImageInputPanel?.__webuiBridgeRender?.();
            window.app.canvas.setDirty(true, true);
        });
        await page.waitForSelector(".webui-bridge-image-input-panel", { timeout: 20000 });

        await openEditor();
        assert(await page.getByRole("button", { name: "保存 Mask" }).isDisabled(), "Mask save was enabled before the base image loaded");
        await page.waitForFunction(() => /按住拖动涂抹/.test(document.querySelector(".webui-bridge-image-editor-panel .webui-bridge-image-input-status")?.textContent || ""));
        const canvasMetrics = await page.evaluate(() => {
            const panel = document.querySelector(".webui-bridge-image-editor-panel");
            const canvases = [...panel.querySelectorAll("canvas")];
            const save = [...panel.querySelectorAll("button")].find((button) => button.textContent?.includes("保存 Mask"));
            return {
                canvases: canvases.map((canvas) => ({ width: canvas.width, height: canvas.height, pixels: canvas.width * canvas.height })),
                saveDisabled: Boolean(save?.disabled),
                status: panel.querySelector(".webui-bridge-image-input-status")?.textContent || "",
            };
        });
        assert(canvasMetrics.canvases.length === 2, "Mask editor canvases were not created", canvasMetrics);
        assert(canvasMetrics.canvases.every((canvas) => canvas.width <= 4096 && canvas.height <= 4096 && canvas.pixels <= 8_000_000),
            "Mask editor exceeded its canvas budget", canvasMetrics);
        assert(!canvasMetrics.saveDisabled, "Mask save did not enable after the base image loaded", canvasMetrics);
        await closeEditor();

        await setMask("webui_prompt_bridge/valid-mask.png");
        await openEditor();
        await page.waitForFunction(() => /载入已有 Mask/.test(document.querySelector(".webui-bridge-image-editor-panel .webui-bridge-image-input-status")?.textContent || ""));
        assert(await page.getByRole("button", { name: "保存 Mask" }).isDisabled(), "Mask save enabled before the existing mask loaded");
        await page.waitForFunction(() => /按住拖动涂抹/.test(document.querySelector(".webui-bridge-image-editor-panel .webui-bridge-image-input-status")?.textContent || ""));
        assert(!(await page.getByRole("button", { name: "保存 Mask" }).isDisabled()), "Mask save stayed disabled after the existing mask loaded");
        await closeEditor();

        await setMask("webui_prompt_bridge/broken-mask.png");
        await openEditor();
        await page.waitForFunction(() => /已有 Mask 载入失败/.test(document.querySelector(".webui-bridge-image-editor-panel .webui-bridge-image-input-status")?.textContent || ""));
        const failedMask = await page.evaluate(() => {
            const panel = document.querySelector(".webui-bridge-image-editor-panel");
            const save = [...panel.querySelectorAll("button")].find((button) => button.textContent?.includes("保存 Mask"));
            return {
                saveDisabled: Boolean(save?.disabled),
                status: panel.querySelector(".webui-bridge-image-input-status")?.textContent || "",
            };
        });
        assert(failedMask.saveDisabled, "Mask save enabled after the existing mask failed to load", failedMask);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(!bridgeConsoleErrors.length, "Mask editor guard checks emitted console errors", bridgeConsoleErrors);
        return { canvasMetrics, failedMask, bridgeConsoleErrors: bridgeConsoleErrors.length };
    } finally {
        await context.close();
    }
}

async function verifyCompactSidebarTabsAndLowZoomSummary(browser, baseUrl) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1280, height: 900 }, async (newPage) => {
        await newPage.route("**/*", async (route) => {
            const requestUrl = new URL(route.request().url());
            if (!requestUrl.pathname.endsWith("/webui_prompt_bridge/settings") || route.request().method() !== "GET") {
                await route.continue();
                return;
            }
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    settings: {
                        data_source: "auto",
                        translation_source: "auto",
                        tag_translation_source: "auto",
                        show_startup_wizard: false,
                        layout_preset: "compact",
                        tag_display: "local_first",
                        lora_card_size: "compact",
                        node_tutorial_popup: "off",
                        ui_visibility: {
                            model_switch: true,
                            generation_controls: true,
                            regional_control: true,
                            size_controls: true,
                            layout_presets: true,
                            prompt_tools: true,
                            styles: true,
                            lora_browser: true,
                            module_img2img: true,
                            module_controlnet: true,
                        },
                    },
                    custom_tag_count: 0,
                    assets: null,
                    module_assets: null,
                }),
            });
        });
    });
    try {
        await page.evaluate(() => {
            localStorage.removeItem("webui-bridge-sidebar-active-tab-v1");
            window.app.graph.clear();
            const bridge = window.LiteGraph.createNode("WebUIPromptBridge");
            bridge.id = 950024;
            bridge.pos = [60, 40];
            window.app.graph.add(bridge);
            window.app.canvas.ds.scale = 1;
            window.app.canvas.ds.offset = [20, 20];
            window.app.canvas.setDirty(true, true);
        });
        await page.waitForFunction(() => document.querySelector(".webui-bridge-panel")?.__webuiBridgeDataLoaded, null, { timeout: 30000 });
        await page.waitForTimeout(700);
        const initial = await page.evaluate(() => {
            const bridge = window.app.graph.getNodeById(950024);
            const panel = document.querySelector(".webui-bridge-panel");
            const tabs = [...panel.querySelectorAll(".webui-bridge-sidebar-tab")];
            return {
                nodeSize: Array.from(bridge?.size || []),
                tabs: tabs.map((tab) => tab.textContent?.trim()),
                activeTab: tabs.find((tab) => tab.getAttribute("aria-selected") === "true")?.textContent?.trim() || "",
                activePanels: panel.querySelectorAll(".webui-bridge-sidebar-panel.active:not([hidden])").length,
                layoutToolsOpen: Boolean(panel.querySelector(".webui-bridge-sidebar-layout-tools")?.open),
                layoutCompact: panel.classList.contains("layout-compact"),
                panelClass: panel.className,
            };
        });
        assert(initial.layoutCompact, "Fresh Bridge did not apply the compact default", initial);
        assert(initial.nodeSize[0] <= 940 && initial.nodeSize[1] <= 700, "Compact default did not reduce the fresh node size", initial);
        assert(JSON.stringify(initial.tabs) === JSON.stringify(["模型", "生成", "图生图", "模块"]), "Sidebar tabs are missing or out of order", initial);
        assert(initial.activeTab === "模型" && initial.activePanels === 1, "Sidebar did not start on a single model tab", initial);
        assert(!initial.layoutToolsOpen, "Layout tools should start collapsed", initial);

        await page.getByRole("tab", { name: "生成" }).click();
        const generation = await page.evaluate(() => ({
            active: document.querySelector('.webui-bridge-sidebar-tab[aria-selected="true"]')?.textContent?.trim() || "",
            generationVisible: Boolean(document.querySelector('.webui-bridge-sidebar-panel.active .webui-bridge-generation-section')),
            stored: localStorage.getItem("webui-bridge-sidebar-active-tab-v1"),
        }));
        assert(generation.active === "生成" && generation.generationVisible && generation.stored === "generation", "Generation sidebar tab did not activate or persist", generation);

        await page.getByRole("tab", { name: "图生图" }).click();
        const imageTab = await page.evaluate(() => ({
            active: document.querySelector('.webui-bridge-sidebar-tab[aria-selected="true"]')?.textContent?.trim() || "",
            imagePanelVisible: Boolean(document.querySelector('.webui-bridge-sidebar-panel.active .webui-bridge-image-input-panel')),
            stored: localStorage.getItem("webui-bridge-sidebar-active-tab-v1"),
        }));
        assert(imageTab.active === "图生图" && imageTab.imagePanelVisible && imageTab.stored === "image", "Image sidebar tab did not expose the image input panel", imageTab);

        await page.evaluate(() => {
            window.app.canvas.ds.scale = 0.55;
            window.app.canvas.setDirty(true, true);
        });
        await page.waitForFunction(() => document.querySelector(".webui-bridge-panel")?.classList.contains("zoom-summary-mode"));
        const lowZoom = await page.evaluate(() => {
            const panel = document.querySelector(".webui-bridge-panel");
            const overlay = document.querySelector(".webui-bridge-slot-label-overlay");
            const summary = panel?.querySelector(".webui-bridge-zoom-summary");
            return {
                summaryText: summary?.textContent?.replace(/\s+/g, " ").trim() || "",
                summaryVisible: summary ? getComputedStyle(summary).display !== "none" : false,
                detailsHidden: panel?.querySelector(".webui-bridge-top-controls") ? getComputedStyle(panel.querySelector(".webui-bridge-top-controls")).visibility === "hidden" : false,
                overlayHidden: !overlay || getComputedStyle(overlay).display === "none",
                nodeSize: Array.from(window.app.graph.getNodeById(950024)?.size || []),
            };
        });
        assert(lowZoom.summaryVisible && /WebUI Prompt Bridge/.test(lowZoom.summaryText), "Low-zoom summary did not render", lowZoom);
        assert(/正向\s+\d+/.test(lowZoom.summaryText) && /LoRA\s+\d+/.test(lowZoom.summaryText), "Low-zoom summary omitted prompt metrics", lowZoom);
        assert(lowZoom.detailsHidden && lowZoom.overlayHidden, "Low-zoom mode did not suppress detailed controls and port labels", lowZoom);
        assert(JSON.stringify(lowZoom.nodeSize) === JSON.stringify(initial.nodeSize), "Low-zoom summary mutated the Bridge node size", { initial, lowZoom });

        const serializedLowZoom = await page.evaluate(() => {
            const bridge = window.app.graph.getNodeById(950024);
            const data = { widgets_values: [] };
            bridge.onSerialize?.(data);
            return { size: data.size, liveSize: Array.from(bridge.size || []) };
        });
        assert(JSON.stringify(serializedLowZoom.size) === JSON.stringify(initial.nodeSize), "Low-zoom save did not serialize the original Bridge size", { initial, serializedLowZoom });
        assert(JSON.stringify(serializedLowZoom.liveSize) === JSON.stringify(initial.nodeSize), "Low-zoom serialization mutated the live Bridge size", { initial, serializedLowZoom });

        await page.evaluate(() => {
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        });
        await page.waitForFunction(() => !document.querySelector(".webui-bridge-panel")?.classList.contains("zoom-summary-mode"));
        const restored = await page.evaluate(() => ({
            active: document.querySelector('.webui-bridge-sidebar-tab[aria-selected="true"]')?.textContent?.trim() || "",
            detailedVisibility: getComputedStyle(document.querySelector(".webui-bridge-top-controls")).visibility,
            nodeSize: Array.from(window.app.graph.getNodeById(950024)?.size || []),
        }));
        assert(restored.active === "图生图" && restored.detailedVisibility === "visible", "Normal zoom did not restore the detailed UI and active tab", restored);
        assert(JSON.stringify(restored.nodeSize) === JSON.stringify(initial.nodeSize), "Normal zoom did not restore the exact original Bridge size", { initial, restored });

        const thresholdCycles = await page.evaluate(async () => {
            const bridge = window.app.graph.getNodeById(950024);
            const sizes = [];
            for (const scale of [0.67, 0.69, 0.32, 1, 0.55, 1]) {
                window.app.canvas.ds.scale = scale;
                window.app.canvas.setDirty(true, true);
                await new Promise((resolve) => setTimeout(resolve, 100));
                sizes.push({ scale, size: Array.from(bridge.size || []) });
            }
            return sizes;
        });
        for (const entry of thresholdCycles) {
            assert(JSON.stringify(entry.size) === JSON.stringify(initial.nodeSize), "Repeated threshold crossing mutated the Bridge size", { initial, thresholdCycles });
        }
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(!bridgeConsoleErrors.length, "UI optimization checks emitted Bridge console errors", bridgeConsoleErrors);
        return { initial, generation, imageTab, lowZoom, serializedLowZoom, restored, thresholdCycles, bridgeConsoleErrors: bridgeConsoleErrors.length };
    } finally {
        await context.close();
    }
}

async function verifyExactPromptTagToggle(browser, baseUrl) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1200, height: 900 }, async (newPage) => {
        await newPage.route("**/webui_prompt_bridge/prompt_all_in_one?lang=zh_CN", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    group_tags: [{
                        name: "Regression",
                        tabKey: "regression",
                        type: "tags",
                        groups: [{
                            name: "Exact tags",
                            tabKey: "regression-exact",
                            type: "tags",
                            color: "",
                            tags: [{ prompt: "girl", local: "女孩" }],
                        }],
                    }],
                    favorites: { positive: [], negative: [] },
                }),
            });
        });
    });
    try {
        await page.evaluate(() => {
            window.app.graph.clear();
            const bridge = window.LiteGraph.createNode("WebUIPromptBridge");
            bridge.id = 950021;
            bridge.pos = [60, 40];
            window.app.graph.add(bridge);
            window.app.canvas.setDirty(true, true);
        });
        await page.waitForFunction(() => document.querySelector(".webui-bridge-panel")?.__webuiBridgeDataLoaded, null, { timeout: 30000 });
        await page.waitForSelector('.webui-bridge-aio-tag[data-prompt="girl"]', { timeout: 20000 });
        const values = await page.evaluate(async () => {
            const textarea = document.querySelector(".webui-bridge-positive-prompt-row textarea");
            textarea.value = "1girl, solo";
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
            await new Promise((resolve) => setTimeout(resolve, 80));
            document.querySelector('.webui-bridge-aio-tag[data-prompt="girl"]')?.click();
            await new Promise((resolve) => setTimeout(resolve, 120));
            const afterAdd = textarea.value;
            document.querySelector('.webui-bridge-aio-tag[data-prompt="girl"]')?.click();
            await new Promise((resolve) => setTimeout(resolve, 120));
            return { afterAdd, afterRemove: textarea.value };
        });
        assert(values.afterAdd === "1girl, solo, girl", "Adding girl corrupted or failed to preserve 1girl", values);
        assert(values.afterRemove === "1girl, solo", "Removing girl did not use exact tag matching", values);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(!bridgeConsoleErrors.length, "Exact prompt tag toggle emitted console errors", bridgeConsoleErrors);
        return { ...values, bridgeConsoleErrors: bridgeConsoleErrors.length };
    } finally {
        await context.close();
    }
}

async function verifyFullNegativeCollapseReclaimsLoraSpace(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1900, height: 1500 });
    try {
        const fullWorkflow = JSON.parse(JSON.stringify(workflow));
        for (const node of fullWorkflow.nodes || []) {
            if (node.type !== "WebUIPromptBridge") continue;
            node.size = [1600, 1650];
            node.properties = {
                ...(node.properties || {}),
                webui_prompt_bridge_layout: {
                    version: 1,
                    top_row_height: 980,
                    extra_height: 520,
                    sidebar_width: 400,
                    positive_textarea_height: 112,
                    negative_textarea_height: 96,
                    positive_chip_height: 132,
                    negative_chip_height: 104,
                    positive_tag_height: 260,
                    negative_tag_height: 260,
                    lora_scroll_top: 0,
                    extra_collapsed: false,
                    sidebar_collapsed: false,
                    negative_collapsed: false,
                },
            };
            break;
        }
        await page.evaluate(async (graphData) => {
            localStorage.removeItem("webui-bridge-negative-collapsed");
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "full-negative-collapse-reclaims-lora-space.json",
            });
            window.app.canvas.ds.offset = [120, 80];
            window.app.canvas.ds.scale = 0.78;
            window.app.canvas.setDirty(true, true);
        }, fullWorkflow);
        await page.waitForTimeout(4200);
        const before = await bridgeBottomBlankMetrics(page, "full layout before negative collapse");
        assert(before.blankBelowExtra !== null && before.blankBelowExtra <= 48,
            "Seeded full Bridge layout did not start near the panel bottom", before);
        await page.evaluate(() => {
            const collapseButton = [...document.querySelectorAll(".webui-bridge-collapse-btn")]
                .find((button) => /折叠反向/.test(button.textContent || ""));
            collapseButton?.click();
        });
        await page.waitForTimeout(2600);
        const after = await bridgeBottomBlankMetrics(page, "full layout after negative collapse");
        await screenshot(page, "compat-full-negative-collapse-lora-space.png");
        assert(after.negativeCollapsed, "Negative prompt row did not collapse in full-layout reclaim check", { before, after });
        assertRoundedArrayEqual(after.nodeSize.map((value) => Math.round(value)), [1600, 1650],
            "Full-layout negative collapse changed the node size", { before, after });
        assert(after.blankBelowExtra !== null && after.blankBelowExtra <= 36,
            "Large bottom blank remained after collapsing negative prompt in a full layout", { before, after });
        assert((after.layoutState?.extra_height || 0) >= (before.layoutState?.extra_height || 0) + 240,
            "LoRA section did not reclaim the space released by collapsing negative prompt", { before, after });
        assert(after.extraMaxHeight === 520, "LoRA inline max marker changed unexpectedly", { before, after });
        await dragElementCenter(page, ".webui-bridge-panel-splitter", 260);
        await page.waitForTimeout(3200);
        const afterManualDrag = await bridgeBottomBlankMetrics(page, "after manual prompt/lora split drag");
        assert(afterManualDrag.negativeCollapsed,
            "Negative prompt unexpectedly expanded after manually dragging the Prompt/LoRA splitter", { after, afterManualDrag });
        assert((afterManualDrag.topRow?.height || 0) >= (after.topRow?.height || 0) + 120,
            "Manual Prompt/LoRA splitter drag was pulled back after negative prompt collapse", { after, afterManualDrag });
        assert((afterManualDrag.extra?.height || 0) <= (after.extra?.height || 0) - 120,
            "LoRA section did not stay lower after manual splitter drag", { after, afterManualDrag });
        assert(afterManualDrag.blankBelowExtra !== null && afterManualDrag.blankBelowExtra <= 48,
            "Manual splitter drag left a large blank below LoRA after negative prompt collapse", { after, afterManualDrag });
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during full negative collapse reclaim check", bridgeConsoleErrors);
        return {
            beforeBlankBelowExtra: Math.round(before.blankBelowExtra),
            afterBlankBelowExtra: Math.round(after.blankBelowExtra),
            beforeExtraHeight: before.layoutState?.extra_height,
            afterExtraHeight: after.layoutState?.extra_height,
            manualDragTopRowHeight: afterManualDrag.topRow?.height,
            manualDragExtraHeight: afterManualDrag.extra?.height,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifySectionResizeBlankRecovery(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        await page.evaluate(async (graphData) => {
            localStorage.removeItem("webui-bridge-negative-collapsed");
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "section-resize-blank-recovery.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        }, workflow);
        await page.waitForTimeout(3500);
        const samples = [await bridgeBottomBlankMetrics(page, "initial")];
        await dragElementCenter(page, ".webui-bridge-panel-splitter", 260);
        samples.push(await bridgeBottomBlankMetrics(page, "after panel split down"));
        await dragElementCenter(page, ".webui-bridge-positive-prompt-row .webui-bridge-section-resizer", 180, 0);
        samples.push(await bridgeBottomBlankMetrics(page, "after positive text tag split"));
        await page.evaluate(() => {
            const collapseButton = [...document.querySelectorAll(".webui-bridge-collapse-btn")]
                .find((button) => /折叠反向|展开反向/.test(button.textContent || ""));
            if (collapseButton && /折叠反向/.test(collapseButton.textContent || "")) collapseButton.click();
        });
        await page.waitForTimeout(900);
        samples.push(await bridgeBottomBlankMetrics(page, "after collapse negative"));
        await dragElementCenter(page, ".webui-bridge-negative-main-resizer", -220);
        samples.push(await bridgeBottomBlankMetrics(page, "after tag negative split up"));
        await dragElementCenter(page, ".webui-bridge-panel-splitter", -360);
        samples.push(await bridgeBottomBlankMetrics(page, "after panel split up"));
        await dragElementCenter(page, ".webui-bridge-panel-splitter", 180);
        await page.waitForTimeout(3600);
        samples.push(await bridgeBottomBlankMetrics(page, "after settle"));
        await screenshot(page, "compat-section-resize-blank-recovery.png");
        const final = samples[samples.length - 1];
        assert(final.blankBelowExtra !== null, "Could not measure bottom blank after section resize stress", samples);
        assert(final.blankBelowExtra <= 36, "Large bottom blank remained after combined tag and LoRA section dragging", samples);
        assert(final.extra?.height >= 42, "LoRA section collapsed or disappeared after resize stress", samples);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during section resize blank recovery check", bridgeConsoleErrors);
        return {
            finalBlankBelowExtra: Math.round(final.blankBelowExtra),
            finalExtraHeight: Math.round(final.extra.height),
            samples: samples.map((item) => ({
                label: item.label,
                blankBelowExtra: item.blankBelowExtra === null ? null : Math.round(item.blankBelowExtra),
                extraHeight: item.extra?.height ? Math.round(item.extra.height) : null,
            })),
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function bridgeRestoreSizeMetrics(page, label = "metrics") {
    return await page.evaluate((metricLabel) => {
        const panel = document.querySelector(".webui-bridge-panel");
        const topRow = document.querySelector(".webui-bridge-toprow");
        const extra = document.querySelector(".webui-bridge-extra");
        const node = window.app.graph._nodes.find((item) => item.type === "WebUIPromptBridge");
        const rect = (element) => {
            if (!element) return null;
            const item = element.getBoundingClientRect();
            return {
                height: Math.round(item.height),
                top: Math.round(item.top),
                bottom: Math.round(item.bottom),
            };
        };
        return {
            label: metricLabel,
            nodeSize: node?.size ? Array.from(node.size).map((value) => Math.round(value)) : null,
            desiredSize: node?.__webuiBridgeDesiredSize
                ? Array.from(node.__webuiBridgeDesiredSize).map((value) => Math.round(value))
                : null,
            panel: rect(panel),
            topRow: rect(topRow),
            extra: rect(extra),
            blankBelowExtra: panel && extra
                ? Math.round(panel.getBoundingClientRect().bottom - extra.getBoundingClientRect().bottom - 8)
                : null,
        };
    }, label);
}

async function verifyRestoreSizeStability(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "restore-size-stability.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        }, workflow);
        await page.waitForTimeout(3500);
        await page.evaluate(() => {
            const panel = document.querySelector(".webui-bridge-panel");
            const node = window.app.graph._nodes.find((item) => item.type === "WebUIPromptBridge");
            if (node) {
                node.setSize?.([1180, 760]);
                node.size = [1180, 760];
                node.__webuiBridgeDesiredSize = [1180, 760];
                node.__webuiBridgeSavedPanelSize = [1180, 760];
                node.__webuiBridgeUserSized = true;
            }
            const top = document.querySelector(".webui-bridge-toprow");
            const extra = document.querySelector(".webui-bridge-extra");
            const positiveTags = document.querySelector(".webui-bridge-positive-prompt-row .webui-bridge-tag-panel");
            if (top) {
                top.style.height = "420px";
                top.style.flex = "0 0 auto";
            }
            if (extra) {
                extra.style.height = "320px";
                extra.style.flex = "0 0 auto";
            }
            if (positiveTags) {
                positiveTags.style.height = "260px";
                positiveTags.style.flex = "0 0 auto";
            }
            panel?.__webuiBridgeScheduleAdaptiveLayout?.();
            window.app.canvas.setDirty(true, true);
        });
        await page.waitForTimeout(800);
        const before = await bridgeRestoreSizeMetrics(page, "disturbed");
        await page.evaluate(() => {
            const restoreButton = [...document.querySelectorAll(".webui-bridge-top-controls button")]
                .find((button) => /恢复尺寸/.test(button.textContent || ""));
            if (!restoreButton) throw new Error("Restore size button not found");
            restoreButton.click();
        });
        const samples = [];
        for (let index = 0; index < 90; index += 1) {
            await page.waitForTimeout(50);
            samples.push(await bridgeRestoreSizeMetrics(page, `after-${index}`));
        }
        await screenshot(page, "compat-restore-size-stability.png");
        const settled = samples.slice(24);
        const settledExtraHeights = settled.map((item) => item.extra?.height).filter(Number.isFinite);
        const minSettledExtra = Math.min(...settledExtraHeights);
        const maxSettledExtra = Math.max(...settledExtraHeights);
        const settledExtraSpan = maxSettledExtra - minSettledExtra;
        const largeTransitions = settled.slice(1).filter((item, index) =>
            Math.abs((item.extra?.height || 0) - (settled[index].extra?.height || 0)) > 32
        ).length;
        const final = samples[samples.length - 1];
        assert(settledExtraHeights.length > 4, "Could not measure LoRA height after restore size", samples);
        assert(settledExtraSpan <= 18 && largeTransitions === 0, "Restore size caused repeated LoRA height jitter", {
            before,
            settledExtraSpan,
            largeTransitions,
            samples: samples.filter((item, index) => index < 5 || index > 23),
        });
        assert(final.nodeSize?.[0] === 1180 && final.nodeSize?.[1] === 1180, "Restore size did not settle on default node size", final);
        assert(Math.abs(final.blankBelowExtra || 0) <= 36, "Restore size left a large bottom gap or overflow", final);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during restore size stability check", bridgeConsoleErrors);
        return {
            finalNodeSize: final.nodeSize,
            finalExtraHeight: final.extra?.height || null,
            finalBlankBelowExtra: final.blankBelowExtra,
            settledExtraSpan,
            largeTransitions,
        };
    } finally {
        await context.close();
    }
}

async function verifyCanvasPanDoesNotMutateBridgeLayout(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "canvas-pan-layout-stability.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        }, workflow);
        await page.waitForTimeout(3500);
        const before = await bridgeLayoutStabilitySnapshot(page, "before pan");
        await page.mouse.move(1500, 1180);
        await page.mouse.down({ button: "middle" });
        await page.mouse.move(1350, 1050, { steps: 10 });
        await page.mouse.up({ button: "middle" });
        await page.waitForTimeout(1200);
        const after = await bridgeLayoutStabilitySnapshot(page, "after pan");
        const moved = Math.abs((after.canvasOffset?.[0] || 0) - (before.canvasOffset?.[0] || 0)) > 20 ||
            Math.abs((after.canvasOffset?.[1] || 0) - (before.canvasOffset?.[1] || 0)) > 20;
        assert(moved, "Canvas pan did not move the ComfyUI canvas offset", { before, after });
        assertBridgeLayoutStable(before, after, "Canvas pan mutated Bridge layout");
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during canvas pan layout check", bridgeConsoleErrors);
        return {
            beforeOffset: before.canvasOffset,
            afterOffset: after.canvasOffset,
            nodeSize: after.nodeSize,
            sidebarWidth: after.sidebarWidthVar,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyOffscreenCanvasPanDoesNotCollapseBridgeLayout(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "offscreen-canvas-pan-layout-stability.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        }, workflow);
        await page.waitForTimeout(3500);
        const before = await bridgeLayoutStabilitySnapshot(page, "before offscreen pan");
        await page.evaluate(() => {
            const bridge = window.app.graph._nodes.find((node) => node.type === "WebUIPromptBridge");
            window.app.canvas.ds.offset = [
                -bridge.pos[0] - bridge.size[0] - 900,
                -bridge.pos[1] - bridge.size[1] - 900,
            ];
            window.app.canvas.setDirty(true, true);
        });
        await page.waitForTimeout(1600);
        const hidden = await bridgeLayoutStabilitySnapshot(page, "hidden offscreen");
        assert(hidden.panel?.height === 0 && hidden.extra?.height === 0,
            "Bridge panel did not leave the viewport during offscreen pan check", { before, hidden });
        for (const key of ["top_row_height", "extra_height"]) {
            assert(Math.abs((hidden.layoutState?.[key] || 0) - (before.layoutState?.[key] || 0)) <= 2,
                `Hidden Bridge layout state collapsed while node was offscreen: ${key}`, { before, hidden });
        }
        await page.evaluate(() => {
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.setDirty(true, true);
        });
        await page.waitForTimeout(1800);
        const after = await bridgeLayoutStabilitySnapshot(page, "after offscreen pan return");
        await screenshot(page, "compat-offscreen-canvas-pan-layout-stability.png");
        assertBridgeLayoutStable(before, after, "Offscreen canvas pan mutated Bridge layout");
        for (const key of ["top_row_height", "extra_height"]) {
            assert(Math.abs((after.layoutState?.[key] || 0) - (before.layoutState?.[key] || 0)) <= 2,
                `Returned Bridge layout state changed after offscreen pan: ${key}`, { before, hidden, after });
        }
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during offscreen canvas pan check", bridgeConsoleErrors);
        return {
            beforeOffset: before.canvasOffset,
            hiddenOffset: hidden.canvasOffset,
            afterOffset: after.canvasOffset,
            topRowHeight: after.topRow?.height,
            extraHeight: after.extra?.height,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyLargeSavedLayoutSettlesAfterModeSwitch(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1800, height: 1500 });
    try {
        const largeWorkflow = JSON.parse(JSON.stringify(workflow));
        for (const node of largeWorkflow.nodes || []) {
            if (node.type !== "WebUIPromptBridge") continue;
            node.size = [1600, 3000];
            node.properties = {
                ...(node.properties || {}),
                webui_prompt_bridge_layout: {
                    version: 1,
                    top_row_height: 620,
                    extra_height: 520,
                    sidebar_width: 400,
                    positive_textarea_height: 112,
                    negative_textarea_height: 96,
                    positive_chip_height: 132,
                    negative_chip_height: 104,
                    positive_tag_height: 190,
                    negative_tag_height: 240,
                    lora_scroll_top: 0,
                    extra_collapsed: false,
                    sidebar_collapsed: false,
                    negative_collapsed: false,
                },
            };
            break;
        }
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "large-saved-layout-mode-switch.json",
            });
            window.app.canvas.ds.offset = [20, 20];
            window.app.canvas.ds.scale = 0.72;
            window.app.canvas.setDirty(true, true);
        }, largeWorkflow);
        await page.waitForTimeout(3600);
        const loaded = await bridgeLayoutStabilitySnapshot(page, "large saved layout loaded");
        assert((loaded.promptContentBlank ?? 0) <= 80, "Large saved Bridge layout left a large blank inside the prompt area after load", { loaded });
        assert(loaded.layoutState?.extra_height <= 540, "LoRA section grew too tall after loading a large saved node", { loaded });
        await page.evaluate(() => {
            [...document.querySelectorAll("button")]
                .find((button) => (button.textContent || "").trim() === "纯模型质量")
                ?.click();
        });
        await page.waitForTimeout(1600);
        const after = await bridgeLayoutStabilitySnapshot(page, "large saved layout after quality switch");
        await screenshot(page, "compat-large-saved-layout-mode-switch.png");
        assert((after.promptContentBlank ?? 0) <= 80, "Large saved Bridge layout left a large blank inside the prompt area after mode switch", { loaded, after });
        assertRoundedArrayEqual(after.nodeSize, [1600, 3000], "Large saved Bridge node size changed after mode switch", { loaded, after });
        assert(after.layoutState?.extra_height <= 540, "LoRA section grew too tall after large-node mode switch", { loaded, after });
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during large-node mode switch check", bridgeConsoleErrors);
        return {
            nodeSize: after.nodeSize,
            loadedPromptContentBlank: loaded.promptContentBlank,
            afterPromptContentBlank: after.promptContentBlank,
            topRowHeight: after.layoutState?.top_row_height,
            extraHeight: after.layoutState?.extra_height,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyRegionalCanvasSizeDoesNotMutateLayout(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "regional-canvas-size-layout-stability.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        }, workflow);
        await page.waitForTimeout(3500);
        const before = await bridgeLayoutStabilitySnapshot(page, "before regional size");
        const editResult = await page.evaluate(() => {
            const inputs = [...document.querySelectorAll(".webui-bridge-regional-canvas-size")];
            if (inputs.length < 2) return { missing: true, count: inputs.length };
            inputs[0].value = "896";
            inputs[1].value = "1152";
            for (const input of inputs.slice(0, 2)) {
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
            }
            return { missing: false, values: inputs.slice(0, 2).map((input) => input.value) };
        });
        assert(!editResult.missing, "Regional canvas size inputs were not rendered", editResult);
        await page.waitForTimeout(1200);
        const after = await bridgeLayoutStabilitySnapshot(page, "after regional size");
        assertBridgeLayoutStable(before, after, "Regional canvas size edit mutated Bridge layout");
        assert(Number(after.regional.widgetWidth) === 896 && Number(after.regional.widgetHeight) === 1152,
            "Regional canvas size widgets did not receive manual values", { editResult, before, after });
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during regional size layout check", bridgeConsoleErrors);
        return {
            regional: after.regional,
            nodeSize: after.nodeSize,
            sidebarWidth: after.sidebarWidthVar,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyNodeSizeInputIsUserAuthority(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "node-size-input-authority.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        }, workflow);
        await page.waitForTimeout(3500);
        const editResult = await page.evaluate(() => {
            const inputs = [...document.querySelectorAll(".webui-bridge-size-field input")];
            if (inputs.length < 2) return { missing: true, count: inputs.length };
            inputs[0].value = "980";
            inputs[1].value = "920";
            for (const input of inputs.slice(0, 2)) {
                input.dispatchEvent(new Event("change", { bubbles: true }));
            }
            return { missing: false, values: inputs.slice(0, 2).map((input) => input.value) };
        });
        assert(!editResult.missing, "Node size inputs were not rendered", editResult);
        await page.waitForTimeout(2600);
        const after = await bridgeLayoutStabilitySnapshot(page, "after node size input");
        assertRoundedArrayEqual(after.nodeSize, [980, 920], "Node size input was overwritten by layout repair", { editResult, after });
        assertRoundedArrayEqual(after.desiredSize, [980, 920], "Desired node size did not track the user input", { editResult, after });
        assertRoundedArrayEqual(after.savedSize, [980, 920], "Saved node size did not track the user input", { editResult, after });
        assert(after.localActionWidth === null, "Node size input unexpectedly persisted sidebar width", after);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during node size authority check", bridgeConsoleErrors);
        return {
            nodeSize: after.nodeSize,
            desiredSize: after.desiredSize,
            savedSize: after.savedSize,
            sidebarWidth: after.sidebarWidthVar,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyFlatSavedBridgeSizeRepair(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1400, height: 1000 });
    try {
        const flatWorkflow = JSON.parse(JSON.stringify(workflow));
        for (const node of flatWorkflow.nodes || []) {
            if (node.type === "WebUIPromptBridge") {
                node.size = [1180, 260];
                break;
            }
        }
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "flat-saved-bridge-size-repair.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        }, flatWorkflow);
        await page.waitForTimeout(2800);
        const report = await page.evaluate(() => {
            const bridge = window.app.graph._nodes.find((node) => node.type === "WebUIPromptBridge");
            const panel = document.querySelector(".webui-bridge-panel");
            const canvasRect = document.querySelector("#graph-canvas").getBoundingClientRect();
            const portPoints = bridge ? [
                [bridge.pos[0] + 4, bridge.pos[1] + 80],
                [bridge.pos[0] + bridge.size[0] - 4, bridge.pos[1] + 80],
            ] : [];
            const portHits = portPoints.map((point) => {
                const canvasPoint = window.app.canvas.convertOffsetToCanvas(point);
                const client = [canvasPoint[0] + canvasRect.left, canvasPoint[1] + canvasRect.top];
                const dom = document.elementFromPoint(client[0], client[1]);
                return {
                    client,
                    graphHitId: window.app.graph.getNodeOnPos(point[0], point[1], null, 0)?.id ?? null,
                    blockedByPanel: Boolean(dom?.closest?.(".webui-bridge-panel")),
                    dom: dom ? `${dom.tagName}.${String(dom.className || "").replace(/\s+/g, ".")}` : null,
                };
            });
            return {
                nodeSize: bridge?.size ? Array.from(bridge.size).map((value) => Math.round(value)) : null,
                desiredSize: bridge?.__webuiBridgeDesiredSize ? Array.from(bridge.__webuiBridgeDesiredSize).map((value) => Math.round(value)) : null,
                panelHeight: Math.round(panel?.getBoundingClientRect?.().height || 0),
                portHits,
            };
        });
        await screenshot(page, "compat-flat-saved-bridge-size-repair.png");
        assert(report.nodeSize?.[0] >= 760 && report.nodeSize?.[1] >= 520, "Flat saved bridge size was not repaired", report);
        assert(report.nodeSize?.[1] <= 1300, "Flat saved bridge size repair grew the node too tall", report);
        assert(report.panelHeight >= 500, "Bridge panel remained visually squeezed after flat-size repair", report);
        assert(report.portHits.every((hit) => hit.graphHitId !== null && !hit.blockedByPanel), "Bridge DOM panel covered a port hit area", report);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during flat-size repair check", bridgeConsoleErrors);
        return {
            nodeSize: report.nodeSize,
            panelHeight: report.panelHeight,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyLargeSavedBridgeSizePreservedAndPortGutters(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1200 });
    try {
        const largeWorkflow = JSON.parse(JSON.stringify(workflow));
        for (const node of largeWorkflow.nodes || []) {
            if (node.type === "WebUIPromptBridge") {
                node.size = [1337, 1988];
                break;
            }
        }
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "large-saved-bridge-size-preserved.json",
            });
            window.app.canvas.ds.offset = [80, 60];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        }, largeWorkflow);
        await page.waitForTimeout(3000);
        const report = await page.evaluate(() => {
            const bridge = window.app.graph._nodes.find((node) => node.type === "WebUIPromptBridge");
            const panel = document.querySelector(".webui-bridge-panel");
            const root = panel?.parentElement;
            const canvasRect = document.querySelector("#graph-canvas").getBoundingClientRect();
            const scale = window.app.canvas.ds.scale || 1;
            const nodeLeft = bridge ? canvasRect.left + (bridge.pos[0] + window.app.canvas.ds.offset[0]) * scale : 0;
            const nodeRight = bridge ? canvasRect.left + (bridge.pos[0] + bridge.size[0] + window.app.canvas.ds.offset[0]) * scale : 0;
            const panelRect = panel?.getBoundingClientRect?.();
            const rootRect = root?.getBoundingClientRect?.();
            return {
                nodeSize: bridge?.size ? Array.from(bridge.size).map((value) => Math.round(value)) : null,
                desiredSize: bridge?.__webuiBridgeDesiredSize ? Array.from(bridge.__webuiBridgeDesiredSize).map((value) => Math.round(value)) : null,
                panelRect: panelRect ? {
                    left: Math.round(panelRect.left),
                    right: Math.round(panelRect.right),
                    width: Math.round(panelRect.width),
                    height: Math.round(panelRect.height),
                } : null,
                rootRect: rootRect ? {
                    left: Math.round(rootRect.left),
                    right: Math.round(rootRect.right),
                    width: Math.round(rootRect.width),
                    height: Math.round(rootRect.height),
                } : null,
                leftGutter: Math.round((panelRect?.left || 0) - nodeLeft),
                rightGutter: Math.round(nodeRight - (panelRect?.right || 0)),
                inputLabelOutside: (() => {
                    const rect = document.querySelector(".lg-node:has(.webui-bridge-panel) .lg-slot--input .text-node-component-slot-text")?.getBoundingClientRect?.();
                    return rect ? Math.round(rect.right - nodeLeft) <= -8 : null;
                })(),
                outputLabelOutside: (() => {
                    const rect = document.querySelector(".lg-node:has(.webui-bridge-panel) .lg-slot--output .text-node-component-slot-text")?.getBoundingClientRect?.();
                    return rect ? Math.round(rect.left - nodeRight) >= 8 : null;
                })(),
                externalSlotLabels: [...document.querySelectorAll(".webui-bridge-slot-label")]
                    .map((label) => label.textContent || "")
                    .filter(Boolean),
            };
        });
        await screenshot(page, "compat-large-saved-bridge-size-preserved.png");
        assert(report.nodeSize?.[0] === 1337 && report.nodeSize?.[1] === 1988, "Large saved bridge size was not preserved", report);
        assert(report.desiredSize?.[0] === 1337 && report.desiredSize?.[1] === 1988, "Large saved bridge desired size drifted", report);
        assert(report.panelRect?.height >= 1900 && report.rootRect?.height >= 1900, "Large bridge DOM panel did not fill the resized node", report);
        assert(report.leftGutter >= 14 && report.rightGutter >= 14, "Bridge panel did not leave port-dot gutters", report);
        assert(report.leftGutter <= 28 && report.rightGutter <= 28, "Bridge panel still used wide internal port-label gutters", report);
        assert(report.externalSlotLabels.includes("model") && report.externalSlotLabels.includes("positive_text"), "Bridge external port-label overlay did not render expected labels", report);
        assert(report.inputLabelOutside !== false && report.outputLabelOutside !== false, "Bridge DOM port labels were not flipped outside the node", report);
        assert(report.panelRect?.width >= 1120, "Bridge panel became too narrow after port labels were flipped outside", report);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during large saved size check", bridgeConsoleErrors);
        return {
            nodeSize: report.nodeSize,
            leftGutter: report.leftGutter,
            rightGutter: report.rightGutter,
            inputLabelOutside: report.inputLabelOutside,
            outputLabelOutside: report.outputLabelOutside,
            externalSlotLabels: report.externalSlotLabels.length,
            panelWidth: report.panelRect?.width,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifySidebarCollapsePersistenceAndSlotLabelCleanup(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1200 });
    try {
        const firstPass = await page.evaluate(async (graphData) => {
            const collapseKey = "webui-bridge-action-column-collapsed";
            const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            const reportState = () => {
                const bridge = window.app.graph._nodes.find((node) => node.type === "WebUIPromptBridge");
                const topRow = document.querySelector(".webui-bridge-toprow");
                const actionColumn = document.querySelector(".webui-bridge-action-column");
                const toggle = document.querySelector(".webui-bridge-side-toggle");
                const overlays = [...document.querySelectorAll(".webui-bridge-slot-label-overlay")];
                const labels = [...document.querySelectorAll(".webui-bridge-slot-label")];
                return {
                    bridgeId: bridge?.id ?? null,
                    collapsed: Boolean(topRow?.classList.contains("action-collapsed")),
                    actionColumnHidden: Boolean(actionColumn?.classList.contains("collapsed")) ||
                        (actionColumn ? getComputedStyle(actionColumn).display === "none" : null),
                    toggleText: (toggle?.textContent || "").trim(),
                    stored: localStorage.getItem(collapseKey),
                    overlayCount: overlays.length,
                    labelCount: labels.length,
                    overlayNodeIds: overlays.map((overlay) => overlay.dataset.bridgeNodeId || ""),
                    orphanOverlayCount: overlays.filter((overlay) => !overlay.dataset.bridgeNodeId || overlay.dataset.bridgeNodeId === "orphan").length,
                    labelTexts: labels.map((label) => label.textContent || "").filter(Boolean),
                };
            };
            localStorage.removeItem(collapseKey);
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "sidebar-collapse-overlay-cleanup.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
            await wait(3200);
            const initial = reportState();

            const orphan = document.createElement("div");
            orphan.className = "webui-bridge-slot-label-overlay";
            orphan.dataset.bridgeNodeId = "orphan";
            const orphanLabel = document.createElement("div");
            orphanLabel.className = "webui-bridge-slot-label input";
            orphanLabel.textContent = "model";
            orphan.append(orphanLabel);
            document.body.append(orphan);
            await wait(700);
            const afterOrphanCleanup = reportState();

            const toggle = document.querySelector(".webui-bridge-side-toggle");
            if ((toggle?.textContent || "").includes("隐藏")) toggle.click();
            await wait(700);
            const afterHide = reportState();

            const movedGraph = JSON.parse(JSON.stringify(graphData));
            for (const node of movedGraph.nodes || []) {
                if (node.type === "WebUIPromptBridge" && Array.isArray(node.pos)) {
                    node.pos = [Number(node.pos[0] || 0) + 420, Number(node.pos[1] || 0) + 180];
                    break;
                }
            }
            await window.app.loadGraphData(movedGraph, true, true, undefined, {
                filename: "sidebar-collapse-overlay-cleanup-moved.json",
            });
            window.app.canvas.setDirty(true, true);
            await wait(3200);
            const afterMovedGraph = reportState();

            return { initial, afterOrphanCleanup, afterHide, afterMovedGraph };
        }, workflow);
        await screenshot(page, "compat-sidebar-collapse-overlay-cleanup-before-reload.png");

        await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForFunction(() => Boolean(window.app?.graph && window.app?.canvas && window.LiteGraph), null, {
            timeout: 60000,
        });
        const afterPageReload = await page.evaluate(async (graphData) => {
            const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            const collapseKey = "webui-bridge-action-column-collapsed";
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "sidebar-collapse-overlay-cleanup-page-reload.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
            await wait(3200);
            const bridge = window.app.graph._nodes.find((node) => node.type === "WebUIPromptBridge");
            const topRow = document.querySelector(".webui-bridge-toprow");
            const actionColumn = document.querySelector(".webui-bridge-action-column");
            const toggle = document.querySelector(".webui-bridge-side-toggle");
            const overlays = [...document.querySelectorAll(".webui-bridge-slot-label-overlay")];
            const labels = [...document.querySelectorAll(".webui-bridge-slot-label")];
            return {
                bridgeId: bridge?.id ?? null,
                collapsed: Boolean(topRow?.classList.contains("action-collapsed")),
                actionColumnHidden: Boolean(actionColumn?.classList.contains("collapsed")) ||
                    (actionColumn ? getComputedStyle(actionColumn).display === "none" : null),
                toggleText: (toggle?.textContent || "").trim(),
                stored: localStorage.getItem(collapseKey),
                overlayCount: overlays.length,
                labelCount: labels.length,
                overlayNodeIds: overlays.map((overlay) => overlay.dataset.bridgeNodeId || ""),
                orphanOverlayCount: overlays.filter((overlay) => !overlay.dataset.bridgeNodeId || overlay.dataset.bridgeNodeId === "orphan").length,
                labelTexts: labels.map((label) => label.textContent || "").filter(Boolean),
            };
        }, workflow);
        await screenshot(page, "compat-sidebar-collapse-overlay-cleanup-after-reload.png");

        assert(firstPass.initial.overlayCount === 1, "Bridge slot label overlay did not start with a single active overlay", firstPass.initial);
        assert(firstPass.initial.labelTexts.includes("model") && firstPass.initial.labelTexts.includes("positive_text"), "Bridge slot label overlay did not render expected labels", firstPass.initial);
        assert(firstPass.afterOrphanCleanup.overlayCount === 1 && firstPass.afterOrphanCleanup.orphanOverlayCount === 0, "Orphan bridge slot label overlay was not cleaned up", firstPass.afterOrphanCleanup);
        assert(firstPass.afterHide.collapsed && firstPass.afterHide.actionColumnHidden && firstPass.afterHide.stored === "1", "Sidebar collapsed state was not saved after clicking hide", firstPass.afterHide);
        assert(firstPass.afterHide.toggleText === "显示侧栏", "Sidebar toggle text did not switch after hiding", firstPass.afterHide);
        assert(firstPass.afterMovedGraph.collapsed && firstPass.afterMovedGraph.stored === "1", "Sidebar collapsed state did not survive graph reload", firstPass.afterMovedGraph);
        assert(firstPass.afterMovedGraph.overlayCount === 1 && firstPass.afterMovedGraph.orphanOverlayCount === 0, "Bridge slot label overlays accumulated after graph reload", firstPass.afterMovedGraph);
        assert(afterPageReload.collapsed && afterPageReload.actionColumnHidden && afterPageReload.stored === "1", "Sidebar collapsed state did not survive page reload", afterPageReload);
        assert(afterPageReload.toggleText === "显示侧栏", "Sidebar toggle text did not restore after page reload", afterPageReload);
        assert(afterPageReload.overlayCount === 1 && afterPageReload.orphanOverlayCount === 0, "Bridge slot label overlays accumulated after page reload", afterPageReload);
        assert(afterPageReload.labelTexts.includes("model") && afterPageReload.labelTexts.includes("positive_text"), "Bridge slot labels disappeared after page reload", afterPageReload);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during sidebar/overlay cleanup check", bridgeConsoleErrors);
        return {
            overlayCount: afterPageReload.overlayCount,
            labelCount: afterPageReload.labelCount,
            collapsedAfterReload: afterPageReload.collapsed,
            stored: afterPageReload.stored,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyPositiveTextareaManualHeightPersists(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        const report = await page.evaluate(async (graphData) => {
            localStorage.removeItem("webui-bridge-textarea-height-prompt");
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "positive-textarea-height-persistence.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
            await new Promise((resolve) => setTimeout(resolve, 2200));
            const textarea = document.querySelector(".webui-bridge-positive-prompt-row textarea");
            if (!textarea) return { missingTextarea: true };
            textarea.focus();
            textarea.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 1 }));
            textarea.style.height = "260px";
            textarea.style.flex = "0 0 auto";
            textarea.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, pointerId: 1 }));
            const panel = document.querySelector(".webui-bridge-panel");
            panel?.__webuiBridgeScheduleAdaptiveLayout?.();
            await new Promise((resolve) => setTimeout(resolve, 900));
            const afterManual = Math.round(textarea.getBoundingClientRect().height);
            const storedAfterManual = localStorage.getItem("webui-bridge-textarea-height-prompt");
            panel?.__webuiBridgeScheduleAdaptiveLayout?.();
            await new Promise((resolve) => setTimeout(resolve, 900));
            const afterAdaptive = Math.round(textarea.getBoundingClientRect().height);
            const serialized = window.app.graph.serialize();
            await window.app.loadGraphData(serialized, true, true, undefined, {
                filename: "positive-textarea-height-persistence-reload.json",
            });
            await new Promise((resolve) => setTimeout(resolve, 2200));
            const reloadedTextarea = document.querySelector(".webui-bridge-positive-prompt-row textarea");
            return {
                afterManual,
                afterAdaptive,
                afterReload: Math.round(reloadedTextarea?.getBoundingClientRect?.().height || 0),
                storedAfterManual,
            };
        }, workflow);
        await screenshot(page, "compat-positive-textarea-height-persistence.png");
        assert(!report.missingTextarea, "Positive prompt textarea did not render", report);
        assert(Number(report.storedAfterManual) >= 240, "Manual textarea height was not persisted to localStorage", report);
        assert(report.afterManual >= 240 && report.afterAdaptive >= 240, "Adaptive layout pulled the positive textarea back down", report);
        assert(report.afterReload >= 240, "Positive textarea height did not survive reload", report);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during textarea height persistence check", bridgeConsoleErrors);
        return {
            afterManual: report.afterManual,
            afterAdaptive: report.afterAdaptive,
            afterReload: report.afterReload,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyQuickLoraDefaultVisibility(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 }, async (setupPage) => {
        await setupPage.route("**/webui_prompt_bridge/settings", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    settings: {
                        data_source: "auto",
                        translation_source: "auto",
                        tag_translation_source: "auto",
                        show_startup_wizard: false,
                        layout_preset: "default",
                        tag_display: "local_first",
                        lora_card_size: "normal",
                        node_tutorial_popup: "off",
                    },
                    custom_tag_count: 0,
                    assets: null,
                    module_assets: null,
                }),
            });
        });
    });
    try {
        const report = await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "quick-lora-default-visibility.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
            await new Promise((resolve) => setTimeout(resolve, 2200));
            const topButtons = [...document.querySelectorAll(".webui-bridge-top-controls button")]
                .map((button) => ({
                    text: (button.textContent || "").trim(),
                    title: button.title || "",
                    hidden: button.classList.contains("webui-bridge-ui-hidden") ||
                        getComputedStyle(button).display === "none" ||
                        getComputedStyle(button).visibility === "hidden",
                }));
            const settingsButton = [...document.querySelectorAll(".webui-bridge-top-controls button")]
                .find((button) => (button.textContent || "").trim() === "设置");
            settingsButton?.click();
            await new Promise((resolve) => setTimeout(resolve, 500));
            const visibilityChecks = [...document.querySelectorAll(".webui-bridge-visibility-check")]
                .map((label) => ({
                    text: (label.textContent || "").trim(),
                    checked: Boolean(label.querySelector("input")?.checked),
                }));
            const settingsText = document.querySelector(".webui-bridge-settings-panel")?.textContent || "";
            return {
                topButtons,
                quickButton: topButtons.find((button) => button.text === "快速添加 LoRA") || null,
                oldTopButton: topButtons.find((button) => button.text === "添加 LoRA") || null,
                quickVisibilityCheck: visibilityChecks.find((item) => item.text === "快速添加 LoRA") || null,
                settingsHasOldLabel: /顶部添加 LoRA/.test(settingsText),
            };
        }, workflow);
        await screenshot(page, "compat-quick-lora-default-visibility.png");
        assert(report.quickButton, "Quick LoRA top button did not render with the new label", report);
        assert(!report.quickButton.hidden, "Quick LoRA top button was not enabled by default", report);
        assert(/快速添加 LoRA/.test(report.quickButton.title), "Quick LoRA button tooltip did not use the new wording", report);
        assert(!report.oldTopButton, "Old top LoRA button label is still present", report);
        assert(report.quickVisibilityCheck?.checked === true, "Quick LoRA visibility setting was not checked by default", report);
        assert(!report.settingsHasOldLabel, "Old visibility label is still present in settings", report);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during Quick LoRA default check", bridgeConsoleErrors);
        return {
            quickButton: report.quickButton.text,
            quickVisibilityChecked: report.quickVisibilityCheck?.checked,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyVisibilitySettingsPersistAcrossReload(browser, baseUrl, workflow) {
    const originalResponse = await fetchBridgeSettings(baseUrl);
    const originalSettings = originalResponse.settings || {};
    const originalVisibility = originalSettings.ui_visibility || {};
    const seededSettings = {
        ...originalSettings,
        ui_visibility: {
            ...originalVisibility,
            top_lora: true,
            top_clip: false,
            styles: false,
            module_controlnet: false,
            module_sam: true,
            module_upscale: false,
        },
    };
    const expectedVisibility = {
        top_lora: false,
        top_clip: true,
        styles: true,
        module_controlnet: true,
        module_sam: false,
        module_upscale: true,
    };
    await saveBridgeSettingsForTest(baseUrl, seededSettings);

    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        const exerciseSettingsUi = async () => await page.evaluate(async ({ graphData, expected }) => {
            const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            const waitFor = async (predicate, timeoutMs = 20000) => {
                const started = performance.now();
                while (performance.now() - started < timeoutMs) {
                    const value = predicate();
                    if (value) return value;
                    await wait(100);
                }
                return null;
            };
            const visibilityState = (key) => {
                const target = document.querySelector(`[data-visibility-key="${key}"]`);
                return {
                    exists: Boolean(target),
                    text: (target?.textContent || "").trim().slice(0, 80),
                    hiddenClass: Boolean(target?.classList?.contains("webui-bridge-ui-hidden")),
                    display: target ? getComputedStyle(target).display : null,
                    visibility: target ? getComputedStyle(target).visibility : null,
                    height: Math.round(target?.getBoundingClientRect?.().height || 0),
                };
            };
            const openSettings = async () => {
                const settingsButton = [...document.querySelectorAll(".webui-bridge-top-controls button")]
                    .find((button) => (button.textContent || "").trim() === "设置");
                settingsButton?.click();
                await waitFor(() => document.querySelector(".webui-bridge-settings-panel"));
            };
            const setVisibilityCheck = (labelText, checked) => {
                const row = [...document.querySelectorAll(".webui-bridge-visibility-check")]
                    .find((label) => (label.textContent || "").trim() === labelText);
                const input = row?.querySelector("input");
                if (!input) return false;
                input.checked = checked;
                input.dispatchEvent(new Event("input", { bubbles: true }));
                input.dispatchEvent(new Event("change", { bubbles: true }));
                return true;
            };
            const visibilityChecks = () => Object.fromEntries([...document.querySelectorAll(".webui-bridge-visibility-check")]
                .map((label) => [(label.textContent || "").trim(), Boolean(label.querySelector("input")?.checked)]));

            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "visibility-settings-persist.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
            await wait(3200);
            const beforeSave = {
                top_lora: visibilityState("top_lora"),
                top_clip: visibilityState("top_clip"),
                styles: visibilityState("styles"),
                module_controlnet: visibilityState("module_controlnet"),
                module_sam: visibilityState("module_sam"),
                module_upscale: visibilityState("module_upscale"),
                modules: visibilityState(""),
            };

            await openSettings();
            const foundChecks = {
                "快速添加 LoRA": setVisibilityCheck("快速添加 LoRA", expected.top_lora),
                "CLIP 强度": setVisibilityCheck("CLIP 强度", expected.top_clip),
                "Styles 起手式": setVisibilityCheck("Styles 起手式", expected.styles),
                ControlNet: setVisibilityCheck("ControlNet", expected.module_controlnet),
                "SAM/Inpaint": setVisibilityCheck("SAM/Inpaint", expected.module_sam),
                "放大修复": setVisibilityCheck("放大修复", expected.module_upscale),
            };
            const saveButton = [...document.querySelectorAll(".webui-bridge-settings-panel .webui-bridge-config-actions button")]
                .find((button) => (button.textContent || "").trim() === "保存");
            saveButton?.click();
            await waitFor(() => !document.querySelector(".webui-bridge-settings-panel"), 30000);
            await wait(1000);
            const savedSettings = await fetch("/webui_prompt_bridge/settings", { cache: "no-store" }).then((response) => response.json()).then((data) => data.settings);
            return {
                beforeSave,
                foundChecks,
                savedVisibility: savedSettings?.ui_visibility || {},
                afterSave: {
                    top_lora: visibilityState("top_lora"),
                    top_clip: visibilityState("top_clip"),
                    styles: visibilityState("styles"),
                    module_controlnet: visibilityState("module_controlnet"),
                    module_sam: visibilityState("module_sam"),
                    module_upscale: visibilityState("module_upscale"),
                },
            };
        }, { graphData: workflow, expected: expectedVisibility });

        const firstPass = await exerciseSettingsUi();
        await screenshot(page, "compat-visibility-settings-after-save.png");
        await page.reload({ waitUntil: "domcontentloaded", timeout: 60000 });
        await page.waitForFunction(() => Boolean(window.app?.graph && window.app?.canvas && window.LiteGraph), null, {
            timeout: 60000,
        });
        const afterReload = await page.evaluate(async (graphData) => {
            const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            const visibilityState = (key) => {
                const target = document.querySelector(`[data-visibility-key="${key}"]`);
                return {
                    exists: Boolean(target),
                    hiddenClass: Boolean(target?.classList?.contains("webui-bridge-ui-hidden")),
                    display: target ? getComputedStyle(target).display : null,
                    height: Math.round(target?.getBoundingClientRect?.().height || 0),
                    text: (target?.textContent || "").trim().slice(0, 80),
                };
            };
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "visibility-settings-persist-reload.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
            await wait(3600);
            const settingsButton = [...document.querySelectorAll(".webui-bridge-top-controls button")]
                .find((button) => (button.textContent || "").trim() === "设置");
            settingsButton?.click();
            await wait(600);
            const checks = Object.fromEntries([...document.querySelectorAll(".webui-bridge-visibility-check")]
                .map((label) => [(label.textContent || "").trim(), Boolean(label.querySelector("input")?.checked)]));
            return {
                dom: {
                    top_lora: visibilityState("top_lora"),
                    top_clip: visibilityState("top_clip"),
                    styles: visibilityState("styles"),
                    module_controlnet: visibilityState("module_controlnet"),
                    module_sam: visibilityState("module_sam"),
                    module_upscale: visibilityState("module_upscale"),
                },
                checks,
            };
        }, workflow);
        await screenshot(page, "compat-visibility-settings-after-reload.png");

        assert(firstPass.beforeSave.module_upscale.hiddenClass === true, "Seeded hidden module_upscale state was not applied before UI save", firstPass);
        assert(Object.values(firstPass.foundChecks).every(Boolean), "Not all visibility checkboxes were found in settings", firstPass.foundChecks);
        for (const [key, expected] of Object.entries(expectedVisibility)) {
            assert(firstPass.savedVisibility[key] === expected, `Visibility setting ${key} was not saved by the settings UI`, firstPass.savedVisibility);
        }
        assert(firstPass.afterSave.module_upscale.hiddenClass === false && firstPass.afterSave.module_upscale.display !== "none", "module_upscale did not become visible immediately after saving", firstPass.afterSave);
        assert(firstPass.afterSave.module_controlnet.hiddenClass === false && firstPass.afterSave.module_controlnet.display !== "none", "module_controlnet did not become visible immediately after saving", firstPass.afterSave);
        assert(firstPass.afterSave.module_sam.hiddenClass === true && firstPass.afterSave.module_sam.display === "none", "module_sam did not hide immediately after saving", firstPass.afterSave);
        assert(firstPass.afterSave.styles.hiddenClass === false && firstPass.afterSave.styles.display !== "none", "styles did not become visible immediately after saving", firstPass.afterSave);
        assert(firstPass.afterSave.top_clip.hiddenClass === false && firstPass.afterSave.top_clip.display !== "none", "top_clip did not become visible immediately after saving", firstPass.afterSave);
        assert(firstPass.afterSave.top_lora.hiddenClass === true && firstPass.afterSave.top_lora.display === "none", "top_lora did not hide immediately after saving", firstPass.afterSave);
        assert(afterReload.dom.module_upscale.hiddenClass === false && afterReload.dom.module_upscale.display !== "none", "module_upscale visibility did not survive page reload", afterReload);
        assert(afterReload.dom.module_controlnet.hiddenClass === false && afterReload.dom.module_controlnet.display !== "none", "module_controlnet visibility did not survive page reload", afterReload);
        assert(afterReload.dom.module_sam.hiddenClass === true && afterReload.dom.module_sam.display === "none", "module_sam hidden state did not survive page reload", afterReload);
        assert(afterReload.dom.styles.hiddenClass === false && afterReload.dom.styles.display !== "none", "styles visibility did not survive page reload", afterReload);
        assert(afterReload.dom.top_clip.hiddenClass === false && afterReload.dom.top_clip.display !== "none", "top_clip visibility did not survive page reload", afterReload);
        assert(afterReload.dom.top_lora.hiddenClass === true && afterReload.dom.top_lora.display === "none", "top_lora hidden state did not survive page reload", afterReload);
        assert(afterReload.checks["放大修复"] === true && afterReload.checks.ControlNet === true && afterReload.checks["SAM/Inpaint"] === false, "Advanced module checkbox states did not survive page reload", afterReload.checks);
        assert(afterReload.checks["Styles 起手式"] === true && afterReload.checks["CLIP 强度"] === true && afterReload.checks["快速添加 LoRA"] === false, "Sidebar checkbox states did not survive page reload", afterReload.checks);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during visibility persistence check", bridgeConsoleErrors);
        return {
            savedVisibility: Object.fromEntries(Object.keys(expectedVisibility).map((key) => [key, firstPass.savedVisibility[key]])),
            reloadChecks: {
                upscale: afterReload.checks["放大修复"],
                controlnet: afterReload.checks.ControlNet,
                sam: afterReload.checks["SAM/Inpaint"],
                styles: afterReload.checks["Styles 起手式"],
                clip: afterReload.checks["CLIP 强度"],
                quickLora: afterReload.checks["快速添加 LoRA"],
            },
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await saveBridgeSettingsForTest(baseUrl, originalSettings).catch((error) => {
            console.warn(`Failed to restore original bridge settings: ${error?.message || error}`);
        });
        await context.close();
    }
}

async function verifyLoraDefaultPagingAndBasicLoad(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    const loraRequests = [];
    const detailRequests = [];
    const infoRequests = [];
    try {
        const mockLoras = mockLoraItems(160);
        await page.route("**/webui_prompt_bridge/loras*", async (route) => {
            loraRequests.push(route.request().url());
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ loras: mockLoras }),
            });
        });
        await page.route("**/webui_prompt_bridge/lora_user_metadata*", async (route) => {
            const url = new URL(route.request().url());
            detailRequests.push(url.href);
            const name = url.searchParams.get("name") || "mock-folder/mock-lora-001.safetensors";
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    requested: name,
                    name,
                    found: true,
                    thumbnail: "",
                    description: "",
                    user_metadata: {
                        description: "",
                        category: "",
                        "sd version": "Unknown",
                        "activation text": "lazy_detail_token",
                        "preferred weight": 0.85,
                        "negative text": "",
                        notes: "",
                    },
                    metadata_table: [],
                    training_tags: [],
                    summary: {},
                }),
            });
        });
        await page.route("**/webui_prompt_bridge/lora_info*", async (route) => {
            infoRequests.push(route.request().url());
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ trigger_words: [] }),
            });
        });
        const report = await page.evaluate(async (graphData) => {
            localStorage.setItem("webui-bridge-lora-page-size", "0");
            localStorage.removeItem("webui-bridge-lora-page-size-user-set");
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "lora-default-paging-basic-load.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
            await new Promise((resolve) => setTimeout(resolve, 2600));
            const beforeClick = {
                cardCount: document.querySelectorAll(".webui-bridge-card").length,
                pageSizeValue: document.querySelector(".webui-bridge-page-size")?.value || "",
                pageInfo: document.querySelector(".webui-bridge-page-info")?.textContent || "",
                countText: document.querySelector(".webui-bridge-network-count:last-child")?.textContent || "",
            };
            document.querySelector(".webui-bridge-card")?.click();
            await new Promise((resolve) => setTimeout(resolve, 900));
            const prompt = document.querySelector(".webui-bridge-positive-prompt-row textarea")?.value || "";
            const pageSize = document.querySelector(".webui-bridge-page-size");
            if (pageSize) {
                pageSize.value = "0";
                pageSize.dispatchEvent(new Event("change", { bubbles: true }));
            }
            const manualAllAfterChange = localStorage.getItem("webui-bridge-lora-page-size");
            const manualAllFlag = localStorage.getItem("webui-bridge-lora-page-size-user-set");
            return {
                ...beforeClick,
                prompt,
                manualAllAfterChange,
                manualAllFlag,
            };
        }, workflow);
        await screenshot(page, "compat-lora-default-paging-basic-load.png");
        assert(loraRequests.length > 0, "LoRA list was not requested during paging check", { loraRequests });
        assert(loraRequests.every((url) => /[?&]detail=basic\b/.test(url)), "Initial LoRA load did not use detail=basic", { loraRequests });
        assert(report.pageSizeValue === "32", "Default LoRA page size was not 32", report);
        assert(report.cardCount > 0 && report.cardCount <= 32, "LoRA cards rendered more than one default page", report);
        assert(/^1\/5$/.test(report.pageInfo), "LoRA pagination did not reflect mocked item count", report);
        assert(detailRequests.length === 1 && detailRequests.every((url) => /[?&]detail=basic\b/.test(url)), "LoRA click did not lazy-load lightweight metadata", { detailRequests });
        const clickedInfoRequests = infoRequests.filter((url) => /mock-folder%2Fmock-lora-001|mock-folder\/mock-lora-001/.test(url));
        assert(clickedInfoRequests.length <= 1, "LoRA click requested trigger metadata more than once", { infoRequests });
        assert(/lazy_detail_token/.test(report.prompt) && /<lora:mock-folder\/mock-lora-001:0\.85>/.test(report.prompt), "LoRA click did not insert prompt from lazy basic detail", report);
        assert(report.manualAllAfterChange === "0" && report.manualAllFlag === "1", "Manual LoRA page-size selection was not persisted", report);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during LoRA paging check", bridgeConsoleErrors);
        return {
            requests: loraRequests.length,
            detailRequests: detailRequests.length,
            infoRequests: clickedInfoRequests.length,
            cardCount: report.cardCount,
            pageInfo: report.pageInfo,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyLoraCardListScrollStatePersists(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        const mockLoras = mockLoraItems(160);
        await page.route("**/webui_prompt_bridge/loras*", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ loras: mockLoras }),
            });
        });
        const firstPass = await page.evaluate(async (graphData) => {
            const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            for (const key of [
                "webui-bridge-lora-page-size",
                "webui-bridge-lora-page-size-user-set",
                "webui-bridge-lora-scroll-top",
            ]) localStorage.removeItem(key);
            localStorage.setItem("webui-bridge-lora-page-size", "0");
            localStorage.setItem("webui-bridge-lora-page-size-user-set", "1");
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "lora-scroll-state.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
            await wait(3200);
            const grid = document.querySelector(".webui-bridge-card-grid");
            if (!grid) return { missingGrid: true };
            grid.scrollTop = 520;
            grid.dispatchEvent(new Event("scroll", { bubbles: true }));
            await wait(320);
            const beforeRender = Math.round(grid.scrollTop || 0);
            const checkbox = grid.querySelector("input[type='checkbox']");
            checkbox?.click();
            await wait(900);
            const afterRender = Math.round(grid.scrollTop || 0);
            const serialized = window.app.graph.serialize();
            const bridgeData = serialized.nodes?.find((node) => node.type === "WebUIPromptBridge");
            return {
                missingGrid: false,
                beforeRender,
                afterRender,
                stored: localStorage.getItem("webui-bridge-lora-scroll-top"),
                serialized,
                serializedState: bridgeData?.properties?.webui_prompt_bridge_layout || null,
                scrollHeight: grid.scrollHeight,
                clientHeight: grid.clientHeight,
            };
        }, workflow);
        assert(!firstPass.missingGrid, "LoRA card grid did not render", firstPass);
        assert(firstPass.beforeRender > 80, "LoRA card grid was not scrollable enough for the stability check", firstPass);
        assert(Math.abs(firstPass.afterRender - firstPass.beforeRender) <= 8,
            "LoRA card list jumped after card re-render", firstPass);
        assert(Number(firstPass.stored) > 80, "LoRA scroll position was not persisted locally", firstPass);
        assert(Number(firstPass.serializedState?.lora_scroll_top) > 80,
            "LoRA scroll position was not serialized into workflow layout state", firstPass);

        const secondPass = await page.evaluate(async ({ serialized }) => {
            const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            for (const key of [
                "webui-bridge-layout-storage-version",
                "webui-bridge-lora-scroll-top",
            ]) localStorage.removeItem(key);
            await window.app.loadGraphData(serialized, true, true, undefined, {
                filename: "lora-scroll-state-reload.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
            await wait(3200);
            const grid = document.querySelector(".webui-bridge-card-grid");
            return {
                scrollTop: Math.round(grid?.scrollTop || 0),
                stored: localStorage.getItem("webui-bridge-lora-scroll-top"),
            };
        }, { serialized: firstPass.serialized });
        await screenshot(page, "compat-lora-scroll-state-persistence.png");
        assert(Math.abs(secondPass.scrollTop - Number(firstPass.serializedState.lora_scroll_top)) <= 8,
            "Serialized LoRA scroll position did not restore after clearing localStorage", { firstPass, secondPass });
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during LoRA scroll-state check", bridgeConsoleErrors);
        return {
            beforeRender: firstPass.beforeRender,
            afterRender: firstPass.afterRender,
            afterReload: secondPass.scrollTop,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyPromptInnerDragDoesNotDrift(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        const mockLoras = mockLoraItems(160);
        await page.route("**/webui_prompt_bridge/loras*", async (route) => {
            await route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ loras: mockLoras }),
            });
        });
        await page.evaluate(async (graphData) => {
            for (const key of [
                "webui-bridge-layout-storage-version",
                "webui-bridge-lora-scroll-top",
                "webui-bridge-textarea-height-prompt",
                "webui-bridge-textarea-height-negative-prompt",
                "webui-bridge-chip-size-positive",
                "webui-bridge-chip-size-negative",
                "webui-bridge-aio-panel-height-positive",
                "webui-bridge-aio-panel-height-negative",
            ]) localStorage.removeItem(key);
            localStorage.setItem("webui-bridge-lora-page-size", "0");
            localStorage.setItem("webui-bridge-lora-page-size-user-set", "1");
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "prompt-inner-drag-stability.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        }, workflow);
        await page.waitForTimeout(3500);
        await page.evaluate(() => {
            const grid = document.querySelector(".webui-bridge-card-grid");
            if (grid) {
                grid.scrollTop = 620;
                grid.dispatchEvent(new Event("scroll", { bubbles: true }));
            }
        });
        await page.waitForTimeout(350);
        await dragElementCenter(page, ".webui-bridge-negative-main-resizer", 95);
        await dragElementCenter(page, ".webui-bridge-negative-detail-resizer", -70);
        const samples = [];
        for (let index = 0; index < 8; index += 1) {
            await page.waitForTimeout(500);
            samples.push(await promptInnerLayoutSnapshot(page, `sample-${index}`));
        }
        await screenshot(page, "compat-prompt-inner-drag-stability.png");
        const first = samples[0];
        const last = samples[samples.length - 1];
        for (const key of ["topRow", "extra", "negativeTextarea", "grid"]) {
            for (const dim of key === "grid" ? ["top", "height", "scrollTop"] : ["top", "height"]) {
                const from = first[key]?.[dim];
                const to = last[key]?.[dim];
                assert(Number.isFinite(from) && Number.isFinite(to) && Math.abs(from - to) <= 4,
                    `Prompt inner drag drifted after settle: ${key}.${dim}`, { samples });
            }
        }
        const serialized = await page.evaluate(() => window.app.graph.serialize());
        const bridgeData = serialized.nodes?.find((node) => node.type === "WebUIPromptBridge");
        const state = bridgeData?.properties?.webui_prompt_bridge_layout || null;
        assert(state, "Prompt inner drag did not serialize bridge layout state", { state, samples });
        assert(Number(state.lora_scroll_top) >= 80, "LoRA scroll was not serialized after prompt drag", { state, samples });
        assert(Number(state.negative_textarea_height) > 0 || Number(state.positive_tag_height) > 0,
            "Prompt inner drag heights were not serialized", { state, samples });
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during prompt inner drag check", bridgeConsoleErrors);
        return {
            first,
            last,
            serializedState: state,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyLoraBrowserFlow(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "lora-browser-flow.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        }, workflow);
        await page.waitForTimeout(3500);
        const report = await page.evaluate(async () => {
            const positiveTextarea = document.querySelector(".webui-bridge-positive-prompt-row textarea");
            const card = document.querySelector(".webui-bridge-card");
            const checkbox = card?.querySelector("input[type='checkbox']");
            const addButton = [...document.querySelectorAll("button")]
                .find((button) => /添加选中到正向/.test(button.textContent || ""));
            if (!positiveTextarea || !card || !checkbox || !addButton) {
                return {
                    missing: {
                        positiveTextarea: !positiveTextarea,
                        card: !card,
                        checkbox: !checkbox,
                        addButton: !addButton,
                    },
                };
            }
            const before = positiveTextarea.value;
            checkbox.click();
            await new Promise((resolve) => setTimeout(resolve, 250));
            addButton.click();
            await new Promise((resolve) => setTimeout(resolve, 650));
            const after = positiveTextarea.value;
            return {
                cardText: card.textContent?.slice(0, 180) || "",
                checked: checkbox.checked,
                beforeLength: before.length,
                afterLength: after.length,
                addedText: after.slice(before.length),
                containsNewLora: /<\s*lora:[^>]+>/i.test(after.slice(before.length)),
                totalLoraTags: (after.match(/<\s*lora:/gi) || []).length,
            };
        });
        await screenshot(page, "compat-lora-browser-flow.png");
        assert(!report.missing, "LoRA browser flow did not render expected controls", report);
        assert(report.checked, "LoRA card checkbox did not become selected", report);
        assert(report.afterLength > report.beforeLength, "Adding selected LoRA did not change the positive prompt", report);
        assert(report.containsNewLora, "Adding selected LoRA did not insert a LoRA tag", report);
        assert(report.totalLoraTags >= 1, "Positive prompt did not contain any LoRA tags after adding selected LoRA", report);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during LoRA browser flow", bridgeConsoleErrors);
        return {
            totalLoraTags: report.totalLoraTags,
            addedText: report.addedText.trim().slice(0, 120),
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyBridgeSettingsRoundTrip(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        const report = await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "settings-round-trip.json",
            });
            await new Promise((resolve) => setTimeout(resolve, 2200));
            const marker = `codex-roundtrip-${Date.now()}`;
            const textareas = [...document.querySelectorAll(".webui-bridge-prompt-row textarea")];
            if (textareas.length < 2) {
                return { marker, missingTextareas: textareas.length };
            }
            const setTextarea = (textarea, value) => {
                textarea.value = value;
                textarea.dispatchEvent(new Event("input", { bubbles: true }));
                textarea.dispatchEvent(new Event("change", { bubbles: true }));
            };
            setTextarea(textareas[0], `positive ${marker}`);
            setTextarea(textareas[1], `negative ${marker}`);
            await new Promise((resolve) => setTimeout(resolve, 300));
            const serialized = window.app.graph.serialize();
            await window.app.loadGraphData(serialized, true, true, undefined, {
                filename: "settings-round-trip-reload.json",
            });
            await new Promise((resolve) => setTimeout(resolve, 2200));
            const bridge = window.app.graph._nodes.find((node) => node.type === "WebUIPromptBridge");
            const widgetValues = Object.fromEntries((bridge?.widgets || [])
                .filter((widget) => ["positive_prompt", "negative_prompt"].includes(widget.name))
                .map((widget) => [widget.name, widget.value]));
            const uiValues = [...document.querySelectorAll(".webui-bridge-prompt-row textarea")]
                .slice(0, 2)
                .map((textarea) => textarea.value);
            let graphToPromptOk = false;
            let graphToPromptError = null;
            try {
                const prompt = await window.app.graphToPrompt();
                graphToPromptOk = Boolean(prompt?.output && prompt?.workflow);
            } catch (error) {
                graphToPromptError = String(error?.stack || error);
            }
            return {
                marker,
                widgetValues,
                uiValues,
                widgetCount: bridge?.widgets_values?.length || bridge?.widgets?.length || 0,
                graphToPromptOk,
                graphToPromptError,
            };
        }, workflow);
        await screenshot(page, "compat-settings-round-trip.png");
        assert(!report.missingTextareas, "Bridge prompt textareas did not render for settings round-trip", report);
        assert(report.widgetValues?.positive_prompt === `positive ${report.marker}`, "Positive prompt widget value did not survive reload", report);
        assert(report.widgetValues?.negative_prompt === `negative ${report.marker}`, "Negative prompt widget value did not survive reload", report);
        assert(report.uiValues?.[0] === `positive ${report.marker}`, "Positive prompt UI value did not survive reload", report);
        assert(report.uiValues?.[1] === `negative ${report.marker}`, "Negative prompt UI value did not survive reload", report);
        assert(report.widgetCount >= 60, "Bridge widget values were not complete after settings round-trip", report);
        assert(report.graphToPromptOk, "graphToPrompt failed after settings round-trip", report);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during settings round-trip", bridgeConsoleErrors);
        return {
            marker: report.marker,
            widgetCount: report.widgetCount,
            graphToPromptOk: report.graphToPromptOk,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyBridgeLayoutPreferencePersistence(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        const firstPass = await page.evaluate(async (graphData) => {
            localStorage.removeItem("webui-bridge-negative-collapsed");
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "layout-preference-persistence.json",
            });
            await new Promise((resolve) => setTimeout(resolve, 2200));
            const collapseButton = [...document.querySelectorAll(".webui-bridge-collapse-btn")]
                .find((button) => /折叠反向|展开反向/.test(button.textContent || ""));
            if (!collapseButton) return { missingCollapseButton: true };
            if ((collapseButton.textContent || "").includes("折叠")) collapseButton.click();
            await new Promise((resolve) => setTimeout(resolve, 500));
            const negativeRow = [...document.querySelectorAll(".webui-bridge-prompt-row")]
                .find((row) => !row.classList.contains("webui-bridge-positive-prompt-row"));
            return {
                collapsed: negativeRow?.classList.contains("collapsed") || false,
                stored: localStorage.getItem("webui-bridge-negative-collapsed"),
            };
        }, workflow);
        assert(!firstPass.missingCollapseButton, "Negative collapse button missing before persistence check", firstPass);
        assert(firstPass.collapsed, "Negative prompt did not collapse before persistence check", firstPass);
        assert(firstPass.stored === "1" || firstPass.stored === "true", "Collapsed state was not written to localStorage", firstPass);

        await page.goto(`${baseUrl}/?layout_preference_reload=${Date.now()}`, {
            waitUntil: "domcontentloaded",
            timeout: 60000,
        });
        await page.waitForFunction(() => Boolean(window.app?.graph && window.app?.canvas && window.LiteGraph), null, {
            timeout: 60000,
        });
        const secondPass = await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "layout-preference-persistence-reload.json",
            });
            await new Promise((resolve) => setTimeout(resolve, 2200));
            const negativeRow = [...document.querySelectorAll(".webui-bridge-prompt-row")]
                .find((row) => !row.classList.contains("webui-bridge-positive-prompt-row"));
            const button = document.querySelector(".webui-bridge-collapse-btn");
            return {
                collapsed: negativeRow?.classList.contains("collapsed") || false,
                buttonText: button?.textContent || "",
                stored: localStorage.getItem("webui-bridge-negative-collapsed"),
            };
        }, workflow);
        await screenshot(page, "compat-layout-preference-persistence.png");
        assert(secondPass.collapsed, "Collapsed negative prompt state did not persist after page reload", secondPass);
        assert(/展开反向/.test(secondPass.buttonText), "Collapse button did not reflect persisted collapsed state", secondPass);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during layout preference persistence check", bridgeConsoleErrors);
        return {
            collapsedAfterReload: secondPass.collapsed,
            stored: secondPass.stored,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifySerializedBridgeLayoutStateRestoresWithoutLocalStorage(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages, { width: 1600, height: 1300 });
    try {
        const clearLayoutKeys = [
            "webui-bridge-layout-storage-version",
            "webui-bridge-toprow-height",
            "webui-bridge-extra-height",
            "webui-bridge-extra-collapsed",
            "webui-bridge-action-column-collapsed",
            "webui-bridge-action-column-width",
            "webui-bridge-negative-collapsed",
            "webui-bridge-textarea-height-prompt",
            "webui-bridge-textarea-height-negative-prompt",
            "webui-bridge-chip-size-positive",
            "webui-bridge-chip-size-negative",
            "webui-bridge-aio-panel-height-positive",
            "webui-bridge-aio-panel-height-negative",
        ];
        await page.evaluate(async ({ graphData, keys }) => {
            for (const key of keys) localStorage.removeItem(key);
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "serialized-layout-state-before.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        }, { graphData: workflow, keys: clearLayoutKeys });
        await page.waitForTimeout(3500);
        await dragElementCenterBy(page, ".webui-bridge-side-resizer", -90, 0);
        await dragElementCenter(page, ".webui-bridge-panel-splitter", -70);
        await page.waitForTimeout(1500);
        const saved = await page.evaluate(() => {
            const serialized = window.app.graph.serialize();
            const bridgeData = serialized.nodes?.find((node) => node.type === "WebUIPromptBridge");
            const state = bridgeData?.properties?.webui_prompt_bridge_layout || null;
            const topRow = document.querySelector(".webui-bridge-toprow");
            const style = topRow ? getComputedStyle(topRow) : null;
            return {
                serialized,
                state,
                sidebarWidthVar: style?.getPropertyValue("--webui-bridge-sidebar-width")?.trim() || "",
                topRowHeight: Math.round(topRow?.getBoundingClientRect?.().height || 0),
                localSidebarWidth: localStorage.getItem("webui-bridge-action-column-width"),
            };
        });
        assert(saved.state, "Bridge layout state was not serialized into node properties", saved);
        assert(Number(saved.state.sidebar_width) >= 450, "Dragged sidebar width was not captured in serialized layout state", saved);
        assert(Number(saved.localSidebarWidth) >= 450, "Dragged sidebar width was not persisted locally", saved);

        await page.evaluate(async ({ serialized, keys }) => {
            for (const key of keys) localStorage.removeItem(key);
            await window.app.loadGraphData(serialized, true, true, undefined, {
                filename: "serialized-layout-state-after-clear-local.json",
            });
            window.app.canvas.ds.offset = [55, 35];
            window.app.canvas.ds.scale = 1;
            window.app.canvas.setDirty(true, true);
        }, { serialized: saved.serialized, keys: clearLayoutKeys });
        await page.waitForTimeout(3500);
        const restored = await page.evaluate(() => {
            const topRow = document.querySelector(".webui-bridge-toprow");
            const extra = document.querySelector(".webui-bridge-extra");
            const style = topRow ? getComputedStyle(topRow) : null;
            const bridge = window.app.graph._nodes.find((node) => node.type === "WebUIPromptBridge");
            return {
                state: bridge?.__webuiBridgeConfiguredLayoutState || null,
                sidebarWidthVar: style?.getPropertyValue("--webui-bridge-sidebar-width")?.trim() || "",
                sidebarWidth: Number.parseFloat(style?.getPropertyValue("--webui-bridge-sidebar-width") || "0"),
                topRowHeight: Math.round(topRow?.getBoundingClientRect?.().height || 0),
                extraHeight: Math.round(extra?.getBoundingClientRect?.().height || 0),
                localSidebarWidth: localStorage.getItem("webui-bridge-action-column-width"),
            };
        });
        await screenshot(page, "compat-serialized-layout-state-restored.png");
        assert(Math.abs(restored.sidebarWidth - Number(saved.state.sidebar_width)) <= 2,
            "Serialized sidebar width did not restore after clearing localStorage", { saved, restored });
        assert(Math.abs(restored.topRowHeight - Number(saved.state.top_row_height)) <= 4,
            "Serialized top-row height did not restore after clearing localStorage", { saved, restored });
        assert(Number(restored.localSidebarWidth) >= 450,
            "Serialized sidebar width was not reseeded into localStorage after reload", { saved, restored });
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during serialized layout-state check", bridgeConsoleErrors);
        return {
            sidebarWidth: restored.sidebarWidthVar,
            topRowHeight: restored.topRowHeight,
            extraHeight: restored.extraHeight,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifySerializedBridgeLayoutStateOverridesStaleLocalBooleans(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(
        browser,
        baseUrl,
        consoleMessages,
        { width: 1600, height: 1300 },
        async (setupPage) => {
            const mockLoras = mockLoraItems(160);
            await setupPage.route("**/webui_prompt_bridge/loras*", async (route) => {
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    body: JSON.stringify({ loras: mockLoras }),
                });
            });
        },
    );
    try {
        const savedWorkflow = JSON.parse(JSON.stringify(workflow));
        const bridgeData = savedWorkflow.nodes?.find((node) => node.type === "WebUIPromptBridge");
        assert(bridgeData, "Saved-layout workflow is missing the WebUIPromptBridge node");
        bridgeData.size = [1180, 1040];
        bridgeData.properties = {
            ...(bridgeData.properties || {}),
            webui_prompt_bridge_layout: {
                version: 1,
                top_row_height: 820,
                extra_height: 202,
                sidebar_width: 400,
                positive_textarea_height: 112,
                negative_textarea_height: 220,
                positive_chip_height: 132,
                negative_chip_height: 104,
                positive_tag_height: 238,
                negative_tag_height: 240,
                lora_scroll_top: 420,
                extra_collapsed: false,
                sidebar_collapsed: false,
                negative_collapsed: false,
            },
        };
        const layoutKeys = [
            "webui-bridge-layout-storage-version",
            "webui-bridge-toprow-height",
            "webui-bridge-extra-height",
            "webui-bridge-extra-collapsed",
            "webui-bridge-action-column-width",
            "webui-bridge-action-column-collapsed",
            "webui-bridge-negative-collapsed",
            "webui-bridge-textarea-height-prompt",
            "webui-bridge-textarea-height-negative-prompt",
            "webui-bridge-chip-size-positive",
            "webui-bridge-chip-size-negative",
            "webui-bridge-aio-panel-height-positive",
            "webui-bridge-aio-panel-height-negative",
            "webui-bridge-lora-scroll-top",
        ];
        const report = await page.evaluate(async ({ graphData, keys }) => {
            const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
            const loadGraph = async (filename) => {
                await window.app.loadGraphData(JSON.parse(JSON.stringify(graphData)), true, true, undefined, {
                    filename,
                });
                window.app.canvas.ds.offset = [55, 35];
                window.app.canvas.ds.scale = 1;
                window.app.canvas.setDirty(true, true);
            };
            const snapshot = (label) => {
                const rect = (selector) => {
                    const element = document.querySelector(selector);
                    if (!element) return null;
                    const box = element.getBoundingClientRect();
                    return {
                        top: Math.round(box.top),
                        bottom: Math.round(box.bottom),
                        height: Math.round(box.height),
                    };
                };
                const bridge = window.app.graph._nodes.find((node) => node.type === "WebUIPromptBridge");
                const negativeRow = [...document.querySelectorAll(".webui-bridge-prompt-row")]
                    .find((row) => !row.classList.contains("webui-bridge-positive-prompt-row"));
                const extra = document.querySelector(".webui-bridge-extra");
                const action = document.querySelector(".webui-bridge-action-column");
                return {
                    label,
                    nodeSize: bridge?.size ? Array.from(bridge.size).map((value) => Math.round(value)) : null,
                    topRow: rect(".webui-bridge-toprow"),
                    extra: rect(".webui-bridge-extra"),
                    grid: rect(".webui-bridge-card-grid"),
                    negativeCollapsed: Boolean(negativeRow?.classList.contains("collapsed")),
                    extraCollapsed: Boolean(extra?.classList.contains("collapsed")),
                    sidebarCollapsed: Boolean(action?.classList.contains("collapsed")),
                    local: {
                        top: localStorage.getItem("webui-bridge-toprow-height"),
                        extra: localStorage.getItem("webui-bridge-extra-height"),
                        negativeCollapsed: localStorage.getItem("webui-bridge-negative-collapsed"),
                        extraCollapsed: localStorage.getItem("webui-bridge-extra-collapsed"),
                        sidebarCollapsed: localStorage.getItem("webui-bridge-action-column-collapsed"),
                    },
                    state: bridge?.__webuiBridgePanel?.__webuiBridgeGetLayoutState?.() || null,
                };
            };
            for (const key of keys) localStorage.removeItem(key);
            localStorage.setItem("webui-bridge-lora-page-size", "0");
            localStorage.setItem("webui-bridge-lora-page-size-user-set", "1");
            await loadGraph("serialized-layout-state-stale-bool-prime.json");
            await wait(3500);
            const primed = snapshot("primed");
            localStorage.setItem("webui-bridge-negative-collapsed", "1");
            localStorage.setItem("webui-bridge-extra-collapsed", "1");
            localStorage.setItem("webui-bridge-action-column-collapsed", "1");
            await loadGraph("serialized-layout-state-stale-bool-restore.json");
            await wait(4500);
            return {
                primed,
                restored: snapshot("restored"),
            };
        }, { graphData: savedWorkflow, keys: layoutKeys });
        await screenshot(page, "compat-serialized-layout-state-overrides-stale-local-booleans.png");
        assert(!report.restored.negativeCollapsed,
            "Serialized negative prompt expanded state was overridden by stale localStorage", report);
        assert(!report.restored.extraCollapsed,
            "Serialized LoRA expanded state was overridden by stale localStorage", report);
        assert(!report.restored.sidebarCollapsed,
            "Serialized sidebar expanded state was overridden by stale localStorage", report);
        assert(report.restored.local.negativeCollapsed === "0",
            "Serialized negative collapse state was not written back to localStorage", report);
        assert(report.restored.local.extraCollapsed === "0",
            "Serialized LoRA collapse state was not written back to localStorage", report);
        assert(report.restored.local.sidebarCollapsed === "0",
            "Serialized sidebar collapse state was not written back to localStorage", report);
        assert(Math.abs((report.restored.topRow?.height || 0) - (report.primed.topRow?.height || 0)) <= 2,
            "Serialized prompt layout was not restored over stale localStorage", report);
        const bridgeConsoleErrors = consoleMessages.filter((message) =>
            ["error", "pageerror"].includes(message.type) &&
            /WebUI Prompt Bridge|WebUIPromptBridge|webui_prompt_bridge/i.test(message.text)
        );
        assert(bridgeConsoleErrors.length === 0, "WebUIPromptBridge reported console errors during stale-local-boolean restore check", bridgeConsoleErrors);
        return {
            restoredTopRowHeight: report.restored.topRow.height,
            restoredExtraHeight: report.restored.extra.height,
            local: report.restored.local,
            bridgeConsoleErrors: bridgeConsoleErrors.length,
        };
    } finally {
        await context.close();
    }
}

async function verifyOldWorkflowCompatibility(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages);
    try {
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "old-layout-compat-test.json",
            });
        }, makeOldWorkflow(workflow));
        await page.waitForTimeout(2500);
        const report = await page.evaluate(async (ids) => {
            const switches = ids.map((id) => {
                const node = window.app.graph.getNodeById(id);
                const graphPoint = [node.pos[0] + 80, node.pos[1] + (node.widgets?.[0]?.y || 26) + 9];
                const hit = window.app.graph.getNodeOnPos(graphPoint[0], graphPoint[1], null, 0);
                return {
                    id,
                    pos: Array.from(node.pos || []),
                    hitSelfAtWidget: hit?.id === id,
                    value: node.widgets?.[0]?.value,
                };
            });
            const bridge = window.app.graph._nodes.find((node) => node.type === "WebUIPromptBridge");
            let graphToPromptOk = false;
            let graphToPromptError = null;
            try {
                const prompt = await window.app.graphToPrompt();
                graphToPromptOk = Boolean(prompt?.output && prompt?.workflow);
            } catch (error) {
                graphToPromptError = String(error?.stack || error);
            }
            return {
                switches,
                bridgeSize: bridge ? Array.from(bridge.size || []) : null,
                bridgeWidgetCount: bridge?.widgets_values?.length || bridge?.widgets?.length || 0,
                graphToPromptOk,
                graphToPromptError,
            };
        }, switchIds);
        await screenshot(page, "compat-old-workflow-layout.png");
        assert(report.switches.every((item) => item.pos[0] >= 1300), "Old workflow switch positions were not repaired", report.switches);
        assert(report.switches.every((item) => item.hitSelfAtWidget), "Old workflow switches are still occluded", report.switches);
        assert(report.bridgeWidgetCount >= 60, "Legacy WebUIPromptBridge widget values were not repaired", report);
        assert(report.graphToPromptOk, "Old workflow graphToPrompt failed", report);
        return report;
    } finally {
        await context.close();
    }
}

async function verifyQueueGeneration(browser, baseUrl, workflow) {
    const consoleMessages = [];
    const { context, page } = await newComfyPage(browser, baseUrl, consoleMessages);
    try {
        await page.evaluate(async (graphData) => {
            await window.app.loadGraphData(graphData, true, true, undefined, {
                filename: "anima-webui-prompt-bridge.json",
            });
        }, workflow);
        await page.waitForTimeout(2200);
        const submit = await page.evaluate(async () => {
            for (const id of [10, 15, 19, 24, 40, 47, 196, 197, 198]) {
                const node = window.app.graph.getNodeById(id);
                if (node?.widgets?.[0]) node.widgets[0].value = false;
                if (Array.isArray(node?.widgets_values)) node.widgets_values[0] = false;
            }
            const save = window.app.graph.getNodeById(9);
            const prefixWidget = save?.widgets?.find((widget) => widget.name === "filename_prefix") || save?.widgets?.[0];
            if (prefixWidget) prefixWidget.value = "webui_bridge_regression_verify";
            const graphPrompt = await window.app.graphToPrompt();
            const response = await fetch("/prompt", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: graphPrompt.output,
                    workflow: graphPrompt.workflow,
                    client_id: `webui-bridge-regression-${Date.now()}`,
                }),
            });
            const data = await response.json();
            return { ok: response.ok, status: response.status, data };
        });
        assert(submit.ok && submit.data?.prompt_id && !Object.keys(submit.data.node_errors || {}).length, "Prompt submission failed", submit);
        let historyItem = null;
        for (let attempt = 0; attempt < 60; attempt += 1) {
            const poll = await page.evaluate(async (promptId) => {
                const [historyResponse, queueResponse] = await Promise.all([
                    fetch(`/history/${promptId}`),
                    fetch("/queue"),
                ]);
                const history = await historyResponse.json();
                const queue = await queueResponse.json();
                return {
                    item: history[promptId] || null,
                    queueRunning: queue?.queue_running?.length || 0,
                    queuePending: queue?.queue_pending?.length || 0,
                };
            }, submit.data.prompt_id);
            if (poll.item) {
                historyItem = poll.item;
                break;
            }
            await page.waitForTimeout(3000);
        }
        assert(historyItem?.status?.completed && historyItem?.status?.status_str === "success", "Prompt did not complete successfully", historyItem);
        const outputImages = Object.values(historyItem.outputs || {}).flatMap((output) => output.images || []);
        assert(outputImages.some((image) => image.type === "output"), "Generation finished without an output image", outputImages);
        return { promptId: submit.data.prompt_id, images: outputImages };
    } finally {
        await context.close();
    }
}

async function main() {
    const options = parseArgs();
    const { chromium } = await importPlaywright();
    const browser = await chromium.launch({ headless: !options.headed });
    const workflow = await loadWorkflow();
    try {
        const results = options.focusedFixes ? {
            startupWizardRequiresLoadedConfiguration: await verifyStartupWizardRequiresLoadedConfiguration(browser, options.baseUrl),
            maskEditorLoadGuardsAndCanvasBudget: await verifyMaskEditorLoadGuardsAndCanvasBudget(browser, options.baseUrl),
            compactSidebarTabsAndLowZoomSummary: await verifyCompactSidebarTabsAndLowZoomSummary(browser, options.baseUrl),
        } : {
            bridgeEventFix: await verifyBridgeDoesNotCancelCanvasWidgets(browser, options.baseUrl),
            commonWidgetCompatibility: await verifyCommonWidgetCompatibility(browser, options.baseUrl),
            fullWorkflowSwitches: await verifyFullWorkflowSwitches(browser, options.baseUrl, workflow),
            currentWorkflowLayoutIdempotency: await verifyCurrentWorkflowLayoutIdempotency(browser, options.baseUrl, workflow),
            customWorkflowLayoutPreserved: await verifyCustomWorkflowLayoutPreserved(browser, options.baseUrl, workflow),
            bridgeUiErgonomics: await verifyBridgeUiErgonomics(browser, options.baseUrl, workflow),
            bridgeImageInputPanelErgonomics: await verifyBridgeImageInputPanelErgonomics(browser, options.baseUrl),
            startupWizardRequiresLoadedConfiguration: await verifyStartupWizardRequiresLoadedConfiguration(browser, options.baseUrl),
            maskEditorLoadGuardsAndCanvasBudget: await verifyMaskEditorLoadGuardsAndCanvasBudget(browser, options.baseUrl),
            compactSidebarTabsAndLowZoomSummary: await verifyCompactSidebarTabsAndLowZoomSummary(browser, options.baseUrl),
            exactPromptTagToggle: await verifyExactPromptTagToggle(browser, options.baseUrl),
            fullNegativeCollapseReclaimsLoraSpace: await verifyFullNegativeCollapseReclaimsLoraSpace(browser, options.baseUrl, workflow),
            sectionResizeBlankRecovery: await verifySectionResizeBlankRecovery(browser, options.baseUrl, workflow),
            restoreSizeStability: await verifyRestoreSizeStability(browser, options.baseUrl, workflow),
            canvasPanDoesNotMutateBridgeLayout: await verifyCanvasPanDoesNotMutateBridgeLayout(browser, options.baseUrl, workflow),
            offscreenCanvasPanDoesNotCollapseBridgeLayout: await verifyOffscreenCanvasPanDoesNotCollapseBridgeLayout(browser, options.baseUrl, workflow),
            largeSavedLayoutSettlesAfterModeSwitch: await verifyLargeSavedLayoutSettlesAfterModeSwitch(browser, options.baseUrl, workflow),
            regionalCanvasSizeDoesNotMutateLayout: await verifyRegionalCanvasSizeDoesNotMutateLayout(browser, options.baseUrl, workflow),
            nodeSizeInputIsUserAuthority: await verifyNodeSizeInputIsUserAuthority(browser, options.baseUrl, workflow),
            flatSavedBridgeSizeRepair: await verifyFlatSavedBridgeSizeRepair(browser, options.baseUrl, workflow),
            largeSavedBridgeSizePreservedAndPortGutters: await verifyLargeSavedBridgeSizePreservedAndPortGutters(browser, options.baseUrl, workflow),
            sidebarCollapsePersistenceAndSlotLabelCleanup: await verifySidebarCollapsePersistenceAndSlotLabelCleanup(browser, options.baseUrl, workflow),
            positiveTextareaManualHeightPersists: await verifyPositiveTextareaManualHeightPersists(browser, options.baseUrl, workflow),
            quickLoraDefaultVisibility: await verifyQuickLoraDefaultVisibility(browser, options.baseUrl, workflow),
            visibilitySettingsPersistAcrossReload: await verifyVisibilitySettingsPersistAcrossReload(browser, options.baseUrl, workflow),
            loraDefaultPagingAndBasicLoad: await verifyLoraDefaultPagingAndBasicLoad(browser, options.baseUrl, workflow),
            loraCardListScrollStatePersists: await verifyLoraCardListScrollStatePersists(browser, options.baseUrl, workflow),
            promptInnerDragDoesNotDrift: await verifyPromptInnerDragDoesNotDrift(browser, options.baseUrl, workflow),
            loraBrowserFlow: await verifyLoraBrowserFlow(browser, options.baseUrl, workflow),
            bridgeSettingsRoundTrip: await verifyBridgeSettingsRoundTrip(browser, options.baseUrl, workflow),
            bridgeLayoutPreferencePersistence: await verifyBridgeLayoutPreferencePersistence(browser, options.baseUrl, workflow),
            serializedBridgeLayoutState: await verifySerializedBridgeLayoutStateRestoresWithoutLocalStorage(browser, options.baseUrl, workflow),
            serializedBridgeLayoutStateOverridesStaleLocalBooleans: await verifySerializedBridgeLayoutStateOverridesStaleLocalBooleans(browser, options.baseUrl, workflow),
            oldWorkflowCompatibility: await verifyOldWorkflowCompatibility(browser, options.baseUrl, workflow),
        };
        if (options.queue) {
            results.queueGeneration = await verifyQueueGeneration(browser, options.baseUrl, workflow);
        }
        console.log(JSON.stringify({
            ok: true,
            baseUrl: options.baseUrl,
            comfyRoot,
            results,
        }, null, 2));
    } finally {
        await browser.close();
    }
}

main().catch((error) => {
    console.error(error?.stack || error);
    process.exitCode = 1;
});
