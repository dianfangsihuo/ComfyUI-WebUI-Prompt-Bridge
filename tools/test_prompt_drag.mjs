import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source = readFileSync(new URL("../web/webui_prompt_bridge.js", import.meta.url), "utf8");
const start = source.indexOf("function promptDropRows(");
const end = source.indexOf("function normalizeAttentionValue(", start);
assert(start >= 0 && end > start, "Prompt drag helpers were not found");

function fixture(count = 120, scale = 1) {
    const stats = { cardReads: 0, containerReads: 0, indicators: 0, appends: 0, removes: 0, styleWrites: 0 };
    const observers = [];
    let container;
    class Element {
        constructor(index = null) {
            this.dataset = index === null ? {} : { promptIndex: String(index) };
            this.index = index;
            this.parentNode = null;
            this.children = [];
            this.listeners = new Map();
            this.className = "";
            this.style = new Proxy({}, { set(target, key, value) { stats.styleWrites++; target[key] = value; return true; } });
        }
        get isConnected() { return this === container || Boolean(this.parentNode?.isConnected); }
        addEventListener(type, listener) { this.listeners.set(type, listener); }
        append(child) { child.parentNode = this; this.children.push(child); stats.appends++; }
        remove() {
            if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
            this.parentNode = null;
            stats.removes++;
        }
        contains(child) { return child === this || this.children.includes(child); }
        matches(selector) { return this.index !== null && selector.includes("[data-prompt-index]"); }
        closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest?.(selector) || null; }
        querySelectorAll(selector) { return selector.includes("[data-prompt-index]") ? this.cards : []; }
        querySelector() { return this.children.find(child => child.className.includes("webui-bridge-prompt-drop-indicator")) || null; }
        getBoundingClientRect() {
            if (this === container) {
                stats.containerReads++;
                return { left: this.left, top: this.top, width: this.offsetWidth * scale, height: this.offsetHeight * scale,
                    right: this.left + this.offsetWidth * scale, bottom: this.top + this.offsetHeight * scale };
            }
            stats.cardReads++;
            const left = container.left + (12 + (this.index % 4) * 100 - container.scrollLeft) * scale;
            const top = container.top + (12 + Math.floor(this.index / 4) * 48 - container.scrollTop) * scale;
            return { left, top, right: left + 90 * scale, bottom: top + 40 * scale, width: 90 * scale, height: 40 * scale };
        }
    }
    container = new Element();
    Object.assign(container, { left: 30, top: 40, offsetWidth: 420, offsetHeight: 320, clientWidth: 418, clientHeight: 318, scrollTop: 0, scrollLeft: 0 });
    container.cards = Array.from({ length: count }, (_, index) => new Element(index));
    for (const card of container.cards) { card.parentNode = container; container.children.push(card); }
    const context = vm.createContext({
        el(_tag, properties) { stats.indicators++; const node = new Element(); node.className = properties.class || ""; return node; },
        MutationObserver: class {
            constructor(callback) { this.callback = callback; observers.push(this); }
            observe() {}
            takeRecords() { return []; }
        },
    });
    vm.runInContext(source.slice(start, end), context);
    const dragging = { fromIndexes: [0] };
    const drops = [];
    let active = dragging;
    const options = { selector: ".chip[data-prompt-index]", getDragging: () => active, onDrop: (index, data) => drops.push({ index, data }) };
    context.configurePromptDropTarget(container, options);
    const event = (type, x = 43, y = 65, relatedTarget = null) => {
        const result = { clientX: x, clientY: y, relatedTarget, dataTransfer: {}, prevented: false, stopped: false,
            preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; } };
        container.listeners.get(type)?.(result);
        return result;
    };
    return { context, container, stats, drops, options, event, observers, setActive(value) { active = value; } };
}

const benchmark = fixture();
for (let index = 0; index < 240; index++) benchmark.event("dragover", 145 + index % 10, 65);
console.log(JSON.stringify({ scenario: "120 tags, 240 dragover events", ...benchmark.stats }));
if (process.argv.includes("--measure")) process.exit(0);
assert(benchmark.stats.cardReads <= 120, "Steady dragging repeatedly measured every card");
assert.equal(benchmark.stats.indicators, 1, "Steady dragging recreated the insertion indicator");
assert.equal(benchmark.stats.appends, 1, "Steady dragging repeatedly attached the indicator");
assert(benchmark.stats.styleWrites <= 6, "An unchanged insertion slot was repeatedly restyled");

{
    const f = fixture();
    f.event("dragover", 145, 65);
    const first = f.container.querySelector();
    assert.equal(f.container.__webuiBridgeDropSlot.toIndex, 1);
    f.event("dragover", 245, 65);
    assert.equal(f.container.__webuiBridgeDropSlot.toIndex, 2);
    assert.equal(f.container.querySelector(), first, "Moving between slots must reuse the indicator");
    f.event("drop", 345, 65);
    assert.equal(f.drops.length, 1);
    assert.equal(f.drops[0].index, 3, "Drop must use the final pointer position, not a stale hover slot");
    assert.equal(f.container.querySelector(), null);
    assert.equal(f.container.__webuiBridgeDropSlot, null);
}
{
    const f = fixture();
    f.event("dragover");
    f.container.scrollTop = 48;
    f.event("dragover", 43, 65);
    assert.equal(f.container.__webuiBridgeDropSlot.toIndex, 4, "Scrolling did not invalidate geometry");
    assert.equal(f.stats.cardReads, 240);
    f.container.left += 10;
    f.event("dragover", 53, 65);
    assert.equal(f.stats.cardReads, 360, "Canvas movement did not invalidate geometry");
    f.container.clientWidth -= 12;
    f.event("dragover", 53, 65);
    assert.equal(f.stats.cardReads, 480, "Scrollbar/layout width did not invalidate geometry");
}
{
    const f = fixture();
    f.event("dragover");
    f.context.configurePromptDropTarget(f.container, f.options);
    f.event("dragover");
    assert.equal(f.stats.cardReads, 240, "Re-rendered prompt cards reused stale geometry");
    f.context.clearPromptDropIndicator(f.container);
    f.event("dragover");
    assert.equal(f.stats.cardReads, 360, "A new drag session reused stale geometry");
}
{
    const f = fixture();
    f.event("dragover");
    for (const observer of f.observers) observer.callback([{ type: "characterData", target: { parentElement: f.container.cards[0] } }]);
    f.event("dragover");
    assert.equal(f.stats.cardReads, 240, "Translated card labels did not invalidate geometry");
}
for (const scale of [0.1, 0.5, 1, 2]) {
    const f = fixture(8, scale);
    f.event("dragover", 30 + 113 * scale, 40 + 25 * scale);
    const marker = f.container.querySelector();
    assert.equal(f.container.__webuiBridgeDropSlot.toIndex, 1);
    assert.equal(Number.parseFloat(marker.style.left), 112, `Indicator drifted at canvas scale ${scale}`);
    assert.equal(Number.parseFloat(marker.style.height), 40, `Indicator height drifted at canvas scale ${scale}`);
    f.context.clearPromptDropIndicator(f.container);
    f.event("dragover", 43, 40 + 56 * scale);
    assert(f.container.querySelector().className.includes("horizontal"));
    const horizontal = f.container.querySelector();
    f.event("dragover", 30 + 113 * scale, 40 + 25 * scale);
    assert.equal(f.container.querySelector(), horizontal);
    assert.equal(horizontal.style.width, "", "An orientation change retained the old inline width");
    assert.equal(horizontal.style.height, "40px");
}
{
    const f = fixture(0);
    f.event("dragover");
    assert.equal(f.container.__webuiBridgeDropSlot.toIndex, 0);
    assert(f.container.querySelector().className.includes("horizontal"));
    f.event("drop");
    assert.equal(f.drops[0].index, 0);
}
{
    const f = fixture();
    f.setActive(null);
    assert.equal(f.event("dragover").prevented, false, "Unrelated drags were captured");
    assert.equal(f.stats.cardReads, 0);
    f.setActive({ fromIndexes: [0] });
    f.event("dragover");
    f.event("dragleave", 0, 0, f.container.cards[0]);
    assert(f.container.querySelector(), "Moving to a child incorrectly cleared the indicator");
    f.event("dragleave");
    assert.equal(f.container.querySelector(), null);
    f.event("drop", 145, 65);
    assert.equal(f.drops[0].index, 1, "A drop without an earlier hover slot was lost");
}
console.log("Prompt drag: geometry budget, indicator reuse, final-position drop, scroll/layout/render invalidation, translation, zoom and cleanup passed.");
