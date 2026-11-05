import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source = readFileSync(new URL("../web/webui_prompt_bridge.js", import.meta.url), "utf8");
function functionSource(name, optional = false) {
    const start = source.indexOf(`function ${name}(`);
    if (start < 0 && optional) return "";
    assert(start >= 0, `Missing lifecycle helper ${name}`);
    const ends = [source.indexOf("\nfunction ", start + 1), source.indexOf("\nasync function ", start + 1)]
        .filter(index => index > start);
    return source.slice(start, Math.min(...ends));
}
function fixture() {
    const frames = [];
    const logs = [];
    const panel = { isConnected: true, style: {}, querySelector: () => ({}), remove() { this.isConnected = false; } };
    const originalCompute = () => [300, 80];
    const originalDraw = () => {};
    const widget = { name: "positive_prompt", type: "customtext", value: "keep this prompt", computeSize: originalCompute,
        draw: originalDraw, hidden: false, options: { getMinHeight: () => 40, getMaxHeight: () => 80 } };
    const node = { widgets: [widget], size: [1000, 700], graph: {},
        __webuiBridgeDesiredSize: [1000, 700], __webuiBridgeConnectionsWrapped: true, __webuiBridgeSerializeWrapped: true,
        addDOMWidget(name, type, element, options) { const dom = { name, type, element, options }; this.widgets.push(dom); return dom; },
        addWidget(type, name, value, callback, options) { const added = { type, name, value, callback, options }; this.widgets.push(added); return added; },
        setDirtyCanvas() {},
    };
    const noop = () => {};
    const context = vm.createContext({
        app: {}, performance: { now: () => 10000 }, requestAnimationFrame: callback => { frames.push(callback); return frames.length; },
        window: { requestAnimationFrame: callback => { frames.push(callback); return frames.length; }, setTimeout: noop },
        console: { error: (...args) => logs.push(args), warn: (...args) => logs.push(args) },
        PROMPT_WIDGETS: new Set(["positive_prompt"]),
        DEFAULT_PANEL_WIDTH: 1000, DEFAULT_PANEL_HEIGHT: 700, PANEL_MIN_WIDTH: 100, PANEL_MIN_HEIGHT: 100,
        PANEL_MAX_WIDTH: 4000, PANEL_MAX_HEIGHT: 4000, DOM_WIDGET_CONTENT_MIN_WIDTH: 100,
        DOM_WIDGET_PANEL_PAD: 20, DOM_WIDGET_INPUT_LABEL_GUTTER: 20, DOM_WIDGET_OUTPUT_LABEL_GUTTER: 20,
        repairComfyCorePackageMetadata: noop, repairBridgeNodeWidgetDefaults: noop,
        removeBridgeSlotLabelOverlay: noop, installBridgeSlotLabelOverlay: noop,
        shouldRepairBridgePanelSize: () => false, hasBridgeLayoutState: () => false,
        nodeHasSavedUserBridgePanelSize: () => false, looksLikeLegacyDefaultSize: () => false,
        clampPanelSize: (width, height) => [width, height], normalizeBridgePanelSize: size => [...size],
        buildPanel: () => panel, createPanelErrorView: () => panel,
        installWidgetSerializationFallback: noop, pinBridgeDomWidgetToTop: noop,
        ensureGraphLinksSerializableCompatibility: noop, syncBridgeDomWidgetWrapper: noop,
        scheduleBridgeDomWidgetPin: noop, repairBridgePanelLayoutAfterWorkflow: noop,
        isBridgeGraphConfiguring: () => false,
    });
    const names = ["hideWidget", "removeBridgeDomWidgets", "moveWidgetToFront", "shouldHideNativeWidget", "hideNativeWidgets", "isBridgePanelUsable",
        "installWebUIPanel", "scheduleBridgePanelInstall"];
    for (const name of names) vm.runInContext(functionSource(name), context);
    for (const name of ["restoreNativeWidgets", "clearBridgePanelInstallFailure", "reportBridgePanelInstallFailure", "installBridgePanelSafely", "bridgePanelMountRecoveryState"]) {
        const code = functionSource(name, true);
        if (code) vm.runInContext(code, context);
    }
    return { context, node, widget, panel, frames, logs, originalCompute, originalDraw };
}

const failed = fixture();
failed.node.addDOMWidget = () => { throw new Error("DOM widget API unavailable"); };
try { failed.context.installWebUIPanel(failed.node); } catch {}
const detached = fixture();
detached.context.installWebUIPanel(detached.node);
detached.panel.isConnected = false;
let removed = 0;
const stale = fixture();
stale.node.widgets.push({ name: "webui_prompt_frontend", element: stale.panel, onRemove: () => removed++ });
stale.context.removeBridgeDomWidgets(stale.node);
console.log(JSON.stringify({ missingDomApiLeavesNativeHidden: failed.widget.hidden,
    detachedPanelReportedUsable: detached.context.isBridgePanelUsable(detached.node), staleWidgetUnregisterCalls: removed }));
if (process.argv.includes("--measure")) process.exit(0);
assert.notEqual(failed.widget.hidden, true, "Mount failure hid every native input and left a blank node");
assert.equal(detached.context.isBridgePanelUsable(detached.node), false, "A detached DOM panel was treated as healthy");
assert.equal(removed, 1, "Stale widget was removed from the array without unregistering its DOM host");

{
    const f = fixture();
    f.context.installWebUIPanel(f.node);
    assert.equal(f.widget.hidden, true);
    assert.equal(f.context.isBridgePanelUsable(f.node), true);
    assert.equal(f.node.widgets.filter(item => item.name === "webui_prompt_frontend").length, 1);
}
{
    const f = fixture();
    f.context.installWebUIPanel(f.node);
    f.panel.isConnected = false;
    assert.equal(f.context.bridgePanelMountRecoveryState(f.node, 11000), "pending");
    assert.equal(f.context.bridgePanelMountRecoveryState(f.node, 12000), "retry");
    assert.equal(f.context.bridgePanelMountRecoveryState(f.node, 15000), "failed");
    assert.equal(f.widget.hidden, false);
    assert(f.node.__webuiBridgePanelFailureWidget);
    assert.equal(f.node.__webuiBridgePanel, null);
}
{
    const f = fixture();
    const originalOptions = f.widget.options;
    const originalMin = originalOptions.getMinHeight;
    const style = { display: "block", height: "80px", minHeight: "40px", maxHeight: "80px" };
    Object.defineProperty(style, "cssText", {
        get() { return JSON.stringify({ display: this.display, height: this.height, minHeight: this.minHeight, maxHeight: this.maxHeight }); },
        set(value) { Object.assign(this, JSON.parse(value)); },
    });
    f.widget.element = { style };
    f.context.hideNativeWidgets(f.node);
    assert.equal(f.widget.type, "WEBUI_BRIDGE_HIDDEN_positive_prompt");
    assert.equal(style.display, "none");
    f.widget.value = "edited prompt must survive fallback";
    f.context.restoreNativeWidgets(f.node);
    assert.equal(f.widget.type, "customtext");
    assert.equal(f.widget.hidden, false);
    assert.equal(f.widget.computeSize, f.originalCompute);
    assert.equal(f.widget.draw, f.originalDraw);
    assert.equal(f.widget.options, originalOptions);
    assert.equal(f.widget.options.getMinHeight, originalMin);
    assert.equal(f.widget.value, "edited prompt must survive fallback");
    assert.equal(style.display, "block");
    assert.equal(style.height, "80px");
    f.context.hideNativeWidgets(f.node);
    assert.equal(f.widget.hidden, true, "A recovered widget could no longer be hidden after a successful retry");
}
{
    const f = fixture();
    delete f.node.addDOMWidget;
    f.context.scheduleBridgePanelInstall(f.node);
    assert.equal(f.node.__webuiBridgeInstallScheduled, true);
    assert.doesNotThrow(() => f.frames.shift()());
    assert.equal(f.node.__webuiBridgeInstallScheduled, false);
    assert.equal(f.widget.hidden, false);
    assert(f.node.__webuiBridgePanelFailureWidget, "Deferred/workflow installation failure had no fallback");
}
{
    const f = fixture();
    f.node.__webuiBridgeFreshNode = true;
    f.node.addDOMWidget = () => { throw new Error("unsupported DOM widget API"); };
    assert.doesNotThrow(() => f.context.scheduleBridgePanelInstall(f.node));
    assert.equal(f.widget.hidden, false);
    assert(f.node.__webuiBridgePanelInstallError);
    const notice = f.node.__webuiBridgePanelFailureWidget;
    assert(notice && notice.type === "button", "Failure had no canvas-rendered recovery control");
    assert.equal(notice.options.serialize, false);
    assert.equal(notice.serialize, false);
    assert.equal(f.node.widgets[0], notice, "The recovery button is buried below the native parameter list");
    assert.equal(f.node.__webuiBridgeInstallScheduled, false);
    const widgetCount = f.node.widgets.length;
    f.context.scheduleBridgePanelInstall(f.node);
    assert.equal(f.node.widgets.length, widgetCount, "A failed automatic install kept adding retry widgets");
    f.node.addDOMWidget = (name, type, element, options) => {
        const dom = { name, type, element, options }; f.node.widgets.push(dom); return dom;
    };
    notice.callback();
    assert.equal(f.node.__webuiBridgePanelInstallError, null);
    assert.equal(f.node.__webuiBridgePanelFailureWidget, null);
    assert.equal(f.widget.hidden, true);
    assert.equal(f.context.isBridgePanelUsable(f.node), true);
    assert.equal(f.node.widgets.filter(item => item.name === "webui_prompt_frontend").length, 1);
}
{
    const f = fixture();
    f.context.installBridgeSlotLabelOverlay = () => { throw new Error("optional overlay failed"); };
    assert.equal(f.context.installBridgePanelSafely(f.node), false);
    assert.equal(f.widget.hidden, false, "Failure after hiding did not restore the native fields");
    assert.equal(f.node.__webuiBridgePanel, null);
    assert.equal(f.widget.value, "keep this prompt");
    assert.equal(f.node.widgets.some(item => item.name === "webui_prompt_frontend"), false);
}
{
    const f = fixture();
    f.node.addDOMWidget = () => null;
    assert.equal(f.context.installBridgePanelSafely(f.node), false);
    assert.equal(f.widget.hidden, false);
}
{
    const f = fixture();
    f.context.installWebUIPanel(f.node);
    const first = f.node.widgets.find(item => item.name === "webui_prompt_frontend");
    f.panel.isConnected = false;
    let unregisters = 0;
    first.onRemove = () => unregisters++;
    f.context.buildPanel = () => ({ ...f.panel, style: {}, isConnected: true });
    f.context.installWebUIPanel(f.node);
    assert.equal(unregisters, 1);
    assert.equal(f.context.isBridgePanelUsable(f.node), true);
    assert.equal(f.node.widgets.filter(item => item.name === "webui_prompt_frontend").length, 1);
}
// Exercise the real layout-repair/install feedback path, not just isolated
// mount-state calls. Vue hosts can attach asynchronously and may never call
// LiteGraph's onDrawForeground, so recovery must also work without that hook.
function layoutMountFixture(attachDelay) {
    const f = fixture();
    let now = 10000;
    let sequence = 0;
    let mounts = 0;
    let unregisters = 0;
    const jobs = [];
    const schedule = (callback, delay = 0) => {
        jobs.push({ callback, at: now + delay, sequence: sequence++ });
        return sequence;
    };
    f.context.performance.now = () => now;
    f.context.requestAnimationFrame = f.context.window.requestAnimationFrame = callback => schedule(callback, 16);
    f.context.window.setTimeout = schedule;
    f.context.TARGET_NODE = f.node.type = "WebUIPromptBridge";
    f.context.WORKFLOW_LAYOUT_REPAIR_DELAYS = [0, 32, 120, 360, 900, 1600, 3200, 6500];
    f.context.resolveBridgePanelSizeForLiveState = () => [1000, 700];
    f.context.bridgeConfiguredSizeLockActive = () => false;
    f.node.__webuiBridgeFreshNode = true;
    f.context.buildPanel = () => {
        const panel = { ...f.panel, style: {}, isConnected: false };
        mounts++;
        const delay = typeof attachDelay === "function" ? attachDelay(mounts) : attachDelay;
        if (Number.isFinite(delay)) schedule(() => { panel.isConnected = true; }, delay);
        return panel;
    };
    const addDOMWidget = f.node.addDOMWidget;
    f.node.addDOMWidget = function (...args) {
        const widget = addDOMWidget.apply(this, args);
        widget.onRemove = () => unregisters++;
        return widget;
    };
    vm.runInContext(functionSource("repairBridgePanelLayoutAfterWorkflow"), f.context);
    return {
        ...f,
        run() {
            f.context.scheduleBridgePanelInstall(f.node);
            let callbacks = 0;
            while (jobs.length && callbacks < 200) {
                jobs.sort((a, b) => a.at - b.at || a.sequence - b.sequence);
                if (jobs[0].at > 20000) break;
                const job = jobs.shift();
                now = job.at;
                job.callback();
                callbacks++;
            }
            return { mounts, unregisters, callbacks };
        },
    };
}
{
    const f = fixture();
    f.context.installWebUIPanel(f.node);
    f.panel.isConnected = false;
    f.frames.length = 0;
    assert.equal(f.context.bridgePanelMountRecoveryState(f.node, 12000), "retry");
    f.context.buildPanel = () => ({ ...f.panel, style: {}, isConnected: true });
    f.context.scheduleBridgePanelInstall(f.node);
    assert.equal(f.node.widgets.some(w => w.name === "webui_prompt_frontend"), false,
        "The Vue host must observe unregistration before reusing the same widget name");
    assert.equal(f.context.bridgePanelMountRecoveryState(f.node, 15000), "pending");
    assert.equal(f.node.__webuiBridgeDetachedPanelRetries, 1, "A pending remount reset the retry budget");
    f.frames.shift()();
    assert.equal(f.context.isBridgePanelUsable(f.node), true);
}
{
    const f = layoutMountFixture(250);
    const result = f.run();
    assert.equal(result.mounts, 1, `A healthy async host was rebuilt before it could attach: ${JSON.stringify(result)}`);
    assert.equal(result.unregisters, 0);
    assert.equal(f.context.isBridgePanelUsable(f.node), true);
    assert.equal(f.widget.hidden, true);
}
{
    const f = layoutMountFixture(Infinity);
    const result = f.run();
    assert.equal(result.mounts, 2, `A failed mount escaped its retry budget: ${JSON.stringify(result)}`);
    assert(result.callbacks < 200, "Layout repair generated an unbounded install/timer loop");
    assert.equal(f.widget.hidden, false, "No draw callback: native inputs stayed hidden forever");
    assert(f.node.__webuiBridgePanelFailureWidget, "No draw callback: no retry button was shown");
    assert.equal(f.widget.value, "keep this prompt");
    assert.equal(result.unregisters, 2);
}
{
    const f = layoutMountFixture(attempt => attempt === 1 ? Infinity : 250);
    const result = f.run();
    assert.equal(result.mounts, 2);
    assert.equal(result.unregisters, 1);
    assert.equal(f.context.isBridgePanelUsable(f.node), true);
    assert.equal(f.node.__webuiBridgePanelInstallError, null);
    assert.equal(f.node.__webuiBridgeDetachedPanelRetries, 0, "A successful remount kept the old failure budget");
}
for (const inactive of ["removed", "collapsed"]) {
    const f = layoutMountFixture(Infinity);
    if (inactive === "removed") f.node.graph = null;
    if (inactive === "collapsed") f.node.flags = { collapsed: true };
    assert.equal(f.run().mounts, 1, `Layout repair remounted an inactive node: ${inactive}`);
    assert.equal(Boolean(f.node.__webuiBridgePanelFailureWidget), false);
}
{
    const f = fixture();
    f.context.scheduleBridgePanelInstall(f.node);
    f.node.graph = null;
    f.frames.shift()();
    assert.equal(f.widget.hidden, false, "A removed node was installed by a queued frame");
    assert.equal(f.node.__webuiBridgePanel, undefined);
}
console.log("Panel lifecycle: native fallback/retry, async host grace, real layout-repair retry budget and recovery without draw callbacks passed.");
