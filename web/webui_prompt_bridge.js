import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

const TARGET_NODE = "WebUIPromptBridge";
const PROMPT_WIDGETS = new Set(["positive_prompt", "negative_prompt", "default_clip_strength", "fail_on_missing_lora"]);
const EXTRA_SEPARATOR = ", ";
const ATTENTION_STEP = 0.1;
const EXTRA_STEP = 0.05;
const DEFAULT_CLIP_STRENGTH = 1;
const DEFAULT_FONT_SIZE = 12;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 22;
const WORD_DELIMITERS = ",;，；、\n\r\t";
const DEFAULT_PANEL_WIDTH = 1180;
const DEFAULT_PANEL_HEIGHT = 1040;
const LEGACY_PANEL_WIDTH = 1280;
const LEGACY_PANEL_HEIGHT = 1120;
const PANEL_MIN_WIDTH = 420;
const PANEL_MAX_WIDTH = 100000;
const PANEL_MIN_HEIGHT = 360;
const DOM_WIDGET_LAYOUT_PAD = 128;
const PROMPT_CHIPS_MIN_HEIGHT = 104;
const EXTRA_NETWORKS_MIN_HEIGHT = 72;
const EXTRA_NETWORKS_MAX_HEIGHT = 100000;
const LAYOUT_STORAGE_VERSION = "2026-06-05-anchored-resizable-frames";
const AIO_POSITIVE_MIN_HEIGHT = 180;
const AIO_NEGATIVE_MIN_HEIGHT = 220;
const DEFAULT_BRIDGE_SETTINGS = {
    data_source: "auto",
    translation_source: "auto",
    tag_translation_source: "auto",
    show_startup_wizard: true,
    layout_preset: "default",
    tag_display: "local_first",
    lora_card_size: "normal",
};
const SETTING_CHOICES = {
    data_source: ["auto", "webui", "builtin"],
    translation_source: ["auto", "webui", "online", "ai", "builtin"],
    tag_translation_source: ["auto", "local", "online", "off"],
    layout_preset: ["default", "compact", "roomy", "positive_focus", "minimal_lora"],
    tag_display: ["local_first", "prompt_first", "compact"],
    lora_card_size: ["compact", "normal", "large"],
};
const WEBUI_CHECK_LABELS = {
    styles_file: "样式",
    prompt_all_in_one_dir: "Prompt All in One",
    tagcomplete_dir: "TagComplete",
    webui_python_site_packages: "Python依赖",
    loras: "LoRA",
    checkpoints: "模型",
    vae: "VAE",
    embeddings: "Embeddings",
    controlnet: "ControlNet",
};
const SPLIT_ANIMA_MODEL_VALUE = "__webui_bridge_split_anima_qwen__";
const SPLIT_ANIMA_MODEL_LABEL = "分体 Anima/Qwen（Anima UNET + Text Encoder + VAE）";
const DEFAULT_QUALITY_TAGS = [
    "masterpiece",
    "best quality",
    "very aesthetic",
    "anime style",
];
const DEFAULT_NEGATIVE_PROMPT = "worst quality, low quality, lowres, blurry, bad anatomy, bad hands, extra fingers, extra legs, bad feet, malformed feet, text, watermark, artist name, jpeg artifacts, deformed, ugly face";
const LAYOUT_PRESET_OPTIONS = [
    { value: "default", label: "默认", short: "默认", title: "默认布局尺寸" },
    { value: "compact", label: "紧凑", short: "紧凑", title: "紧凑节点尺寸" },
    { value: "roomy", label: "宽松", short: "宽松", title: "宽松大面板" },
    { value: "positive_focus", label: "正向撰写优先", short: "正向", title: "放大正向 Prompt 和正向标签区，折叠反向词细节" },
    { value: "minimal_lora", label: "极简 LoRA 条", short: "极简", title: "压缩 LoRA 卡片区并缩小节点，保留底部框可随时拉开" },
];
const POSITIVE_PROMPT_HINTS = [
    "1girl",
    "1boy",
    "2girls",
    "2boys",
    "solo",
    "girl",
    "boy",
    "woman",
    "man",
    "portrait",
    "full body",
    "upper body",
    "standing",
    "sitting",
    "looking at viewer",
    "long hair",
    "short hair",
    "bangs",
    "hair",
    "eyes",
    "dress",
    "school uniform",
    "kamisato",
    "ayaka",
    "masterpiece",
    "best quality",
    "score_9",
    "score_8",
];
const NEGATIVE_PROMPT_HINTS = [
    "worst quality",
    "low quality",
    "lowres",
    "bad",
    "blurry",
    "deformed",
    "malformed",
    "extra",
    "missing",
    "mutated",
    "watermark",
    "text",
    "jpeg artifacts",
    "censored",
    "nsfw",
];
const ANIMA_FAST_LORAS = [
    { name: "anima_p3_rdbt_v0.29.b.122", weight: 0.8 },
    { name: "anima-highres-aesthetic-boost", weight: 0.55 },
];
const ANIMA_FAST_LORA_PATTERN = /<\s*(?:lora|lyco)\s*:\s*(?:[^>]*\/)?(?:anima_p3_rdbt_v0\.29\.b\.122|anima-highres-aesthetic-boost)(?:\.[a-z0-9]+)?(?:\s*:[^>]*)?>\s*,?\s*/gi;
const LORA_CATEGORY_PRESETS = [
    "角色/人物",
    "画风/风格",
    "服装/装扮",
    "姿势/动作",
    "场景/环境",
    "物品/道具",
    "质量/增强",
    "构图/镜头",
    "表情/情绪",
    "材质/质感",
    "光照/色彩",
    "工具/控制",
    "未分类",
];

function chainCallback(object, property, callback) {
    const original = object[property];
    object[property] = function () {
        const result = original?.apply(this, arguments);
        callback.apply(this, arguments);
        return result;
    };
}

function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs)) {
        if (key === "class") node.className = value;
        else if (key === "style") Object.assign(node.style, value);
        else if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
        else if (value !== undefined && value !== null) node.setAttribute(key, value);
    }
    for (const child of Array.isArray(children) ? children : [children]) {
        if (child === undefined || child === null) continue;
        node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    }
    return node;
}

function stripModelExtension(name) {
    return String(name || "")
        .replace(/\\/g, "/")
        .replace(/\.(?:safetensors|ckpt|pt|bin)$/i, "");
}

function getWidget(node, name) {
    return node?.widgets?.find((widget) => widget.name === name);
}

function normalizeBridgeSettings(settings = {}) {
    const normalized = { ...DEFAULT_BRIDGE_SETTINGS };
    for (const [key, value] of Object.entries(settings || {})) {
        if (key === "show_startup_wizard") {
            normalized[key] = Boolean(value);
        } else if (SETTING_CHOICES[key]?.includes(value)) {
            normalized[key] = value;
        }
    }
    return normalized;
}

function installWidgetSerializationFallback(widget, serializer = null) {
    if (!widget) return 0;
    const serializeWidget = serializer || function () {
        if (this.serialize === false || this.options?.serialize === false) return null;
        return {
            name: this.name,
            type: this.type,
            value: this.value,
        };
    };
    let patched = 0;
    if (typeof widget.asSerializable !== "function") {
        widget.asSerializable = serializeWidget;
        patched += 1;
    }
    if (typeof widget.asSerialisable !== "function") {
        widget.asSerialisable = widget.asSerializable || serializeWidget;
        patched += 1;
    }
    return patched;
}

function readLocalBoolean(key, fallback = false) {
    try {
        const value = localStorage.getItem(key);
        if (value === null) return fallback;
        return value === "1" || value === "true";
    } catch {
        return fallback;
    }
}

function writeLocalBoolean(key, value) {
    try {
        localStorage.setItem(key, value ? "1" : "0");
    } catch {
        // Ignore private-mode or quota failures; UI state can be ephemeral.
    }
}

function readLocalString(key, fallback = "") {
    try {
        return localStorage.getItem(key) || fallback;
    } catch {
        return fallback;
    }
}

function writeLocalString(key, value) {
    try {
        localStorage.setItem(key, String(value || ""));
    } catch {
        // Ignore private-mode or quota failures; UI state can be ephemeral.
    }
}

function readLocalNumber(key, fallback = null) {
    try {
        const raw = localStorage.getItem(key);
        if (raw === null || raw === "") return fallback;
        const value = Number(raw);
        return Number.isFinite(value) ? value : fallback;
    } catch {
        return fallback;
    }
}

function writeLocalNumber(key, value) {
    try {
        localStorage.setItem(key, String(Math.round(value)));
    } catch {
        // Ignore private-mode or quota failures; UI state can be ephemeral.
    }
}

function clearLocalValue(key) {
    try {
        localStorage.removeItem(key);
    } catch {
        // Ignore private-mode or quota failures; UI state can be ephemeral.
    }
}

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || min));
}

function applyStoredHeight(target, storageKey, { min = 48, max = 640 } = {}) {
    const value = readLocalNumber(storageKey, null);
    if (value === null) return;
    const height = clampNumber(value, min, max);
    target.style.height = `${height}px`;
    target.style.flex = "0 0 auto";
}

function resolveResizeValue(value) {
    return typeof value === "function" ? value() : value;
}

function resizeTargetHidden(target) {
    if (!target) return true;
    if (!target.getClientRects?.().length) return true;
    if (target.classList?.contains("collapsed")) return true;
    return getComputedStyle(target).display === "none";
}

function resizeTargetKey(target, storageKey) {
    return resolveResizeValue(storageKey) || target?.__webuiBridgeHeightKey || "";
}

function resizeTargetMin(target, fallback) {
    return Number(resolveResizeValue(fallback) ?? target?.__webuiBridgeMinHeight ?? 48);
}

function resizeTargetMax(target, fallback) {
    return Number(resolveResizeValue(fallback) ?? target?.__webuiBridgeMaxHeight ?? 640);
}

function resizeTargetLayoutHeight(target) {
    if (!target) return 0;
    return target.offsetHeight || target.getBoundingClientRect?.().height || 0;
}

function resizeTargetViewportScale(target) {
    const layoutHeight = target?.offsetHeight || 0;
    const viewportHeight = target?.getBoundingClientRect?.().height || 0;
    if (!layoutHeight || !viewportHeight) return 1;
    return viewportHeight / layoutHeight || 1;
}

function setResizeTargetHeight(target, storageKey, height, { min = 48, max = 640 } = {}) {
    if (!target) return;
    const nextHeight = clampNumber(height, min, max);
    target.style.height = `${nextHeight}px`;
    target.style.flex = "0 0 auto";
    const key = resizeTargetKey(target, storageKey);
    if (key) writeLocalNumber(key, nextHeight);
}

function resetResizeTargetHeight(target, storageKey, fill = "") {
    if (!target) return;
    const key = resizeTargetKey(target, storageKey);
    if (key) clearLocalValue(key);
    target.style.height = "";
    target.style.flex = fill;
}

function applyTopRowCollapsedState(topRow, collapsed) {
    if (!topRow) return;
    topRow.classList.toggle("negative-collapsed", collapsed);
    if (collapsed) {
        topRow.style.height = "";
        topRow.style.flex = "";
        return;
    }
    applyStoredHeight(topRow, topRow.__webuiBridgeHeightKey, {
        min: topRow.__webuiBridgeMinHeight || 300,
        max: topRow.__webuiBridgeMaxHeight || 980,
    });
}

function createHeightResizeGrip(target, storageKey, { min = 48, max = 640, title = "拖动调整高度，双击恢复" } = {}) {
    const grip = el("div", {
        class: "webui-bridge-section-resizer",
        title,
        ondblclick: (event) => {
            event.preventDefault();
            event.stopPropagation();
            resetResizeTargetHeight(target, storageKey);
        },
        onpointerdown: (event) => {
            event.preventDefault();
            event.stopPropagation();
            const startY = event.clientY;
            const startHeight = resizeTargetLayoutHeight(target);
            const viewportScale = resizeTargetViewportScale(target);
            grip.setPointerCapture?.(event.pointerId);
            const onMove = (moveEvent) => {
                const delta = (moveEvent.clientY - startY) / viewportScale;
                setResizeTargetHeight(target, storageKey, startHeight + delta, { min, max });
            };
            const onUp = () => {
                document.removeEventListener("pointermove", onMove, true);
                document.removeEventListener("pointerup", onUp, true);
                document.removeEventListener("pointercancel", onUp, true);
            };
            document.addEventListener("pointermove", onMove, true);
            document.addEventListener("pointerup", onUp, true);
            document.addEventListener("pointercancel", onUp, true);
        },
    });
    return grip;
}

function createHeightSplitGrip(beforeTarget, afterTarget, beforeKey, afterKey, options = {}) {
    const grip = el("div", {
        class: `webui-bridge-section-resizer webui-bridge-split-resizer${options.className ? ` ${options.className}` : ""}`,
        title: options.title || "上下拖动调整两侧高度，双击恢复",
        ondblclick: (event) => {
            event.preventDefault();
            event.stopPropagation();
            resetResizeTargetHeight(resolveResizeValue(beforeTarget), beforeKey);
            const after = resolveResizeValue(afterTarget);
            if (!resizeTargetHidden(after)) {
                resetResizeTargetHeight(after, afterKey, options.fillAfter ? "1 1 0" : (options.afterFlex || ""));
            }
        },
        onpointerdown: (event) => {
            event.preventDefault();
            event.stopPropagation();
            const before = resolveResizeValue(beforeTarget);
            const after = resolveResizeValue(afterTarget);
            if (!before) return;
            const beforeMin = resizeTargetMin(before, options.beforeMin ?? options.min);
            const beforeMax = resizeTargetMax(before, options.beforeMax ?? options.max);
            const afterVisible = after && !resizeTargetHidden(after);
            const afterMin = resizeTargetMin(after, options.afterMin ?? options.min);
            const afterMax = resizeTargetMax(after, options.afterMax ?? options.max);
            const startY = event.clientY;
            const startBefore = resizeTargetLayoutHeight(before);
            const startAfter = afterVisible ? resizeTargetLayoutHeight(after) : 0;
            const viewportScale = resizeTargetViewportScale(before);
            const total = startBefore + startAfter;
            let moved = false;
            grip.setPointerCapture?.(event.pointerId);
            const onMove = (moveEvent) => {
                const delta = (moveEvent.clientY - startY) / viewportScale;
                if (!moved && Math.abs(delta) < 4) return;
                moved = true;
                const rawBefore = startBefore + delta;
                if (!afterVisible || total <= beforeMin + afterMin) {
                    setResizeTargetHeight(before, beforeKey, rawBefore, { min: beforeMin, max: beforeMax });
                    return;
                }
                const minBefore = Math.max(beforeMin, total - afterMax);
                const maxBefore = Math.min(beforeMax, total - afterMin);
                const nextBefore = clampNumber(rawBefore, minBefore, Math.max(minBefore, maxBefore));
                setResizeTargetHeight(before, beforeKey, nextBefore, { min: minBefore, max: maxBefore });
                if (options.fillAfter) {
                    resetResizeTargetHeight(after, afterKey, options.afterResetFlex || "1 1 0");
                } else {
                    const nextAfter = total - nextBefore;
                    setResizeTargetHeight(after, afterKey, nextAfter, { min: afterMin, max: afterMax });
                    if (options.afterFlex) after.style.flex = options.afterFlex;
                }
            };
            const onUp = () => {
                document.removeEventListener("pointermove", onMove, true);
                document.removeEventListener("pointerup", onUp, true);
                document.removeEventListener("pointercancel", onUp, true);
            };
            document.addEventListener("pointermove", onMove, true);
            document.addEventListener("pointerup", onUp, true);
            document.addEventListener("pointercancel", onUp, true);
        },
    });
    return grip;
}

function clampPanelSize(width, height) {
    const nextHeight = Math.max(PANEL_MIN_HEIGHT, Math.round(height || DEFAULT_PANEL_HEIGHT));
    const nextWidth = Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, Math.round(width || DEFAULT_PANEL_WIDTH)));
    return [nextWidth, nextHeight];
}

function migrateLayoutStorage(keys = []) {
    const versionKey = "webui-bridge-layout-storage-version";
    if (readLocalString(versionKey, "") === LAYOUT_STORAGE_VERSION) return;
    for (const key of keys) clearLocalValue(key);
    writeLocalString(versionKey, LAYOUT_STORAGE_VERSION);
}

function looksLikeLegacyDefaultSize(size) {
    return Array.isArray(size) &&
        Math.abs(Number(size[0] || 0) - LEGACY_PANEL_WIDTH) <= 8 &&
        Math.abs(Number(size[1] || 0) - LEGACY_PANEL_HEIGHT) <= 8;
}

function looksLikeAutoExtendedDefaultSize(size) {
    if (!Array.isArray(size)) return false;
    const width = Number(size[0] || 0);
    const height = Number(size[1] || 0);
    const defaultOrRoomyWidth = width >= DEFAULT_PANEL_WIDTH - 40 && width <= 1420;
    return defaultOrRoomyWidth && height >= 1450;
}

function hideWidget(widget) {
    if (!widget || widget.__webuiBridgeHidden) return;
    installWidgetSerializationFallback(widget);
    widget.__webuiBridgeHidden = true;
    widget.origComputeSize = widget.computeSize;
    widget.computeSize = () => [0, 0];
    widget.computedHeight = 0;
    widget.y = 0;
    widget.last_y = 0;
    widget.width = 0;
    widget.draw = () => {};
    widget.hidden = true;
    widget.options = widget.options || {};
    widget.options.getMinHeight = () => 0;
    widget.options.getMaxHeight = () => 0;
    if (widget.element?.style) {
        widget.element.style.display = "none";
        widget.element.style.height = "0";
        widget.element.style.minHeight = "0";
        widget.element.style.maxHeight = "0";
    }
    widget.type = `WEBUI_BRIDGE_HIDDEN_${widget.name || "widget"}`;
}

function removeBridgeDomWidgets(node) {
    if (!Array.isArray(node.widgets)) return false;
    let removed = false;
    for (const widget of node.widgets) {
        if (widget?.name !== "webui_prompt_frontend") continue;
        removed = true;
        try {
            widget.element?.remove?.();
        } catch {
            // Ignore stale DOM cleanup errors; the widget list is the source of truth.
        }
    }
    if (removed) {
        node.widgets = node.widgets.filter((widget) => widget?.name !== "webui_prompt_frontend");
    }
    return removed;
}

function shouldHideNativeWidget(widget) {
    const widgetName = String(widget?.name || "");
    return PROMPT_WIDGETS.has(widgetName) ||
        widgetName.endsWith("_status") ||
        widgetName === "open_webui_prompt_editor";
}

function hideNativeWidgets(node) {
    for (const widget of node.widgets || []) {
        if (shouldHideNativeWidget(widget)) hideWidget(widget);
    }
}

function isBridgePanelUsable(node) {
    const panel = node.__webuiBridgePanel;
    if (!panel?.querySelector?.(".webui-bridge-toprow, .webui-bridge-panel-error")) return false;
    return Boolean((node.widgets || []).some((widget) => widget?.name === "webui_prompt_frontend" && widget.element === panel));
}

function scheduleBridgePanelInstall(node) {
    if (node.__webuiBridgeInstallScheduled) return;
    node.__webuiBridgeInstallScheduled = true;
    requestAnimationFrame(() => {
        node.__webuiBridgeInstallScheduled = false;
        installWebUIPanel(node);
    });
}

function setWidgetValue(node, name, value) {
    const widget = getWidget(node, name);
    if (!widget) return;
    widget.value = value;
    widget.callback?.(value);
    app.graph?.setDirtyCanvas(true, true);
}

function normalizeClipStrength(value, fallback = DEFAULT_CLIP_STRENGTH) {
    if (value === undefined || value === null) return fallback;
    if (typeof value === "string" && value.trim() === "") return fallback;
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
}

function repairClipStrengthWidget(node) {
    const widget = getWidget(node, "default_clip_strength");
    if (!widget) return DEFAULT_CLIP_STRENGTH;
    const repaired = normalizeClipStrength(widget.value);
    if (widget.value !== repaired) widget.value = repaired;
    return repaired;
}

function resolvePanelFontMetrics(value) {
    const size = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Number(value || DEFAULT_FONT_SIZE)));
    const small = Math.max(9, size - 1);
    const mini = Math.max(8, size - 2);
    const lineHeight = Math.max(14, Math.ceil(size * 1.35));
    const rowHeight = Math.max(18, lineHeight + 2);
    return {
        size,
        small,
        mini,
        large: size + 1,
        aioMain: size,
        aioSub: small,
        aioLineHeight: lineHeight,
        aioRowHeight: rowHeight,
        aioTagHeight: rowHeight * 2,
    };
}

function applyPanelFontSize(panel, value = null) {
    if (!panel?.style?.setProperty) return;
    const metrics = resolvePanelFontMetrics(value ?? readLocalNumber("webui-bridge-font-size", DEFAULT_FONT_SIZE));
    panel.style.setProperty("--webui-bridge-font-size", `${metrics.size}px`);
    panel.style.setProperty("--webui-bridge-font-size-small", `${metrics.small}px`);
    panel.style.setProperty("--webui-bridge-font-size-mini", `${metrics.mini}px`);
    panel.style.setProperty("--webui-bridge-font-size-large", `${metrics.large}px`);
    panel.style.setProperty("--webui-bridge-aio-main-size", `${metrics.aioMain}px`);
    panel.style.setProperty("--webui-bridge-aio-sub-size", `${metrics.aioSub}px`);
    panel.style.setProperty("--webui-bridge-aio-line-height", `${metrics.aioLineHeight}px`);
    panel.style.setProperty("--webui-bridge-aio-row-height", `${metrics.aioRowHeight}px`);
    panel.style.setProperty("--webui-bridge-aio-tag-height", `${metrics.aioTagHeight}px`);
}

function repairShiftedBridgeWidgets(node) {
    const positiveWidget = getWidget(node, "positive_prompt");
    const negativeWidget = getWidget(node, "negative_prompt");
    const clipStrengthWidget = getWidget(node, "default_clip_strength");
    const failOnMissingWidget = getWidget(node, "fail_on_missing_lora");
    if (!positiveWidget || !negativeWidget || !clipStrengthWidget) return false;
    const positive = positiveWidget.value;
    const negative = negativeWidget.value;
    const clip = clipStrengthWidget.value;
    const positiveEmpty = positive === null || positive === undefined || String(positive).trim() === "";
    const negativeLooksPrompt = typeof negative === "string" && negative.trim().length > 0;
    const clipLooksPrompt = typeof clip === "string" && clip.trim().length > 0 && Number.isNaN(Number(clip));
    if (!positiveEmpty || !negativeLooksPrompt || !clipLooksPrompt) return false;
    positiveWidget.value = negative;
    negativeWidget.value = clip;
    clipStrengthWidget.value = DEFAULT_CLIP_STRENGTH;
    if (failOnMissingWidget && typeof failOnMissingWidget.value !== "boolean") failOnMissingWidget.value = true;
    return true;
}

function setTextareaValue(textarea, value) {
    textarea.__webuiBridgeSettingValue = true;
    textarea.value = value;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));
    window.setTimeout(() => {
        textarea.__webuiBridgeSettingValue = false;
    }, 0);
}

function selectCurrentParenthesisBlock(state, open, close) {
    if (state.start !== state.end) return false;
    const before = state.text.substring(0, state.start);
    const beforeOpen = before.lastIndexOf(open);
    if (beforeOpen === -1) return false;
    const beforeClose = before.lastIndexOf(close);
    if (beforeClose !== -1 && beforeClose > beforeOpen) return false;
    const after = state.text.substring(state.start);
    const afterClose = after.indexOf(close);
    if (afterClose === -1) return false;
    const afterOpen = after.indexOf(open);
    if (afterOpen !== -1 && afterOpen < afterClose) return false;

    const content = state.text.substring(beforeOpen + 1, state.start + afterClose);
    if (/.*:-?[\d.]+/s.test(content)) {
        const lastColon = content.lastIndexOf(":");
        state.start = beforeOpen + 1;
        state.end = state.start + lastColon;
    } else {
        state.start = beforeOpen + 1;
        state.end = state.start + content.length;
    }
    return true;
}

function selectCurrentWord(state) {
    if (state.start !== state.end) return false;
    while (state.start > 0 && !WORD_DELIMITERS.includes(state.text[state.start - 1])) state.start -= 1;
    while (state.end < state.text.length && !WORD_DELIMITERS.includes(state.text[state.end])) state.end += 1;
    while (state.start < state.end && state.text[state.start] === " ") state.start += 1;
    while (state.end > state.start && state.text[state.end - 1] === " ") state.end -= 1;
    return state.start !== state.end;
}

function editAttention(textarea, increase) {
    const state = {
        start: textarea.selectionStart,
        end: textarea.selectionEnd,
        text: textarea.value,
    };
    if (
        !selectCurrentParenthesisBlock(state, "<", ">") &&
        !selectCurrentParenthesisBlock(state, "(", ")") &&
        !selectCurrentParenthesisBlock(state, "[", "]") &&
        !selectCurrentWord(state)
    ) return false;

    let { start, end } = state;
    let text = state.text;
    let closeCharacter = ")";
    let delta = ATTENTION_STEP;
    const startChar = start > 0 ? text[start - 1] : "";
    const endChar = text[end];

    if (startChar === "<") {
        closeCharacter = ">";
        delta = EXTRA_STEP;
    } else if ((startChar === "(" && endChar === ")") || (startChar === "[" && endChar === "]")) {
        let numParen = 0;
        while (text[start - numParen - 1] === startChar && text[end + numParen] === endChar) numParen += 1;
        let weight = startChar === "[" ? (1 / 1.1) ** numParen : 1.1 ** numParen;
        weight = Math.round(weight / ATTENTION_STEP) * ATTENTION_STEP;
        text = text.slice(0, start - numParen) + "(" + text.slice(start, end) + ":" + weight + ")" + text.slice(end + numParen);
        start -= numParen - 1;
        end -= numParen - 1;
    } else if (startChar !== "(") {
        while (end > start && text[end - 1] === " ") end -= 1;
        if (start === end) return false;
        text = text.slice(0, start) + "(" + text.slice(start, end) + ":1.0)" + text.slice(end);
        start += 1;
        end += 1;
    }

    if (text[end] !== ":") return false;
    const weightLength = text.slice(end + 1).indexOf(closeCharacter) + 1;
    let weight = parseFloat(text.slice(end + 1, end + weightLength));
    if (Number.isNaN(weight)) return false;
    weight += increase ? delta : -delta;
    weight = parseFloat(weight.toPrecision(12));
    const weightText = Number.isInteger(weight) ? weight.toFixed(1) : String(weight);

    if (closeCharacter === ")" && weight === 1) {
        const endParenPos = text.substring(end).indexOf(")");
        text = text.slice(0, start - 1) + text.slice(start, end) + text.slice(end + endParenPos + 1);
        start -= 1;
        end -= 1;
    } else {
        text = text.slice(0, end + 1) + weightText + text.slice(end + weightLength);
    }

    setTextareaValue(textarea, text);
    textarea.focus();
    textarea.selectionStart = start;
    textarea.selectionEnd = end;
    return true;
}

function movePromptTag(textarea, moveLeft) {
    const text = textarea.value;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const items = text.split(",");
    const indexStart = (text.slice(0, selectionStart).match(/,/g) || []).length;
    const indexEnd = (text.slice(0, selectionEnd).match(/,/g) || []).length;
    const range = indexEnd - indexStart + 1;

    if (moveLeft && indexStart > 0) {
        items.splice(indexStart - 1, 0, ...items.splice(indexStart, range));
        setTextareaValue(textarea, items.join(","));
        textarea.selectionStart = items.slice(0, indexStart - 1).join(",").length + (indexStart === 1 ? 0 : 1);
        textarea.selectionEnd = items.slice(0, indexEnd).join(",").length;
        return true;
    }
    if (!moveLeft && indexEnd < items.length - 1) {
        items.splice(indexStart + 1, 0, ...items.splice(indexStart, range));
        setTextareaValue(textarea, items.join(","));
        textarea.selectionStart = items.slice(0, indexStart + 1).join(",").length + 1;
        textarea.selectionEnd = items.slice(0, indexEnd + 2).join(",").length;
        return true;
    }
    return false;
}

function bracketErrors(text) {
    const counts = {};
    for (const bracket of text.match(/[(){}[\]]/g) || []) counts[bracket] = (counts[bracket] || 0) + 1;
    const errors = [];
    const check = (open, close, label) => {
        if ((counts[open] || 0) !== (counts[close] || 0)) errors.push(`${label}: ${counts[open] || 0}/${counts[close] || 0}`);
    };
    check("(", ")", "()");
    check("[", "]", "[]");
    check("{", "}", "{}");
    return errors;
}

function promptStats(text) {
    const tags = text.split(/[,\n，、]+/).map((x) => x.trim()).filter(Boolean).length;
    const loras = [...text.matchAll(/<\s*(?:lora|lyco):([^:>]+)(?::([^:>]+))?(?::([^:>]+))?\s*>/gi)];
    return { tags, loras };
}

function splitPromptTags(text) {
    const source = String(text || "");
    const tags = [];
    let depthRound = 0;
    let depthSquare = 0;
    let depthCurly = 0;
    let depthAngle = 0;
    let start = 0;

    const push = (end) => {
        const raw = source.slice(start, end);
        const value = raw.trim();
        if (value) tags.push({ value, start, end });
        start = end + 1;
    };

    for (let index = 0; index < source.length; index += 1) {
        const char = source[index];
        if (char === "<") depthAngle += 1;
        else if (char === ">" && depthAngle) depthAngle -= 1;
        else if (!depthAngle && char === "(") depthRound += 1;
        else if (!depthAngle && char === ")" && depthRound) depthRound -= 1;
        else if (!depthAngle && char === "[") depthSquare += 1;
        else if (!depthAngle && char === "]" && depthSquare) depthSquare -= 1;
        else if (!depthAngle && char === "{") depthCurly += 1;
        else if (!depthAngle && char === "}" && depthCurly) depthCurly -= 1;

        if ((char === "," || char === "，" || char === "、" || char === "\n") && !depthRound && !depthSquare && !depthCurly && !depthAngle) {
            push(index);
        }
    }
    push(source.length);
    return tags;
}

function buildLocalTagMap(state) {
    const map = new Map();
    for (const item of state.autocomplete || []) {
        const prompt = String(item.text || "").trim();
        const local = String(item.local || "").trim();
        if (prompt && local) map.set(prompt.toLowerCase(), local);
    }
    for (const group of state.promptAllInOne?.group_tags || []) {
        for (const subGroup of group.groups || []) {
            for (const tag of subGroup.tags || []) {
                const prompt = String(tag.prompt || "").trim();
                const local = String(tag.local || tag.name || "").trim();
                if (prompt && local) map.set(prompt.toLowerCase(), local);
            }
        }
    }
    for (const item of state.loras || []) {
        if (item.prompt && item.alias) map.set(String(item.prompt).toLowerCase(), item.alias);
    }
    return map;
}

const localTranslationCache = new Map();

async function translateTagsToLocal(tags) {
    const missing = tags.filter((tag) => tag && !localTranslationCache.has(tag.toLowerCase()));
    if (missing.length) {
        try {
            const translated = await translatePromptAllInOne(missing.join(", "), "local");
            for (const item of translated.tags || []) {
                localTranslationCache.set(String(item.prompt || item.input || "").toLowerCase(), item.local || "");
            }
        } catch {
            for (const tag of missing) localTranslationCache.set(tag.toLowerCase(), "");
        }
    }
    return tags.map((tag) => localTranslationCache.get(String(tag || "").toLowerCase()) || "");
}

function normalizeLoraName(name) {
    return String(name || "")
        .replace(/\\/g, "/")
        .replace(/\.(safetensors|ckpt|pt)$/i, "")
        .toLowerCase();
}

function parseLoraTag(value) {
    const match = String(value || "").match(/^<\s*(lora|lyco):([^:>]+)(?::([^:>]+))?(?::([^:>]+))?\s*>$/i);
    if (!match) return null;
    return {
        type: match[1].toLowerCase(),
        name: match[2].trim(),
        model: match[3] || "1",
        clip: match[4] || "",
    };
}

function bridgeModelOutputConnected(node) {
    const output = node?.outputs?.[0];
    return Boolean(output?.links?.length);
}

function resolveLora(state, requested) {
    const key = normalizeLoraName(requested);
    return (state.loras || []).find((item) => (
        normalizeLoraName(item.name) === key ||
        normalizeLoraName(item.alias) === key ||
        normalizeLoraName(item.base_name) === key ||
        normalizeLoraName(item.name).endsWith(`/${key}`) ||
        (item.aliases || []).some((alias) => normalizeLoraName(alias) === key)
    ));
}

function loraFolderLabel(folder) {
    return folder ? String(folder).replace(/\\/g, "/") : "Root";
}

function loraDisplayName(item) {
    return item?.base_name || item?.alias?.split(/[\\/]/).pop() || item?.name || "";
}

function loraMatchesQuery(item, query) {
    if (!query) return true;
    const haystack = [
        item.name,
        item.alias,
        item.folder,
        item.file_name,
        item.base_name,
        item.description,
        item.category,
        item.manual_category,
        item.kind_label,
        item.category_label,
        item.auto_category,
        item.sd_version,
        item.search_terms,
    ].map((value) => String(value || "").toLowerCase()).join("\n");
    return haystack.includes(query);
}

function loraSortValue(item, key) {
    if (key === "name") return String(loraDisplayName(item)).toLowerCase();
    if (key === "created") return Number(item.created || 0);
    if (key === "modified") return Number(item.modified || 0);
    return String(item.alias || item.name || "").toLowerCase();
}

function sortLoras(loras, key, descending) {
    const sorted = [...loras].sort((a, b) => {
        const av = loraSortValue(a, key);
        const bv = loraSortValue(b, key);
        if (typeof av === "number" && typeof bv === "number") return av - bv;
        return av < bv ? -1 : av > bv ? 1 : 0;
    });
    return descending ? sorted.reverse() : sorted;
}

function loraManualCategory(item) {
    return String(item?.manual_category || item?.category || item?.user_metadata?.category || item?.user_metadata?.["manual category"] || "").trim();
}

function loraAutoCategoryForItem(item) {
    const text = [
        item.name,
        item.alias,
        item.folder,
        item.base_name,
        item.description,
        item.activation_text,
        item.notes,
    ].map((value) => String(value || "").toLowerCase()).join(" ");
    const rules = [
        ["角色/人物", ["character", "chara", "char_", "girl", "boy", "person", "people", "face", "vtuber", "oc", "cosplay", "idol", "人物", "角色", "女孩", "男孩", "少女", "正太", "萝莉"]],
        ["画风/风格", ["style", "artist", "artstyle", "toon", "anime", "manga", "illustration", "painting", "render", "realistic", "风格", "画风", "画师", "写实", "水彩", "像素"]],
        ["服装/装扮", ["cloth", "clothes", "dress", "outfit", "uniform", "shirt", "skirt", "jacket", "armor", "kimono", "maid", "服装", "衣服", "制服", "裙", "甲", "女仆", "和服"]],
        ["姿势/动作", ["pose", "action", "gesture", "dance", "standing", "sitting", "running", "walk", "hand", "动作", "姿势", "手势", "站立", "坐姿", "舞"]],
        ["场景/环境", ["background", "scene", "environment", "room", "city", "landscape", "building", "interior", "forest", "street", "背景", "场景", "环境", "房间", "城市", "森林", "街道"]],
        ["物品/道具", ["prop", "object", "weapon", "sword", "gun", "vehicle", "car", "mecha", "item", "道具", "物品", "武器", "车", "机甲", "剑", "枪"]],
        ["质量/增强", ["quality", "detail", "aesthetic", "highres", "upscale", "enhance", "boost", "detailer", "质量", "细节", "增强", "高清", "修复"]],
        ["构图/镜头", ["composition", "camera", "lens", "closeup", "close-up", "wide shot", "portrait", "shot", "view", "angle", "构图", "镜头", "视角", "特写", "全景"]],
        ["表情/情绪", ["expression", "smile", "sad", "angry", "happy", "cry", "emotion", "mood", "表情", "情绪", "微笑", "哭", "生气"]],
        ["光照/色彩", ["light", "lighting", "shadow", "color", "colour", "tone", "palette", "neon", "光照", "灯光", "阴影", "色彩", "配色"]],
        ["工具/控制", ["controlnet", "control", "depth", "canny", "ipadapter", "adapter", "slider", "工具", "控制"]],
    ];
    for (const [label, keywords] of rules) {
        if (keywords.some((keyword) => text.includes(keyword))) return label;
    }
    return "未分类";
}

function loraCategoryForItem(item) {
    return loraManualCategory(item) || loraAutoCategoryForItem(item);
}

function collectLoraCategoryOptions(loras) {
    const seen = new Set();
    const options = [];
    const add = (value) => {
        const text = String(value || "").trim();
        if (!text || seen.has(text)) return;
        seen.add(text);
        options.push(text);
    };
    for (const preset of LORA_CATEGORY_PRESETS) add(preset);
    for (const item of loras || []) {
        add(loraManualCategory(item));
        add(item.category_label);
        add(item.auto_category);
        add(loraAutoCategoryForItem(item));
    }
    return options;
}

function loraSdVersionLabel(item) {
    const value = String(item?.sd_version || "").trim();
    return value && value !== "Unknown" ? value : "Unknown";
}

function loraMetadataStatusLabel(item) {
    if (loraManualCategory(item)) return "已手动分类";
    if (item.thumbnail && !item.thumbnail_unknown) return "有预览图";
    if (item.activation_text) return "有触发词";
    if (item.description || item.notes) return "有说明";
    return "待整理";
}

function loraPreviewFallback() {
    return el("span", { class: "webui-bridge-card-preview webui-bridge-card-preview-empty" }, [
        el("span", {}, "NO"),
        el("span", {}, "PREVIEW"),
    ]);
}

function makeTreeNode(name, path, icon = "Dir") {
    return { name, path, icon, count: 0, children: new Map() };
}

function addTreeChild(parent, name, path, icon) {
    if (!parent.children.has(path)) parent.children.set(path, makeTreeNode(name, path, icon));
    return parent.children.get(path);
}

function incrementTreePath(root, parts) {
    let node = root;
    node.count += 1;
    for (const part of parts) {
        node = addTreeChild(node, part.name, part.path, part.icon);
        node.count += 1;
    }
}

function buildLoraFolderTree(loras) {
    const root = makeTreeNode("All", "__all", "All");
    const foldersRoot = addTreeChild(root, "文件夹", "group:folders", "Dir");
    const smartRoot = addTreeChild(root, "分类", "group:smart", "Tag");
    const sdRoot = addTreeChild(root, "模型版本", "group:sd", "SD");
    const statusRoot = addTreeChild(root, "整理状态", "group:status", "Meta");
    for (const item of loras || []) {
        item.auto_category = loraAutoCategoryForItem(item);
        item.category_label = loraCategoryForItem(item);
        item.kind_label = item.category_label;
        incrementTreePath(root, [
            { name: "分类", path: "group:smart", icon: "Tag" },
            { name: item.category_label, path: `smart:${item.category_label}`, icon: "Tag" },
        ]);
        incrementTreePath(root, [
            { name: "模型版本", path: "group:sd", icon: "SD" },
            { name: loraSdVersionLabel(item), path: `sd:${loraSdVersionLabel(item)}`, icon: "SD" },
        ]);
        const statusLabel = loraMetadataStatusLabel(item);
        incrementTreePath(root, [
            { name: "整理状态", path: "group:status", icon: "Meta" },
            { name: statusLabel, path: `status:${statusLabel}`, icon: "Meta" },
        ]);
        const parts = String(item.folder || "").split("/").filter(Boolean);
        const folderPath = [];
        incrementTreePath(root, [
            { name: "文件夹", path: "group:folders", icon: "Dir" },
            ...(parts.length ? parts : ["Root"]).map((part) => {
                folderPath.push(part);
                return { name: part, path: `folder:${folderPath.join("/")}`, icon: "Dir" };
            }),
        ]);
    }
    root.count = (loras || []).length;
    return root;
}

function loraMatchesFilter(item, filter) {
    if (!filter || filter === "__all") return true;
    if (filter.startsWith("group:")) return true;
    if (filter.startsWith("folder:")) return (item.folder || "Root") === filter.slice("folder:".length);
    if (filter.startsWith("smart:")) return (item.category_label || loraCategoryForItem(item)) === filter.slice("smart:".length);
    if (filter.startsWith("sd:")) return loraSdVersionLabel(item) === filter.slice("sd:".length);
    if (filter.startsWith("status:")) return loraMetadataStatusLabel(item) === filter.slice("status:".length);
    return item.folder === filter;
}

function setPromptTags(textarea, tags) {
    setTextareaValue(textarea, tags.map((item) => item.value || item).filter(Boolean).join(EXTRA_SEPARATOR));
}

function replacePromptTagAt(textarea, index, value) {
    const tags = splitPromptTags(textarea.value);
    if (!tags[index]) return false;
    tags[index].value = String(value || "").trim();
    setPromptTags(textarea, tags);
    return true;
}

function removePromptTagAt(textarea, index) {
    const tags = splitPromptTags(textarea.value);
    if (!tags[index]) return false;
    tags.splice(index, 1);
    setPromptTags(textarea, tags);
    return true;
}

function movePromptTagAt(textarea, fromIndex, toIndex) {
    const tags = splitPromptTags(textarea.value);
    if (!tags[fromIndex]) return false;
    const insertTarget = Math.max(0, Math.min(Number(toIndex), tags.length));
    const [moved] = tags.splice(fromIndex, 1);
    let insertIndex = insertTarget;
    if (fromIndex < insertIndex) insertIndex -= 1;
    insertIndex = Math.max(0, Math.min(insertIndex, tags.length));
    if (insertIndex === fromIndex) return false;
    tags.splice(insertIndex, 0, moved);
    setPromptTags(textarea, tags);
    return true;
}

function movePromptTagsAt(textarea, fromIndexes, toIndex) {
    const tags = splitPromptTags(textarea.value);
    const selected = [...new Set((fromIndexes || []).map((value) => Number(value)).filter((value) => Number.isInteger(value)))].sort((a, b) => a - b);
    if (!selected.length || selected.some((index) => !tags[index])) return false;
    const selectedSet = new Set(selected);
    const moving = selected.map((index) => tags[index]);
    const remaining = tags.filter((_, index) => !selectedSet.has(index));
    let insertIndex = Math.max(0, Math.min(Number(toIndex), tags.length));
    insertIndex -= selected.filter((index) => index < insertIndex).length;
    insertIndex = Math.max(0, Math.min(insertIndex, remaining.length));
    const currentFirst = selected[0];
    if (selected.length === 1 && insertIndex === currentFirst) return false;
    remaining.splice(insertIndex, 0, ...moving);
    setPromptTags(textarea, remaining);
    return true;
}

function normalizeAttentionValue(value) {
    const raw = String(value || "").trim();
    const lora = parseLoraTag(raw);
    if (lora) return { body: lora.name, weight: Number(lora.model || 1), lora };
    const weighted = raw.match(/^\((.*):(-?\d+(?:\.\d+)?)\)$/s);
    if (weighted) return { body: weighted[1].trim(), weight: Number(weighted[2]) };
    return { body: raw.replace(/^\(+|\)+$/g, "").replace(/^\[+|\]+$/g, "").trim(), weight: 1 };
}

function setTagNumericWeight(value, weight) {
    const parsed = normalizeAttentionValue(value);
    const rounded = Math.round(Number(weight || 1) * 100) / 100;
    if (parsed.lora) {
        const clip = parsed.lora.clip ? `:${parsed.lora.clip}` : "";
        return `<${parsed.lora.type}:${parsed.lora.name}:${rounded.toFixed(rounded % 1 ? 2 : 1).replace(/0$/, "")}${clip}>`;
    }
    if (!parsed.body) return value;
    if (Math.abs(rounded - 1) < 0.001) return parsed.body;
    return `(${parsed.body}:${rounded.toFixed(rounded % 1 ? 2 : 1).replace(/0$/, "")})`;
}

function changeTagNumericWeight(value, delta) {
    const parsed = normalizeAttentionValue(value);
    return setTagNumericWeight(value, parsed.weight + delta);
}

function setLayers(value, open, close, delta) {
    let text = String(value || "").trim();
    if (parseLoraTag(text)) return text;
    while (text.startsWith(open) && text.endsWith(close)) text = text.slice(1, -1).trim();
    const count = Math.max(0, delta);
    return `${open.repeat(count)}${text}${close.repeat(count)}`;
}

function favoriteForPrompt(state, kind, prompt) {
    const target = String(prompt || "").trim();
    return (state.promptAllInOne?.favorites?.[kind] || []).find((item) => String(item.prompt || "").trim() === target);
}

function positionChipTools(chips, chip, tools) {
    if (!chips || !chip || !tools) return;
    const chipsRect = chips.getBoundingClientRect();
    const chipRect = chip.getBoundingClientRect();
    if (!chipsRect.width || !chipRect.width) return;
    const scrollbarWidth = Math.max(0, chips.offsetWidth - chips.clientWidth);
    const viewportLeft = chipsRect.left + 6;
    const viewportRight = chipsRect.right - scrollbarWidth - 6;
    const maxWidth = Math.max(180, Math.min(420, viewportRight - viewportLeft));
    tools.style.maxWidth = `${Math.round(maxWidth)}px`;
    tools.style.left = "-1px";
    tools.style.right = "auto";
    const measuredWidth = Math.min(tools.scrollWidth || tools.getBoundingClientRect().width || maxWidth, maxWidth);
    const minLeft = viewportLeft - chipRect.left;
    const maxLeft = viewportRight - chipRect.left - measuredWidth;
    const nextLeft = maxLeft < minLeft ? minLeft : clampNumber(-1, minLeft, maxLeft);
    tools.style.left = `${Math.round(nextLeft)}px`;
    const toolsHeight = tools.getBoundingClientRect().height || 30;
    const downSpace = chipsRect.bottom - chipRect.bottom - 8;
    const upSpace = chipRect.top - chipsRect.top - 8;
    chip.classList.toggle("tools-up", downSpace < toolsHeight + 6 && upSpace > downSpace);
}

async function refreshFavoritesFromResult(state, result) {
    if (result?.favorites) state.promptAllInOne.favorites = result.favorites;
}

function renderPromptChips(row, textarea, state, afterChange, kind = "positive") {
    const chips = row.chips;
    if (!chips) return;
    const localMap = buildLocalTagMap(state);
    if (!row.__webuiBridgeSelectedTags) row.__webuiBridgeSelectedTags = new Set();
    const selectedTags = row.__webuiBridgeSelectedTags;
    for (const index of [...selectedTags]) {
        if (index >= splitPromptTags(textarea.value).length) selectedTags.delete(index);
    }
    chips.classList.remove("drag-active");
    chips.innerHTML = "";
    if (!row.__webuiBridgeDisabledTags) row.__webuiBridgeDisabledTags = [];
    const tags = splitPromptTags(textarea.value).slice(0, 160);
    const visibleTags = [
        ...tags.map((tag, index) => ({ ...tag, index, disabled: false })),
        ...row.__webuiBridgeDisabledTags.map((tag, index) => ({ ...tag, index, disabled: true })),
    ];
    row.classList.toggle("has-chips", visibleTags.length > 0);
    chips.classList.toggle("empty", visibleTags.length === 0);
    for (const tag of visibleTags) {
        const lora = parseLoraTag(tag.value);
        let local = localMap.get(tag.value.toLowerCase()) || "";
        let className = "webui-bridge-prompt-chip";
        let title = tag.value;
        if (lora) {
            const resolved = resolveLora(state, lora.name);
            const modelConnected = bridgeModelOutputConnected(state.bridgeNode);
            local = resolved ? `LoRA已匹配: ${resolved.alias || resolved.name}` : "LoRA未找到";
            className += resolved ? (modelConnected ? " lora found" : " lora warning") : " lora missing";
            if (resolved && !modelConnected) local = "LoRA已匹配，但model输出未接采样器";
            title = resolved
                ? (modelConnected
                    ? `${tag.value}\n生成时会由 WebUIPromptBridge 后端应用: ${resolved.name}`
                    : `${tag.value}\n只表示已找到文件: ${resolved.name}\n要让 LoRA 影响出图，需要把本节点 model 输出接到采样器使用的模型链路。`)
                : `${tag.value}\n未在 ComfyUI loras 目录找到，fail_on_missing_lora 开启时会报错`;
        } else if (!local && /[\u3400-\u9fff]/.test(tag.value)) {
            local = "可点“英”翻译为 Anima tag";
        }
        if (tag.disabled) {
            className += " disabled";
            title = `${tag.value}\n已禁用，不会写入生成提示词`;
        }
        if (!tag.disabled && selectedTags.has(tag.index)) className += " selected";
        const favorite = favoriteForPrompt(state, kind, tag.value);
        let tools = null;
        const chip = el("div", {
            class: className,
            title,
            draggable: tag.disabled ? "false" : "true",
            onmouseenter: () => {
                window.clearTimeout(chip.__webuiBridgeHideToolsTimer);
                chip.classList.add("show-tools");
                requestAnimationFrame(() => positionChipTools(chips, chip, tools));
            },
            onmouseleave: () => {
                window.clearTimeout(chip.__webuiBridgeHideToolsTimer);
                chip.__webuiBridgeHideToolsTimer = window.setTimeout(() => {
                    chip.classList.remove("show-tools");
                }, 420);
            },
            onclick: (event) => {
                if (event.target.closest(".webui-bridge-chip-tools")) return;
                if (row.__webuiBridgeDragJustEnded) return;
                if ((event.ctrlKey || event.metaKey) && !tag.disabled) {
                    if (selectedTags.has(tag.index)) selectedTags.delete(tag.index);
                    else selectedTags.add(tag.index);
                    renderPromptChips(row, textarea, state, afterChange, kind);
                    return;
                }
                window.clearTimeout(row.__webuiBridgeClickTimer);
                row.__webuiBridgeClickTimer = window.setTimeout(() => startChipEdit(chip, tag), 230);
            },
            ondblclick: (event) => {
                event.preventDefault();
                window.clearTimeout(row.__webuiBridgeClickTimer);
                toggleDisabled(tag);
                afterChange?.();
            },
            oncontextmenu: (event) => {
                event.preventDefault();
                chip.classList.toggle("show-tools");
                if (chip.classList.contains("show-tools")) {
                    requestAnimationFrame(() => positionChipTools(chips, chip, tools));
                }
            },
            ondragstart: (event) => {
                if (tag.disabled || event.target.closest(".webui-bridge-chip-tools")) {
                    event.preventDefault();
                    return;
                }
                window.clearTimeout(row.__webuiBridgeClickTimer);
                if (!selectedTags.has(tag.index)) {
                    selectedTags.clear();
                    selectedTags.add(tag.index);
                }
                row.__webuiBridgeDragging = { fromIndexes: [...selectedTags] };
                chip.classList.add("dragging");
                chips.classList.add("drag-active");
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", [...selectedTags].join(","));
            },
            ondragover: (event) => {
                if (tag.disabled || !row.__webuiBridgeDragging) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                const rect = chip.getBoundingClientRect();
                const after = event.clientX > rect.left + rect.width / 2;
                chip.classList.toggle("drop-before", !after);
                chip.classList.toggle("drop-after", after);
            },
            ondragleave: () => {
                chip.classList.remove("drop-before", "drop-after");
            },
            ondrop: (event) => {
                if (tag.disabled || !row.__webuiBridgeDragging) return;
                event.preventDefault();
                const rect = chip.getBoundingClientRect();
                const after = event.clientX > rect.left + rect.width / 2;
                const toIndex = tag.index + (after ? 1 : 0);
                if (movePromptTagsAt(textarea, row.__webuiBridgeDragging.fromIndexes, toIndex)) {
                    selectedTags.clear();
                    afterChange?.();
                }
                chip.classList.remove("drop-before", "drop-after");
            },
            ondragend: () => {
                chip.classList.remove("dragging", "drop-before", "drop-after");
                chips.classList.remove("drag-active");
                row.__webuiBridgeDragging = null;
                row.__webuiBridgeDragJustEnded = true;
                window.setTimeout(() => {
                    row.__webuiBridgeDragJustEnded = false;
                }, 260);
            },
        }, [
            el("span", { class: "webui-bridge-chip-main" }, tag.value),
            el("span", { class: "webui-bridge-chip-local" }, local || " "),
        ]);
        const tool = (text, label, handler, extraClass = "") => el("button", {
            class: `webui-bridge-chip-tool ${extraClass}`,
            title: label,
            onclick: async (event) => {
                event.preventDefault();
                event.stopPropagation();
                await handler();
                afterChange?.();
            },
        }, text);
        const weight = normalizeAttentionValue(tag.value).weight;
        const weightInput = el("input", {
            class: "webui-bridge-chip-weight",
            type: "number",
            step: "0.1",
            value: Number.isFinite(weight) ? String(weight) : "1",
            title: "权重数值",
            onclick: (event) => event.stopPropagation(),
            onchange: (event) => {
                if (!tag.disabled && replacePromptTagAt(textarea, tag.index, setTagNumericWeight(tag.value, event.currentTarget.value))) afterChange?.();
            },
        });
        tools = el("div", { class: "webui-bridge-chip-tools" }, [
            tool("-", "降低权重 0.1", () => !tag.disabled && replacePromptTagAt(textarea, tag.index, changeTagNumericWeight(tag.value, -0.1))),
            weightInput,
            tool("+", "提高权重 0.1", () => !tag.disabled && replacePromptTagAt(textarea, tag.index, changeTagNumericWeight(tag.value, 0.1))),
            tool("()", "加一层括号提高权重", () => !tag.disabled && replacePromptTagAt(textarea, tag.index, setLayers(tag.value, "(", ")", 1))),
            tool("[]", "加一层方括号降低权重", () => !tag.disabled && replacePromptTagAt(textarea, tag.index, setLayers(tag.value, "[", "]", 1))),
            tool("↵", "在此 tag 后换行", () => {
                const all = splitPromptTags(textarea.value);
                if (!tag.disabled && all[tag.index]) {
                    all.splice(tag.index + 1, 0, { value: "\n" });
                    setPromptTags(textarea, all);
                }
            }),
            tool("英", "翻译当前关键词为英文", async () => {
                if (tag.disabled) return;
                const translated = await translatePromptAllInOne(tag.value, "english");
                const next = (translated.tags || []).find((item) => item.prompt && item.prompt !== "\n")?.prompt || translated.prompt;
                if (next) replacePromptTagAt(textarea, tag.index, next);
            }),
            tool("⧉", "复制当前关键词", () => navigator.clipboard.writeText(tag.value).catch(() => {})),
            tool(favorite ? "★" : "☆", favorite ? "取消收藏" : "加入收藏", async () => {
                if (favorite && !confirm("只删除这个收藏项？")) return;
                const action = favorite ? "delete_favorite" : "push_favorite";
                const result = await updatePromptAllInOneStorage(action, kind, tag.value, local || tag.value, favorite?.id || "");
                await refreshFavoritesFromResult(state, result);
                row.__webuiBridgeRenderPanels?.();
            }, favorite ? "favorite active" : "favorite"),
            tool(tag.disabled ? "✓" : "⊘", tag.disabled ? "启用关键词" : "禁用关键词", () => toggleDisabled(tag)),
            tool("×", "删除关键词", () => deleteChip(tag), "danger"),
        ]);
        tools.addEventListener("mouseenter", () => {
            window.clearTimeout(chip.__webuiBridgeHideToolsTimer);
            chip.classList.add("show-tools");
            requestAnimationFrame(() => positionChipTools(chips, chip, tools));
        });
        tools.addEventListener("mouseleave", () => {
            window.clearTimeout(chip.__webuiBridgeHideToolsTimer);
            chip.__webuiBridgeHideToolsTimer = window.setTimeout(() => {
                chip.classList.remove("show-tools");
            }, 220);
        });
        chip.append(tools);
        function startChipEdit(node, item) {
            if (item.disabled) return;
            node.innerHTML = "";
            const input = el("textarea", { class: "webui-bridge-chip-edit", spellcheck: "false" });
            input.value = item.value;
            let done = false;
            const save = () => {
                if (done) return;
                done = true;
                const next = input.value.trim();
                if (next && replacePromptTagAt(textarea, item.index, next)) afterChange?.();
                else renderPromptChips(row, textarea, state, afterChange, kind);
            };
            input.addEventListener("blur", save);
            input.addEventListener("keydown", (event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    save();
                } else if (event.key === "Escape") {
                    done = true;
                    renderPromptChips(row, textarea, state, afterChange, kind);
                }
            });
            node.append(input);
            input.focus();
            input.select();
        }
        function toggleDisabled(item) {
            if (item.disabled) {
                const disabled = row.__webuiBridgeDisabledTags.splice(item.index, 1)[0];
                if (disabled?.value) addPromptArea(textarea, disabled.value);
            } else if (removePromptTagAt(textarea, item.index)) {
                row.__webuiBridgeDisabledTags.push({ value: item.value, local });
            }
        }
        function deleteChip(item) {
            if (item.disabled) row.__webuiBridgeDisabledTags.splice(item.index, 1);
            else removePromptTagAt(textarea, item.index);
        }
        chips.append(chip);
        if (lora) {
            const locallyResolved = resolveLora(state, lora.name);
            fetchLoraInfo(lora.name).then((info) => {
                if (!info || !chip.isConnected) return;
                const localNode = chip.querySelector(".webui-bridge-chip-local");
                if (info.found && !bridgeModelOutputConnected(state.bridgeNode)) {
                    chip.classList.remove("found", "missing");
                    chip.classList.add("warning");
                    if (localNode) localNode.textContent = "LoRA已匹配，但model输出未接采样器";
                    chip.title = `${tag.value}\n只表示已找到文件: ${info.name || locallyResolved?.name || lora.name}\n要让 LoRA 影响出图，需要把本节点 model 输出接到采样器使用的模型链路。`;
                    return;
                }
                if (info.found && !locallyResolved) {
                    chip.classList.remove("missing");
                    chip.classList.add("found");
                    if (localNode) localNode.textContent = `LoRA已匹配: ${info.name || lora.name}`;
                    chip.title = `${tag.value}\n后端已解析到: ${info.name || lora.name}`;
                } else if (!info.found && !locallyResolved) {
                    return;
                }
                const compatible = loraFamilyCompatibleWithCurrentModel(info.family);
                if (info.warning && !compatible) {
                    chip.classList.add("warning");
                    localNode.textContent = `可能不兼容: ${info.family || "unknown"} -> ${currentModelFamily()}`;
                    chip.title = `${tag.value}\n当前模型: ${currentCheckpointName() || currentModelFamily()}\n${info.warning}\nbase=${info.base_model || "unknown"}\nmodule=${info.network_module || "unknown"}`;
                } else if (info.family && info.family !== "unknown") {
                    chip.classList.toggle("warning", false);
                    localNode.textContent = compatible
                        ? `匹配 ${currentModelFamily()}`
                        : `${info.family} LoRA${info.trigger_words?.length ? `: ${info.trigger_words.slice(0, 3).join(", ")}` : ""}`;
                    chip.title = `${tag.value}\n当前模型: ${currentCheckpointName() || currentModelFamily()}\nbase=${info.base_model || info.family}\ntrigger=${(info.trigger_words || []).join(", ")}`;
                }
            });
        }
    }
    const plainTags = tags
        .map((tag) => tag.value)
        .filter((value) => value && !parseLoraTag(value));
    translateTagsToLocal(plainTags).then((locals) => {
        if (!chips.isConnected) return;
        const chipNodes = [...chips.querySelectorAll(".webui-bridge-prompt-chip:not(.lora)")];
        chipNodes.forEach((chip, index) => {
            const local = locals[index];
            if (!local || local === plainTags[index]) return;
            const localNode = chip.querySelector(".webui-bridge-chip-local");
            if (localNode) localNode.textContent = local;
        });
    });
}

function updatePromptArea(textarea, text, isNegative = false) {
    const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const extraRegex = isNegative
        ? new RegExp(`\\(${escaped.replace(/^\\(|\\)$/g, "")}\\)`, "g")
        : new RegExp(escaped, "g");

    if (extraRegex.test(textarea.value)) {
        setTextareaValue(textarea, textarea.value.replace(extraRegex, "").replace(/\s*,\s*,+/g, ", ").replace(/^\s*,\s*|\s*,\s*$/g, ""));
    } else {
        const sep = textarea.value.trim() ? EXTRA_SEPARATOR : "";
        setTextareaValue(textarea, textarea.value + sep + text);
    }
}

function addPromptArea(textarea, text) {
    if (!text) return false;
    if (promptHasExactTag(textarea.value, text)) return false;
    const sep = textarea.value.trim() ? EXTRA_SEPARATOR : "";
    setTextareaValue(textarea, textarea.value + sep + text);
    return true;
}

function promptHasLora(text, name) {
    const target = normalizeLoraName(name);
    if (!target) return false;
    return splitPromptTags(text).some((tag) => {
        const lora = parseLoraTag(tag.value);
        return lora && normalizeLoraName(lora.name) === target;
    });
}

function promptHasAnyLora(text) {
    return splitPromptTags(text).some((tag) => parseLoraTag(tag.value));
}

function formatLoraStrength(value, fallback = 1) {
    const number = Number(value);
    const safe = Number.isFinite(number) ? number : fallback;
    return safe.toFixed(3).replace(/\.?0+$/, "");
}

function loraPromptFromLoader(loader, state) {
    const rawName = getNodeWidgetValue(loader, "lora_name");
    if (!rawName) return null;
    const resolved = resolveLora(state, rawName);
    const name = resolved?.alias || resolved?.base_name || rawName;
    const model = formatLoraStrength(getNodeWidgetValue(loader, "strength_model"), 1);
    const clipValue = getNodeWidgetValue(loader, "strength_clip");
    const clip = Number(clipValue);
    const suffix = Number.isFinite(clip) && formatLoraStrength(clip, 1) !== model
        ? `:${formatLoraStrength(clip, 1)}`
        : "";
    return {
        key: normalizeLoraName(rawName),
        prompt: `<lora:${name}:${model}${suffix}>`,
    };
}

function cleanPromptSeparators(text) {
    return String(text || "")
        .replace(/\s*,\s*,+/g, ", ")
        .replace(/^\s*,\s*|\s*,\s*$/g, "")
        .replace(/[ \t]+/g, " ")
        .trim();
}

function removeAnimaFastLoras(text) {
    return cleanPromptSeparators(String(text || "").replace(ANIMA_FAST_LORA_PATTERN, ""));
}

function ensureAnimaFastLoras(textarea, state) {
    let added = 0;
    for (const item of ANIMA_FAST_LORAS) {
        const resolved = resolveLora(state, item.name);
        const name = resolved?.alias || item.name;
        const prompt = `<lora:${name}:${item.weight}>`;
        if (addPromptArea(textarea, prompt)) added += 1;
    }
    return added;
}

function applySamplerPreset(values) {
    const samplerNode = findFirstNode(["KSampler", "KSamplerAdvanced"]);
    if (!samplerNode) return [];
    const changed = [];
    for (const [name, value] of Object.entries(values)) {
        if (setNodeWidgetValue(samplerNode, name, value)) changed.push(name);
    }
    return changed;
}

async function updatePromptAreaWithLoraKeywords(textarea, text, isNegative, sync, notify, options = {}) {
    const changed = options.toggle === false
        ? addPromptArea(textarea, text)
        : (updatePromptArea(textarea, text, isNegative), true);
    sync?.();
    if (!changed) return;
    const lora = parseLoraTag(text);
    if (!lora || isNegative) return;
    const info = await fetchLoraInfo(lora.name);
    if (!info?.trigger_words?.length || info.warning) {
        if (info?.warning) notify?.("这个 LoRA 可能不是 Anima LoRA，只插入 LoRA 标签");
        return;
    }
    const additions = info.trigger_words
        .slice(0, 5)
        .map((word) => String(word || "").trim().replace(/\s+/g, "_"))
        .filter((word) => word && !promptContains(textarea.value, word));
    for (const word of additions) updatePromptArea(textarea, word, false);
    if (additions.length) {
        notify?.(`已自动加入 LoRA 触发词: ${additions.join(", ")}`);
        sync?.();
    }
}

async function completePromptForGeneration(positiveTextarea, negativeTextarea, sync, notify) {
    for (const tag of DEFAULT_QUALITY_TAGS) {
        if (!promptContains(positiveTextarea.value, tag)) updatePromptArea(positiveTextarea, tag, false);
    }
    if (/\bkamisato_ayaka\b/i.test(positiveTextarea.value)) {
        for (const tag of ["1girl", "solo", "genshin_impact", "silver_hair", "blue_eyes", "hair_ribbon"]) {
            if (!promptContains(positiveTextarea.value, tag)) updatePromptArea(positiveTextarea, tag, false);
        }
    } else if (!promptContains(positiveTextarea.value, "1girl") && /\bgirl\b/i.test(positiveTextarea.value)) {
        updatePromptArea(positiveTextarea, "1girl", false);
    }

    const loras = [...positiveTextarea.value.matchAll(/<\s*(?:lora|lyco):([^:>]+)(?::([^:>]+))?(?::([^:>]+))?\s*>/gi)];
    const added = [];
    for (const match of loras) {
        const info = await fetchLoraInfo(match[1].trim());
        if (!info?.trigger_words?.length || info.warning) continue;
        for (const word of info.trigger_words.slice(0, 6)) {
            const normalized = String(word || "").trim().replace(/\s+/g, "_");
            if (normalized && !promptContains(positiveTextarea.value, normalized)) {
                updatePromptArea(positiveTextarea, normalized, false);
                added.push(normalized);
            }
        }
    }

    if (!negativeTextarea.value.trim()) {
        setTextareaValue(negativeTextarea, DEFAULT_NEGATIVE_PROMPT);
    }
    sync?.();
    notify?.(added.length ? `已补全 LoRA 触发词: ${added.join(", ")}` : "已补全推荐质量词/负面词");
}

function applyStyleText(base, styleText) {
    if (!styleText) return base;
    if (styleText.includes("{prompt}")) return styleText.replaceAll("{prompt}", base);
    return base.trim() ? `${base}${EXTRA_SEPARATOR}${styleText}` : styleText;
}

function fetchJsonWithTimeout(url, options = {}, timeoutMs = 0) {
    if (!timeoutMs) {
        return api.fetchApi(url, options).then((r) => r.json());
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    return api.fetchApi(url, { ...options, signal: controller.signal })
        .then((r) => r.json())
        .finally(() => clearTimeout(timer));
}

async function loadBridgeData(options = {}) {
    const loraDetail = options.loraDetail === "full" ? "full" : "basic";
    const loraUrl = loraDetail === "full" ? "/webui_prompt_bridge/loras" : "/webui_prompt_bridge/loras?detail=basic";
    const loraTimeoutMs = options.loraTimeoutMs ?? (loraDetail === "basic" ? 8000 : 0);
    const fallbackLoras = Array.isArray(options.fallbackLoras) ? options.fallbackLoras : [];
    const [lorasRes, stylesRes, promptAllInOneRes, modelsRes, webuiRes, settingsRes] = await Promise.allSettled([
        fetchJsonWithTimeout(loraUrl, { cache: "no-store" }, loraTimeoutMs),
        api.fetchApi("/webui_prompt_bridge/styles", { cache: "no-store" }).then((r) => r.json()),
        api.fetchApi("/webui_prompt_bridge/prompt_all_in_one?lang=zh_CN", { cache: "no-store" }).then((r) => r.json()),
        api.fetchApi("/webui_prompt_bridge/models", { cache: "no-store" }).then((r) => r.json()),
        api.fetchApi("/webui_prompt_bridge/webui_integration", { cache: "no-store" }).then((r) => r.json()),
        api.fetchApi("/webui_prompt_bridge/settings", { cache: "no-store" }).then((r) => r.json()),
    ]);
    const lorasLoaded = lorasRes.status === "fulfilled";
    return {
        loras: lorasLoaded ? lorasRes.value.loras || [] : fallbackLoras,
        lorasLoaded,
        loraDetail,
        styles: stylesRes.status === "fulfilled" ? stylesRes.value.styles || [] : [],
        promptAllInOne: promptAllInOneRes.status === "fulfilled" ? promptAllInOneRes.value : { group_tags: [], favorites: {} },
        models: modelsRes.status === "fulfilled" ? modelsRes.value : { checkpoints: [], unets: [], clips: [], vaes: [], embeddings: [] },
        webuiIntegration: webuiRes.status === "fulfilled" ? webuiRes.value : null,
        settings: normalizeBridgeSettings(settingsRes.status === "fulfilled" ? settingsRes.value.settings : null),
        customTagCount: settingsRes.status === "fulfilled" ? settingsRes.value.custom_tag_count || 0 : 0,
        assets: settingsRes.status === "fulfilled" ? settingsRes.value.assets || null : null,
    };
}

function getGraphNodes() {
    return app.graph?._nodes || [];
}

function getGraphNodeById(id) {
    return app.graph?.getNodeById?.(id) || getGraphNodes().find((graphNode) => String(graphNode.id) === String(id));
}

function getGraphLink(linkId) {
    if (linkId === undefined || linkId === null) return null;
    const ids = [linkId, Number(linkId), String(linkId)];
    for (const links of [app.graph?._links, app.graph?.links]) {
        if (!links) continue;
        let link = null;
        if (links instanceof Map) {
            for (const id of ids) {
                if (links.has(id)) {
                    link = links.get(id);
                    break;
                }
            }
        } else if (Array.isArray(links)) {
            link = links.find((item) => String(item?.id ?? item?.[0]) === String(linkId));
        } else {
            link = links[linkId] || links[String(linkId)] || links[Number(linkId)];
        }
        if (link) {
            installGraphLinkSerializationFallback(link);
            return link;
        }
    }
    return null;
}

function linkOriginId(link) {
    return link?.origin_id ?? link?.originId ?? link?.[1];
}

function linkOriginSlot(link) {
    return link?.origin_slot ?? link?.originSlot ?? link?.[2] ?? 0;
}

function linkTargetId(link) {
    return link?.target_id ?? link?.targetId ?? link?.[3];
}

function linkTargetSlot(link) {
    return link?.target_slot ?? link?.targetSlot ?? link?.[4] ?? 0;
}

function graphLinkId(link) {
    return link?.id ?? link?.[0];
}

function slotTypeValues(type) {
    const values = Array.isArray(type) ? type : [type];
    return values
        .flatMap((value) => String(value ?? "").split(/[|,]/))
        .map((value) => value.trim().toUpperCase())
        .filter(Boolean);
}

function slotTypeIsWildcard(type) {
    const values = slotTypeValues(type);
    return !values.length || values.some((value) => value === "*" || value === "ANY" || value === "WILDCARD");
}

function slotTypesCompatible(outputType, inputType) {
    const outputs = slotTypeValues(outputType);
    const inputs = slotTypeValues(inputType);
    if (!outputs.length || !inputs.length) return true;
    if (slotTypeIsWildcard(outputs) || slotTypeIsWildcard(inputs)) return true;
    return outputs.some((output) => inputs.includes(output));
}

function graphLinkType(link) {
    return link?.type ?? link?.[5];
}

function setGraphLinkType(link, type) {
    if (!link || type === undefined || type === null || slotTypeIsWildcard(type)) return false;
    if (graphLinkType(link) === type) return false;
    link.type = type;
    if (Array.isArray(link)) link[5] = type;
    return true;
}

function installGraphLinkSerializationFallback(link) {
    if (!link || typeof link !== "object") return 0;
    let patched = 0;
    if (typeof link.serialize !== "function") {
        link.serialize = function () {
            return [
                graphLinkId(this),
                linkOriginId(this),
                linkOriginSlot(this),
                linkTargetId(this),
                linkTargetSlot(this),
                this.type ?? this[5],
            ];
        };
        patched += 1;
    }
    if (typeof link.asSerialisable !== "function") {
        link.asSerialisable = function () {
            const data = {
                id: graphLinkId(this),
                origin_id: linkOriginId(this),
                origin_slot: linkOriginSlot(this),
                target_id: linkTargetId(this),
                target_slot: linkTargetSlot(this),
                type: this.type ?? this[5],
            };
            if (this.parentId !== undefined) data.parentId = this.parentId;
            return data;
        };
        patched += 1;
    }
    if (typeof link.asSerializable !== "function") {
        link.asSerializable = link.asSerialisable;
        patched += 1;
    }
    if (typeof link.resolve !== "function") {
        link.resolve = function (graph) {
            const targetId = linkTargetId(this);
            const targetSlot = linkTargetSlot(this);
            const originId = linkOriginId(this);
            const originSlot = linkOriginSlot(this);
            const inputNode = targetId === -1 ? undefined : graph?.getNodeById?.(targetId) ?? getGraphNodeById(targetId) ?? undefined;
            const input = inputNode?.inputs?.[targetSlot];
            const subgraphInput = originId === -10 ? graph?.inputNode?.slots?.[originSlot] : undefined;
            if (subgraphInput) return { inputNode, input, subgraphInput, link: this };
            const outputNode = originId === -1 ? undefined : graph?.getNodeById?.(originId) ?? getGraphNodeById(originId) ?? undefined;
            const output = outputNode?.outputs?.[originSlot];
            const subgraphOutput = targetId === -20 ? graph?.outputNode?.slots?.[targetSlot] : undefined;
            return subgraphOutput
                ? { outputNode, output, subgraphInput: undefined, subgraphOutput, link: this }
                : { inputNode, outputNode, input, output, subgraphInput, subgraphOutput, link: this };
        };
        patched += 1;
    }
    if (typeof link.hasOrigin !== "function") {
        link.hasOrigin = function (nodeId, slot) {
            return String(linkOriginId(this)) === String(nodeId) && Number(linkOriginSlot(this)) === Number(slot);
        };
        patched += 1;
    }
    if (typeof link.hasTarget !== "function") {
        link.hasTarget = function (nodeId, slot) {
            return String(linkTargetId(this)) === String(nodeId) && Number(linkTargetSlot(this)) === Number(slot);
        };
        patched += 1;
    }
    return patched;
}

function ensureGraphLinksSerializableCompatibility() {
    let patched = 0;
    for (const links of [app.graph?._links, app.graph?.links, app.graph?.floatingLinks]) {
        if (!links) continue;
        const values = links instanceof Map
            ? links.values()
            : Array.isArray(links)
                ? links
                : Object.values(links);
        for (const link of values) patched += installGraphLinkSerializationFallback(link);
    }
    for (const reroute of app.graph?.reroutes?.values?.() || []) {
        if (reroute && typeof reroute.asSerialisable !== "function") {
            reroute.asSerialisable = function () {
                return {
                    id: this.id,
                    parentId: this.parentId,
                    pos: Array.isArray(this.pos) ? [this.pos[0], this.pos[1]] : this.pos,
                    linkIds: [...(this.linkIds || [])],
                    floating: this.floating ? { slotType: this.floating.slotType } : undefined,
                };
            };
            patched += 1;
        }
    }
    return patched;
}

function findInputSlot(node, name) {
    return node?.findInputSlot?.(name) ?? (node?.inputs || []).findIndex((input) => input.name === name);
}

function findOutputSlot(node, name, fallback = 0) {
    const slot = node?.findOutputSlot?.(name) ?? (node?.outputs || []).findIndex((output) => output.name === name || output.type === name);
    return slot >= 0 ? slot : fallback;
}

function outputSlotForType(node, type, fallback = 0) {
    const normalizedType = String(type || "").toUpperCase();
    const slot = (node?.outputs || []).findIndex((output) => String(output?.type || "").toUpperCase() === normalizedType);
    return slot >= 0 ? slot : findOutputSlot(node, normalizedType, fallback);
}

function disconnectInput(node, inputSlot) {
    if (!node || inputSlot < 0) return;
    if (typeof node.disconnectInput === "function") {
        node.disconnectInput(inputSlot);
        return;
    }
    const linkId = node.inputs?.[inputSlot]?.link;
    if (linkId !== undefined && linkId !== null) app.graph?.removeLink?.(linkId);
}

function removeInputLinkReference(node, inputSlot) {
    const input = node?.inputs?.[inputSlot];
    if (!input) return false;
    const linkId = input.link;
    if (linkId === undefined || linkId === null) return false;
    const link = getGraphLink(linkId);
    if (link) {
        const source = getGraphNodeById(linkOriginId(link));
        const outputSlot = linkOriginSlot(link);
        const output = source?.outputs?.[outputSlot];
        if (Array.isArray(output?.links)) {
            output.links = output.links.filter((id) => String(id) !== String(linkId));
        }
        app.graph?.removeLink?.(linkId);
    }
    input.link = null;
    app.graph?.setDirtyCanvas(true, true);
    return true;
}

function findOutputReferenceToLink(linkId) {
    if (linkId === undefined || linkId === null) return null;
    for (const source of getGraphNodes()) {
        for (let outputSlot = 0; outputSlot < (source.outputs || []).length; outputSlot += 1) {
            const output = source.outputs[outputSlot];
            if (!Array.isArray(output?.links)) continue;
            if (output.links.some((id) => String(id) === String(linkId))) {
                return { source, outputSlot, output };
            }
        }
    }
    return null;
}

function iterGraphLinks() {
    const seen = new Set();
    const values = [];
    for (const links of [app.graph?._links, app.graph?.links]) {
        if (!links) continue;
        const items = links instanceof Map
            ? links.values()
            : Array.isArray(links)
                ? links
                : Object.values(links);
        for (const link of items) {
            const id = graphLinkId(link);
            const key = String(id ?? values.length);
            if (seen.has(key)) continue;
            seen.add(key);
            values.push(link);
        }
    }
    return values;
}

function findExistingLinkToInput(targetNode, inputSlot) {
    for (const link of iterGraphLinks()) {
        if (String(linkTargetId(link)) === String(targetNode?.id) && Number(linkTargetSlot(link)) === Number(inputSlot)) {
            installGraphLinkSerializationFallback(link);
            if (linkCanFeedInput(link, targetNode, inputSlot)) return link;
        }
    }
    return null;
}

function linkSourceInfo(link) {
    const source = getGraphNodeById(linkOriginId(link));
    const outputSlot = linkOriginSlot(link);
    const output = source?.outputs?.[outputSlot];
    return { source, outputSlot, output };
}

function linkCanFeedInput(link, target, inputSlot) {
    const input = target?.inputs?.[inputSlot];
    if (!link || !target || !input) return false;
    const { source, output } = linkSourceInfo(link);
    if (!source || !output) return false;
    if (String(linkTargetId(link)) !== String(target.id) || Number(linkTargetSlot(link)) !== Number(inputSlot)) return false;
    const sourceType = output.type;
    const declaredType = graphLinkType(link);
    if (!slotTypeIsWildcard(sourceType) && !slotTypesCompatible(sourceType, input.type)) return false;
    if (!slotTypeIsWildcard(declaredType) && !slotTypesCompatible(declaredType, input.type)) return false;
    return true;
}

function linkFeedsType(link, type) {
    if (!link) return false;
    const { source, output } = linkSourceInfo(link);
    if (!source || !output) return false;
    const declaredType = graphLinkType(link);
    if (!slotTypeIsWildcard(output.type)) return slotTypesCompatible(output.type, type);
    if (!slotTypeIsWildcard(declaredType)) return slotTypesCompatible(declaredType, type);
    return false;
}

function writeGraphLink(linkId, source, outputSlot, target, inputSlot, type) {
    if (!app.graph || linkId === undefined || linkId === null || !source || !target) return false;
    const id = Number.isFinite(Number(linkId)) ? Number(linkId) : linkId;
    const link = {
        id,
        type: type || target.inputs?.[inputSlot]?.type || source.outputs?.[outputSlot]?.type || "*",
        origin_id: source.id,
        origin_slot: outputSlot,
        target_id: target.id,
        target_slot: inputSlot,
    };
    installGraphLinkSerializationFallback(link);
    if (app.graph._links instanceof Map) app.graph._links.set(id, link);
    else if (app.graph._links) app.graph._links[id] = link;
    if (app.graph.links instanceof Map) app.graph.links.set(id, link);
    else {
        app.graph.links = app.graph.links || {};
        app.graph.links[id] = link;
    }
    target.inputs[inputSlot].link = id;
    const output = source.outputs?.[outputSlot];
    if (output) {
        output.links = Array.isArray(output.links) ? output.links : [];
        if (!output.links.some((existing) => String(existing) === String(id))) output.links.push(id);
    }
    app.graph.setDirtyCanvas(true, true);
    return true;
}

function restoreMissingInputLink(node, inputSlot) {
    const input = node?.inputs?.[inputSlot];
    const linkId = input?.link;
    if (linkId === undefined || linkId === null) {
        const link = findExistingLinkToInput(node, inputSlot);
        if (!link) return false;
        input.link = graphLinkId(link);
        setGraphLinkType(link, input.type);
        return true;
    }
    if (getGraphLink(linkId)) return false;
    const reference = findOutputReferenceToLink(linkId);
    if (!reference) return false;
    if (!slotTypesCompatible(reference.output?.type, input.type)) return false;
    return writeGraphLink(linkId, reference.source, reference.outputSlot, node, inputSlot, input.type || reference.output?.type);
}

function isWidgetBackedInput(input) {
    return Boolean(input?.widget?.name || input?.widget || input?.type === "INT" || input?.type === "FLOAT" || input?.type === "BOOLEAN" || input?.type === "STRING");
}

function inputMayNeedConnection(input) {
    if (!input || input.link !== undefined && input.link !== null) return false;
    if (isWidgetBackedInput(input)) return false;
    const type = String(input.type || "").toUpperCase();
    if (!type || slotTypeIsWildcard(type) || type === "COMBO") return false;
    if (/optional/i.test(String(input.name || ""))) return false;
    return ["MODEL", "CLIP", "VAE", "LATENT", "CONDITIONING", "IMAGE", "SEGS", "BBOX_DETECTOR", "CONTROL_NET"].includes(type);
}

function repairStaleInputLinks() {
    let repaired = repairModelModeBranches();
    for (const graphNode of getGraphNodes()) {
        for (let slot = 0; slot < (graphNode.inputs || []).length; slot += 1) {
            const input = graphNode.inputs[slot];
            if (input.link === undefined || input.link === null) {
                if (inputMayNeedConnection(input) && repairMissingRequiredInput(graphNode, slot)) repaired += 1;
                continue;
            }
            const link = getGraphLink(input.link);
            if (link && linkCanFeedInput(link, graphNode, slot)) {
                if (slotTypeIsWildcard(linkSourceInfo(link).output?.type)) {
                    repaired += setGraphLinkType(link, input.type) ? 1 : 0;
                }
                continue;
            }
            if (restoreMissingInputLink(graphNode, slot)) {
                repaired += 1;
            } else if (repairMismatchedInputLink(graphNode, slot, link)) {
                repaired += 1;
            } else if (isWidgetBackedInput(input) && removeInputLinkReference(graphNode, slot)) {
                repaired += 1;
            }
        }
    }
    return repaired;
}

function repairQueueParentLinkError(error) {
    const message = String(error?.message || error || "");
    const match = message.match(/No link found in parent graph for id \[(\d+)] slot \[(\d+)]/i);
    if (!match) return 0;
    const graphNode = getGraphNodeById(match[1]);
    const slot = Number(match[2]);
    const input = graphNode?.inputs?.[slot];
    if (!graphNode || !input) return 0;
    if (restoreMissingInputLink(graphNode, slot)) return 1;
    if (isWidgetBackedInput(input) && removeInputLinkReference(graphNode, slot)) return 1;
    return 0;
}

async function submitComfyQueue() {
    ensureWidgetSerializableCompatibility();
    ensureGraphLinksSerializableCompatibility();
    if (typeof app.queuePrompt === "function") {
        await app.queuePrompt(0, 1);
        return "已提交生成任务";
    }
    const queueButton = document.querySelector("#queue-button, button.comfy-queue-button");
    if (!queueButton) throw new Error("找不到 ComfyUI 的生成按钮，无法提交队列。");
    queueButton.click();
    return "已点击 ComfyUI 生成按钮";
}

function connectNodes(sourceNode, outputSlot, targetNode, inputSlot) {
    if (!sourceNode || !targetNode || outputSlot < 0 || inputSlot < 0) return false;
    disconnectInput(targetNode, inputSlot);
    sourceNode.connect?.(outputSlot, targetNode, inputSlot);
    const link = getGraphLink(targetNode.inputs?.[inputSlot]?.link);
    installGraphLinkSerializationFallback(link);
    app.graph?.setDirtyCanvas(true, true);
    return true;
}

function captureInputLink(targetNode, inputSlot) {
    const linkId = targetNode?.inputs?.[inputSlot]?.link;
    const link = getGraphLink(linkId);
    const sourceId = linkOriginId(link);
    if (sourceId === undefined || sourceId === null) return null;
    return {
        sourceId,
        sourceSlot: linkOriginSlot(link),
        targetId: targetNode.id,
        targetSlot: inputSlot,
    };
}

function restoreCapturedLink(captured) {
    if (!captured) return false;
    const source = getGraphNodeById(captured.sourceId);
    const target = getGraphNodeById(captured.targetId);
    if (!source || !target) return false;
    return connectNodes(source, captured.sourceSlot, target, captured.targetSlot);
}

function inputSourceNode(targetNode, inputName) {
    const inputSlot = findInputSlot(targetNode, inputName);
    const link = getGraphLink(targetNode?.inputs?.[inputSlot]?.link);
    return getGraphNodeById(linkOriginId(link));
}

function collectUpstreamLoraLoaders(targetNode) {
    const found = [];
    const seen = new Set();
    function visit(node) {
        if (!node || seen.has(node.id)) return;
        seen.add(node.id);
        const text = `${node.type || ""} ${node.title || ""}`.toLowerCase();
        if (getWidget(node, "lora_name") && text.includes("lora")) found.push(node);
        for (const input of node.inputs || []) {
            const link = getGraphLink(input.link);
            const source = getGraphNodeById(linkOriginId(link));
            visit(source);
        }
    }
    for (const inputName of ["model", "clip"]) {
        visit(inputSourceNode(targetNode, inputName));
    }
    return found.reverse();
}

function findUpstreamNode(targetNode, inputNames, predicate) {
    const seen = new Set();
    function visit(node) {
        if (!node || seen.has(node.id)) return null;
        seen.add(node.id);
        if (predicate(node)) return node;
        for (const input of node.inputs || []) {
            const link = getGraphLink(input.link);
            const source = getGraphNodeById(linkOriginId(link));
            const found = visit(source);
            if (found) return found;
        }
        return null;
    }
    for (const inputName of inputNames) {
        const found = visit(inputSourceNode(targetNode, inputName));
        if (found) return found;
    }
    return null;
}

function nodeSearchText(graphNode) {
    return `${graphNode?.type || ""} ${graphNode?.title || ""} ${(graphNode?.widgets || []).map((widget) => widget.value || "").join(" ")}`.toLowerCase();
}

function setNodeWidgetValue(targetNode, widgetName, value) {
    const widget = getWidget(targetNode, widgetName);
    if (!widget || value === undefined || value === null || value === "") return false;
    let nextValue = value;
    if (typeof widget.value === "number") {
        nextValue = Number(value);
        if (!Number.isFinite(nextValue)) return false;
        if (Number.isInteger(widget.value) && !["cfg", "denoise"].includes(widgetName)) nextValue = Math.round(nextValue);
    }
    if (widget.options?.values?.length) {
        const values = widget.options.values;
        const exact = values.find((item) => String(item).toLowerCase() === String(nextValue).toLowerCase());
        if (!exact) return false;
        nextValue = exact;
    }
    widget.value = nextValue;
    widget.callback?.(nextValue);
    targetNode.setDirtyCanvas?.(true, true);
    app.graph?.setDirtyCanvas(true, true);
    return true;
}

function getNodeWidgetValue(targetNode, widgetName) {
    return getWidget(targetNode, widgetName)?.value;
}

function ensureWidgetSerializableCompatibility() {
    let patched = 0;
    for (const graphNode of getGraphNodes()) {
        for (const widget of graphNode.widgets || []) {
            patched += installWidgetSerializationFallback(widget);
        }
    }
    return patched;
}

function findFirstNode(types) {
    return getGraphNodes().find((graphNode) => types.includes(graphNode.type));
}

function findCheckpointLoaderNodes() {
    return getGraphNodes().filter((graphNode) => graphNode.type === "CheckpointLoaderSimple");
}

function findBridgeNodes() {
    return getGraphNodes().filter((graphNode) => graphNode.type === TARGET_NODE);
}

function findModelModeSwitchNode() {
    return getGraphNodes().find((graphNode) => (
        /boolean/i.test(`${graphNode.type || ""} ${graphNode.properties?.["Node name for S&R"] || ""}`) &&
        /模型模式|模型来源|分体|anima|model mode|model source|checkpoint/i.test(`${graphNode.title || ""} ${graphNode.properties?.["Node name for S&R"] || ""}`)
    ));
}

function nodeHasOutputType(graphNode, outputType) {
    return (graphNode?.outputs || []).some((output) => String(output?.type || "").toUpperCase() === outputType);
}

function findSplitModelSource(outputType) {
    const type = String(outputType || "").toUpperCase();
    const candidates = getGraphNodes().filter((graphNode) => nodeHasOutputType(graphNode, type));
    const scored = candidates
        .map((graphNode) => {
            const text = nodeSearchText(graphNode);
            let score = 0;
            if (/anima|qwen_image_vae|qwen/.test(text)) score += 4;
            if (type === "MODEL" && /unetloader|unet|basev10|diffusion/.test(text)) score += 3;
            if (type === "CLIP" && /cliploader|text encoder|txt|clip/.test(text)) score += 3;
            if (type === "VAE" && /vaeloader|vae/.test(text)) score += 3;
            if (/checkpointloader/.test(text)) score -= 8;
            return { graphNode, score };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);
    return scored[0]?.graphNode || null;
}

function findCheckpointSource(outputType) {
    const type = String(outputType || "").toUpperCase();
    const state = app.graph?.__webuiBridgeDirectSwitch;
    const stored = state?.checkpointNodeId ? getGraphNodeById(state.checkpointNodeId) : null;
    const candidates = [
        stored,
        ...findCheckpointLoaderNodes().filter((graphNode) => /Prompt Bridge Direct Checkpoint/i.test(graphNode.title || "")),
        ...findCheckpointLoaderNodes(),
    ].filter(Boolean);
    return candidates.find((graphNode) => nodeHasOutputType(graphNode, type)) || null;
}

function findBestSourceForType(outputType, mode = "auto") {
    const type = String(outputType || "").toUpperCase();
    const splitSource = ["MODEL", "CLIP", "VAE"].includes(type) ? findSplitModelSource(type) : null;
    const checkpointSource = ["MODEL", "CLIP", "VAE"].includes(type) ? findCheckpointSource(type) : null;
    if (mode === "split") return splitSource || checkpointSource;
    if (mode === "checkpoint") return checkpointSource || splitSource;
    if (currentModelMode() === false) return checkpointSource || splitSource;
    return splitSource || checkpointSource || getGraphNodes().find((graphNode) => nodeHasOutputType(graphNode, type)) || null;
}

function nodeWidgetTextValues(graphNode) {
    return (graphNode?.widgets || [])
        .map((widget) => String(widget?.value ?? widget ?? ""))
        .filter(Boolean);
}

function findGetNodeByKey(outputType, keys = []) {
    const type = String(outputType || "").toUpperCase();
    const keyList = keys.map((key) => String(key || "").toLowerCase()).filter(Boolean);
    const candidates = getGraphNodes().filter((graphNode) => graphNode.type === "GetNode" && nodeHasOutputType(graphNode, type));
    if (!keyList.length) return candidates[0] || null;
    for (const key of keyList) {
        const found = candidates.find((graphNode) => nodeWidgetTextValues(graphNode).join(" ").toLowerCase().includes(key));
        if (found) return found;
    }
    return null;
}

function findTypedGetNodeSourceForInput(targetNode, inputSlot, outputType) {
    const type = String(outputType || "").toUpperCase();
    const inputName = String(targetNode?.inputs?.[inputSlot]?.name || "").toLowerCase();
    const text = nodeSearchText(targetNode);
    if (type === "VAE") return findGetNodeByKey("VAE", ["VAE_3_0"]) || findGetNodeByKey("VAE");
    if (type === "CLIP") return findGetNodeByKey("CLIP", ["clip_4_1", "CLIP_2_0"]) || findGetNodeByKey("CLIP");
    if (type === "MODEL") return findGetNodeByKey("MODEL", ["model_4_0", "MODEL_1_0", "__50_0"]) || findGetNodeByKey("MODEL");
    if (type === "IMAGE") {
        if (/bboxdetectorsegs|hand bbox/.test(text)) return findGetNodeByKey("IMAGE", ["__18_0", "__14_0", "IMAGE_7_0"]);
        if (/detailerforeach|hand detailer/.test(text)) return findGetNodeByKey("IMAGE", ["__18_0", "__14_0", "IMAGE_7_0"]);
        if (/facedetailer|face detailer/.test(text)) return findGetNodeByKey("IMAGE", ["__14_0", "IMAGE_7_0"]);
        if (/preview|save|final/.test(text)) return findGetNodeByKey("IMAGE", ["__final_output_with_post_resize", "__post_target_mp", "__post_pixel_scale", "__27_0"]);
        if (inputName.includes("image")) return findGetNodeByKey("IMAGE", ["__18_0", "__14_0", "IMAGE_7_0", "IMAGE_29_0"]);
    }
    if (type === "LATENT") return findGetNodeByKey("LATENT", ["LATENT_6_0", "LATENT_5_0"]) || findGetNodeByKey("LATENT");
    if (type === "CONDITIONING") {
        if (inputName.includes("negative")) return findGetNodeByKey("CONDITIONING", ["negative_4_3", "__45_0"]);
        return findGetNodeByKey("CONDITIONING", ["positive_4_2", "__51_0", "__44_0"]) || findGetNodeByKey("CONDITIONING");
    }
    return null;
}

function connectInputToTypedSource(targetNode, inputSlot, outputType, mode = "auto") {
    const source = findBestSourceForType(outputType, mode);
    if (!source || String(source.id) === String(targetNode?.id)) return false;
    const outputSlot = outputSlotForType(source, outputType);
    if (outputSlot < 0) return false;
    const connected = connectNodes(source, outputSlot, targetNode, inputSlot);
    const link = getGraphLink(targetNode?.inputs?.[inputSlot]?.link);
    if (connected) setGraphLinkType(link, String(outputType || "").toUpperCase());
    return connected;
}

function conditionalBranchLooksLikeType(graphNode, outputType) {
    if (!/conditionalbranch/i.test(String(graphNode?.type || ""))) return false;
    const type = String(outputType || "").toUpperCase();
    if (nodeSearchText(graphNode).includes(type.toLowerCase())) return true;
    for (const output of graphNode.outputs || []) {
        for (const linkId of output.links || []) {
            const link = getGraphLink(linkId);
            const target = getGraphNodeById(linkTargetId(link));
            const input = target?.inputs?.[linkTargetSlot(link)];
            if (input && slotTypesCompatible(type, input.type)) return true;
        }
    }
    return false;
}

function repairConditionalBranchForType(graphNode, outputType) {
    const type = String(outputType || "").toUpperCase();
    if (!conditionalBranchLooksLikeType(graphNode, type)) return 0;
    let repaired = 0;
    const trueSlot = findInputSlot(graphNode, "tt_value");
    const falseSlot = findInputSlot(graphNode, "ff_value");
    const trueLink = getGraphLink(graphNode.inputs?.[trueSlot]?.link);
    const falseLink = getGraphLink(graphNode.inputs?.[falseSlot]?.link);
    if (trueSlot >= 0 && !linkFeedsType(trueLink, type) && connectInputToTypedSource(graphNode, trueSlot, type, "split")) repaired += 1;
    if (falseSlot >= 0 && !linkFeedsType(falseLink, type) && connectInputToTypedSource(graphNode, falseSlot, type, "checkpoint")) repaired += 1;
    for (const output of graphNode.outputs || []) {
        for (const linkId of output.links || []) {
            const link = getGraphLink(linkId);
            const target = getGraphNodeById(linkTargetId(link));
            const input = target?.inputs?.[linkTargetSlot(link)];
            if (input && slotTypesCompatible(type, input.type)) repaired += setGraphLinkType(link, type) ? 1 : 0;
        }
    }
    return repaired;
}

function repairModelModeBranches() {
    let repaired = 0;
    for (const graphNode of getGraphNodes()) {
        repaired += repairConditionalBranchForType(graphNode, "VAE");
    }
    return repaired;
}

function repairMismatchedInputLink(graphNode, inputSlot, link) {
    const input = graphNode?.inputs?.[inputSlot];
    const inputType = String(input?.type || "").toUpperCase();
    if (!inputType || slotTypeIsWildcard(inputType)) return false;
    const { source, output } = linkSourceInfo(link);
    if (source && repairConditionalBranchForType(source, inputType)) {
        setGraphLinkType(link, inputType);
        if (linkCanFeedInput(link, graphNode, inputSlot)) return true;
    }
    if (source && slotTypeIsWildcard(output?.type) && setGraphLinkType(link, inputType) && linkCanFeedInput(link, graphNode, inputSlot)) return true;
    if (["MODEL", "CLIP", "VAE"].includes(inputType)) return connectInputToTypedSource(graphNode, inputSlot, inputType);
    return false;
}

function connectInputToGetNodeSource(targetNode, inputSlot, outputType) {
    const source = findTypedGetNodeSourceForInput(targetNode, inputSlot, outputType);
    if (!source || String(source.id) === String(targetNode?.id)) return false;
    const outputSlot = outputSlotForType(source, outputType);
    if (outputSlot < 0) return false;
    const connected = connectNodes(source, outputSlot, targetNode, inputSlot);
    const link = getGraphLink(targetNode?.inputs?.[inputSlot]?.link);
    if (connected) setGraphLinkType(link, String(outputType || "").toUpperCase());
    return connected;
}

function repairMissingRequiredInput(graphNode, inputSlot) {
    const input = graphNode?.inputs?.[inputSlot];
    const inputType = String(input?.type || "").toUpperCase();
    if (!inputType || slotTypeIsWildcard(inputType)) return false;
    if (restoreMissingInputLink(graphNode, inputSlot)) return true;
    if (["MODEL", "CLIP", "VAE"].includes(inputType)) {
        return connectInputToGetNodeSource(graphNode, inputSlot, inputType) || connectInputToTypedSource(graphNode, inputSlot, inputType);
    }
    if (["IMAGE", "LATENT", "CONDITIONING"].includes(inputType)) return connectInputToGetNodeSource(graphNode, inputSlot, inputType);
    return false;
}

function connectBridgeToSplitSources() {
    const modelSource = findSplitModelSource("MODEL");
    const clipSource = findSplitModelSource("CLIP");
    const vaeSource = findSplitModelSource("VAE");
    let changed = 0;
    for (const bridgeNode of findBridgeNodes()) {
        const modelSlot = findInputSlot(bridgeNode, "model");
        const clipSlot = findInputSlot(bridgeNode, "clip");
        if (modelSource && modelSlot >= 0 && connectNodes(modelSource, findOutputSlot(modelSource, "MODEL"), bridgeNode, modelSlot)) changed += 1;
        if (clipSource && clipSlot >= 0 && connectNodes(clipSource, findOutputSlot(clipSource, "CLIP"), bridgeNode, clipSlot)) changed += 1;
    }
    if (vaeSource) {
        for (const target of findVaeTargetsForDirectSwitch()) {
            if (connectNodes(vaeSource, findOutputSlot(vaeSource, "VAE"), target.node, target.slot)) changed += 1;
        }
    }
    return changed;
}

function hasSplitAnimaModelSource() {
    const text = getGraphNodes()
        .map((graphNode) => `${graphNode.type || ""} ${graphNode.title || ""} ${(graphNode.widgets || []).map((widget) => widget.value || "").join(" ")}`)
        .join("\n")
        .toLowerCase();
    return /anima.*(unet|basev10)|anima_basev10|anima.*text encoder|qwen_image_vae/.test(text);
}

function sourceIsCheckpointLoader(node, inputName) {
    return Boolean(findUpstreamNode(node, [inputName], (source) => source.type === "CheckpointLoaderSimple"));
}

function sourceLooksLikeSplitAnima(node, inputName) {
    const source = inputSourceNode(node, inputName);
    if (!source) return false;
    return /anima|qwen_image_vae|unetloader|cliploader|vaeloader/.test(nodeSearchText(source));
}

function isDirectCheckpointMode() {
    return findBridgeNodes().some((bridgeNode) => sourceIsCheckpointLoader(bridgeNode, "model") || sourceIsCheckpointLoader(bridgeNode, "clip"));
}

function directSwitchState() {
    const graph = app.graph;
    graph.__webuiBridgeDirectSwitch = graph.__webuiBridgeDirectSwitch || {
        bridgeInputs: [],
        vaeInputs: [],
        checkpointNodeId: null,
    };
    return graph.__webuiBridgeDirectSwitch;
}

function captureDirectInput(collection, node, inputSlot) {
    if (!node || inputSlot < 0) return;
    const key = `${node.id}:${inputSlot}`;
    if (collection.some((item) => item.key === key)) return;
    const captured = captureInputLink(node, inputSlot);
    if (captured) collection.push({ ...captured, key });
}

function findDirectCheckpointLoader() {
    const state = directSwitchState();
    const stored = state.checkpointNodeId ? getGraphNodeById(state.checkpointNodeId) : null;
    if (stored?.type === "CheckpointLoaderSimple") return stored;
    const titled = findCheckpointLoaderNodes().find((graphNode) => /Prompt Bridge Direct Checkpoint/i.test(graphNode.title || ""));
    if (titled) {
        state.checkpointNodeId = titled.id;
        return titled;
    }
    const existing = findCheckpointLoaderNodes()[0];
    if (existing) {
        state.checkpointNodeId = existing.id;
        return existing;
    }
    if (!window.LiteGraph?.createNode || !app.graph?.add) return null;
    const bridgeNode = findBridgeNodes()[0];
    const loader = LiteGraph.createNode("CheckpointLoaderSimple");
    if (!loader) return null;
    loader.title = "Prompt Bridge Direct Checkpoint";
    loader.pos = [
        (bridgeNode?.pos?.[0] || 60) + (bridgeNode?.size?.[0] || DEFAULT_PANEL_WIDTH) + 60,
        bridgeNode?.pos?.[1] || 60,
    ];
    app.graph.add(loader);
    state.checkpointNodeId = loader.id;
    app.graph.setDirtyCanvas(true, true);
    return loader;
}

function findVaeTargetsForDirectSwitch() {
    const targets = [];
    for (const graphNode of getGraphNodes()) {
        for (const [slot, input] of (graphNode.inputs || []).entries()) {
            if (input.type !== "VAE") continue;
            const source = inputSourceNode(graphNode, input.name);
            if (source?.type === "CheckpointLoaderSimple") {
                targets.push({ node: graphNode, slot });
                continue;
            }
            const text = nodeSearchText(source);
            if (source?.type === "VAELoader" && /anima|qwen_image_vae|vae/.test(text)) {
                targets.push({ node: graphNode, slot });
            }
        }
    }
    return targets;
}

function applyDirectCheckpointModel(modelName) {
    const loader = findDirectCheckpointLoader();
    if (!loader) return { changed: false, message: "未找到也无法创建 CheckpointLoaderSimple" };
    const modelChanged = setNodeWidgetValue(loader, "ckpt_name", modelName);
    const state = directSwitchState();
    state.checkpointNodeId = loader.id;
    let changed = modelChanged ? 1 : 0;
    for (const bridgeNode of findBridgeNodes()) {
        for (const [inputName, outputName] of [["model", "MODEL"], ["clip", "CLIP"]]) {
            const inputSlot = findInputSlot(bridgeNode, inputName);
            if (inputSlot < 0) continue;
            captureDirectInput(state.bridgeInputs, bridgeNode, inputSlot);
            if (connectNodes(loader, findOutputSlot(loader, outputName), bridgeNode, inputSlot)) changed += 1;
        }
    }
    for (const target of findVaeTargetsForDirectSwitch()) {
        captureDirectInput(state.vaeInputs, target.node, target.slot);
        if (connectNodes(loader, findOutputSlot(loader, "VAE", 2), target.node, target.slot)) changed += 1;
    }
    return {
        changed: changed > 0,
        message: `已直接切换到整合模型: ${modelName}`,
    };
}

function restoreDirectSplitModelMode() {
    const state = directSwitchState();
    let changed = 0;
    for (const captured of [...state.bridgeInputs, ...state.vaeInputs]) {
        if (restoreCapturedLink(captured)) changed += 1;
    }
    if (!changed) changed = connectBridgeToSplitSources();
    return {
        changed: changed > 0,
        message: changed ? "已切回分体 Anima/Qwen 模式" : "未找到可接回的 Anima UNET / Text Encoder / VAE 节点",
    };
}

function currentModelMode() {
    if (isDirectCheckpointMode()) return false;
    const switchNode = findModelModeSwitchNode();
    const switchValue = getNodeWidgetValue(switchNode, "value");
    if (switchValue !== undefined) return Boolean(switchValue);
    if (findBridgeNodes().some((bridgeNode) => sourceLooksLikeSplitAnima(bridgeNode, "model") || sourceLooksLikeSplitAnima(bridgeNode, "clip"))) return true;
    if (hasSplitAnimaModelSource()) return true;
    return null;
}

function collectCheckpointOptions(models = {}) {
    const seen = new Set();
    const options = [];
    const add = (value) => {
        const text = String(value || "").trim();
        if (!text || seen.has(text)) return;
        seen.add(text);
        options.push(text);
    };
    for (const checkpoint of models.checkpoints || []) add(checkpoint);
    for (const loader of findCheckpointLoaderNodes()) {
        const widget = getWidget(loader, "ckpt_name");
        for (const value of widget?.options?.values || []) add(value);
        add(widget?.value);
    }
    return options;
}

function currentCheckpointName() {
    const loader = findBridgeNodes()
        .map((bridgeNode) => findUpstreamNode(bridgeNode, ["model", "clip"], (source) => source.type === "CheckpointLoaderSimple"))
        .find(Boolean) || findCheckpointLoaderNodes()[0];
    return String(getNodeWidgetValue(loader, "ckpt_name") || "");
}

function currentModelFamily() {
    if (currentModelMode() === true) return "anima";
    const name = currentCheckpointName().toLowerCase();
    if (/\b(sd1|1\.5)\b|anything|counterfeit|realisticvision/.test(name)) return "sd1";
    if (/xl|sdxl|noob|illustrious|pony|wai|animagine|kohaku|prefectpony/.test(name)) return "sdxl/noob";
    return "unknown";
}

function loraFamilyCompatibleWithCurrentModel(family) {
    const loraFamily = String(family || "unknown").toLowerCase();
    const modelFamily = currentModelFamily();
    if (!loraFamily || loraFamily === "unknown" || modelFamily === "unknown") return true;
    if (modelFamily === "anima") return loraFamily === "anima";
    if (modelFamily === "sdxl/noob") return loraFamily.includes("sdxl") || loraFamily.includes("noob") || loraFamily.includes("pony");
    if (modelFamily === "sd1") return loraFamily === "sd1";
    return true;
}

function isSplitModelMode() {
    return currentModelMode();
}

function applyCheckpointModel(name) {
    const modelName = String(name || "").trim();
    if (!modelName) return { changed: false, message: "请选择模型" };
    const switchNode = findModelModeSwitchNode();
    if (!switchNode) return applyDirectCheckpointModel(modelName);
    const loaders = findCheckpointLoaderNodes();
    if (!loaders.length) return { changed: false, message: "未找到 CheckpointLoaderSimple" };
    let changed = 0;
    for (const loader of loaders) {
        if (setNodeWidgetValue(loader, "ckpt_name", modelName)) changed += 1;
    }
    if (switchNode) setNodeWidgetValue(switchNode, "value", false);
    return {
        changed: changed > 0,
        message: switchNode
            ? `已切换到整合模型: ${modelName}`
            : `已设置 Checkpoint: ${modelName}`,
    };
}

function applySplitModelMode() {
    const switchNode = findModelModeSwitchNode();
    if (!switchNode) return restoreDirectSplitModelMode();
    const changed = setNodeWidgetValue(switchNode, "value", true);
    return {
        changed,
        message: "已切换到分体 Anima/Qwen 模式",
    };
}

function parseInfotextClient(text) {
    const lines = (text || "").trim().split(/\r?\n/);
    const result = {};
    if (!lines.length) return result;
    let lastLine = lines[lines.length - 1] || "";
    const paramMatches = [...lastLine.matchAll(/\s*([\w \-/]+):\s*("(?:\\.|[^"])*"|[^,]+)(?:,|$)/g)];
    const promptLines = paramMatches.length >= 3 ? lines.slice(0, -1) : lines;
    if (paramMatches.length < 3) lastLine = "";
    let inNegative = false;
    const prompt = [];
    const negative = [];
    for (let line of promptLines) {
        line = line.trim();
        if (line.startsWith("Negative prompt:")) {
            inNegative = true;
            line = line.slice(16).trim();
        }
        (inNegative ? negative : prompt).push(line);
    }
    for (const match of paramMatches) {
        const key = match[1].trim();
        let value = match[2].trim();
        if (value.startsWith('"') && value.endsWith('"')) value = decodeURIComponent(value.slice(1, -1));
        const size = value.match(/^(\d+)[xX](\d+)$/);
        if (size) {
            result[`${key}-1`] = size[1];
            result[`${key}-2`] = size[2];
        } else {
            result[key] = value;
        }
    }
    result.Prompt = prompt.join("\n").trim();
    result["Negative prompt"] = negative.join("\n").trim();
    return result;
}

async function parseInfotext(text) {
    try {
        const response = await api.fetchApi("/webui_prompt_bridge/parse_infotext", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text }),
        });
        if (response.ok) {
            const data = await response.json();
            return data.parameters || {};
        }
    } catch {
        // The client parser keeps the paste button useful if ComfyUI was not restarted yet.
    }
    return parseInfotextClient(text);
}

async function updateStyle(action, name, positivePrompt = "", negativePrompt = "") {
    const response = await api.fetchApi("/webui_prompt_bridge/styles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            action,
            name,
            prompt: positivePrompt,
            negative_prompt: negativePrompt,
        }),
    });
    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    return data.styles || [];
}

async function translatePromptAllInOne(text, to = "english") {
    const response = await api.fetchApi("/webui_prompt_bridge/prompt_all_in_one/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, to, lang: "zh_CN" }),
    });
    if (!response.ok) throw new Error(await response.text());
    return await response.json();
}

async function fetchAutocomplete(query, limit = 10) {
    const response = await api.fetchApi(`/webui_prompt_bridge/autocomplete?q=${encodeURIComponent(query)}&limit=${limit}`, {
        cache: "no-store",
    });
    if (!response.ok) throw new Error("Autocomplete failed");
    return response.json();
}

const loraInfoCache = new Map();

async function fetchLoraInfo(name) {
    if (!name) return null;
    if (!loraInfoCache.has(name)) {
        loraInfoCache.set(name, api.fetchApi(`/webui_prompt_bridge/lora_info?name=${encodeURIComponent(name)}`, {
            cache: "no-store",
        }).then((response) => (response.ok ? response.json() : null)).catch(() => null));
    }
    return loraInfoCache.get(name);
}

async function fetchLoraUserMetadata(name) {
    const response = await api.fetchApi(`/webui_prompt_bridge/lora_user_metadata?name=${encodeURIComponent(name)}`, {
        cache: "no-store",
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
}

async function saveLoraUserMetadata(name, values) {
    const response = await api.fetchApi("/webui_prompt_bridge/lora_user_metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...values }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
}

async function replaceLoraPreview(name, file) {
    const form = new FormData();
    form.append("name", name);
    form.append("preview", file);
    const response = await api.fetchApi("/webui_prompt_bridge/lora_preview", {
        method: "POST",
        body: form,
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
}

async function fetchWebUIIntegration() {
    const response = await api.fetchApi("/webui_prompt_bridge/webui_integration", { cache: "no-store" });
    if (!response.ok) {
        if (response.status === 404) throw new Error("后端接口未加载，请重启 ComfyUI 后再打开一键接入");
        const text = await response.text();
        throw new Error(text || `读取 WebUI 接入状态失败 (${response.status})`);
    }
    return response.json();
}

async function connectWebUIRoot(webuiRoot, autoDetect = false) {
    const response = await api.fetchApi("/webui_prompt_bridge/webui_integration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ webui_root: webuiRoot, auto_detect: autoDetect }),
    });
    const text = await response.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = {};
    }
    if (!response.ok) {
        if (response.status === 404) throw new Error("后端接口未加载，请重启 ComfyUI 后再点一键接入");
        throw new Error(data.error || text || `WebUI 接入失败 (${response.status})，请确认选择的是 WebUI 根目录`);
    }
    return data;
}

async function saveBridgeSettings(settings) {
    const response = await api.fetchApi("/webui_prompt_bridge/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
}

async function fetchAIConfig() {
    const response = await api.fetchApi("/webui_prompt_bridge/ai_config", { cache: "no-store" });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
}

async function saveAIConfig(config) {
    const response = await api.fetchApi("/webui_prompt_bridge/ai_config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
    });
    if (!response.ok) {
        if (response.status === 405) throw new Error("后端接口还是旧版本，请重启 ComfyUI 后再保存 AI 配置");
        throw new Error(await response.text());
    }
    return response.json();
}

async function testAIConfig(prompt) {
    const response = await api.fetchApi("/webui_prompt_bridge/ai_config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "AI 接口测试失败");
    return data;
}

async function fetchAIModels(config) {
    const response = await api.fetchApi("/webui_prompt_bridge/ai_config/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config || {}),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        if (response.status === 405) throw new Error("后端接口还是旧版本，请重启 ComfyUI 后再检测模型");
        throw new Error(data.error || "模型检测失败");
    }
    return data;
}

function normalizeAIModelInput(model, baseUrl = "") {
    const raw = String(model || "").trim();
    const key = raw.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (String(baseUrl || "").toLowerCase().includes("siliconflow") && ["deepseekv4flash", "deepseek4flash", "deepseekv4"].includes(key)) {
        return "deepseek-ai/DeepSeek-V4-Flash";
    }
    return raw;
}

async function importBridgeTags(items) {
    const response = await api.fetchApi("/webui_prompt_bridge/import_tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
}

async function fetchCustomTags() {
    const response = await api.fetchApi("/webui_prompt_bridge/custom_tags", { cache: "no-store" });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
}

async function saveCustomTag(index, item) {
    const response = await api.fetchApi("/webui_prompt_bridge/custom_tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index, item }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
}

async function deleteCustomTag(index) {
    const response = await api.fetchApi(`/webui_prompt_bridge/custom_tags?index=${encodeURIComponent(index)}`, {
        method: "DELETE",
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
}

async function fetchPromptMarketSources() {
    const response = await api.fetchApi("/webui_prompt_bridge/prompt_market", { cache: "no-store" });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
}

async function importPromptMarketSource(sourceId) {
    const response = await api.fetchApi("/webui_prompt_bridge/prompt_market/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId }),
    });
    if (!response.ok) throw new Error(await response.text());
    return response.json();
}

async function installBridgeAssets(mode, webuiRoot = "") {
    const response = await api.fetchApi("/webui_prompt_bridge/install_assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, webui_root: webuiRoot }),
    });
    const text = await response.text();
    let data = {};
    try {
        data = text ? JSON.parse(text) : {};
    } catch {
        data = {};
    }
    if (response.status === 404 || response.status === 405) {
        throw new Error("后端安装接口未加载，请重启 ComfyUI 后再试");
    }
    if (!response.ok || data.ok === false) {
        const detail = (data.results || []).map((item) => item.error).filter(Boolean).join("；");
        throw new Error(data.error || detail || text || "下载失败");
    }
    return data;
}

function assetInstallMessage(result) {
    const installed = (result.results || []).filter((item) => item.status === "installed").length;
    const exists = (result.results || []).filter((item) => item.status === "exists").length;
    const total = (result.results || []).length;
    if (installed) return `已安装 ${installed}/${total} 个配套数据${exists ? `，${exists} 个已存在` : ""}`;
    return `配套数据已存在 ${exists}/${total}`;
}

function webuiExtensionsReady(info, assets = null) {
    const checks = info?.checks || {};
    const assetWebui = assets?.webui || {};
    const promptReady = Boolean(checks.prompt_all_in_one_dir?.exists || assetWebui.prompt_all_in_one?.exists);
    const tagReady = Boolean(checks.tagcomplete_dir?.exists || assetWebui.tagcomplete?.exists);
    return promptReady && tagReady;
}

function parseDelimitedLine(line) {
    const result = [];
    let value = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
        const char = line[index];
        const next = line[index + 1];
        if (char === '"' && quoted && next === '"') {
            value += '"';
            index += 1;
        } else if (char === '"') {
            quoted = !quoted;
        } else if (!quoted && (char === "," || char === "\t")) {
            result.push(value.trim());
            value = "";
        } else {
            value += char;
        }
    }
    result.push(value.trim());
    return result;
}

function normalizeImportedTag(row, headers = null) {
    if (!row) return null;
    if (!Array.isArray(row) && typeof row === "object") {
        return {
            prompt: row.prompt || row.text || row.tag || "",
            local: row.local || row.name || row.zh || "",
            group: row.group || "",
            subgroup: row.subgroup || row.category || "",
            kind: row.kind || row.type || "positive",
        };
    }
    const get = (name, fallbackIndex) => {
        const index = headers?.indexOf(name);
        return row[index >= 0 ? index : fallbackIndex] || "";
    };
    return {
        prompt: get("prompt", 0) || get("text", 0) || get("tag", 0),
        local: get("local", 1) || get("name", 1) || get("zh", 1),
        group: get("group", 2),
        subgroup: get("subgroup", 3) || get("category", 3),
        kind: get("kind", 4) || get("type", 4) || "positive",
    };
}

async function parseImportedTagFile(file) {
    const text = await file.text();
    const trimmed = text.trim();
    if (!trimmed) return [];
    try {
        const json = JSON.parse(trimmed);
        const rows = Array.isArray(json) ? json : (Array.isArray(json.tags) ? json.tags : Object.entries(json).map(([local, prompt]) => ({ local, prompt })));
        return rows.map((row) => normalizeImportedTag(row)).filter((row) => row?.prompt);
    } catch {
        // Fall through to CSV/TSV parsing.
    }
    const lines = trimmed.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) return [];
    let headers = null;
    const first = parseDelimitedLine(lines[0]).map((item) => item.toLowerCase());
    if (first.some((item) => ["prompt", "text", "tag", "local", "zh", "group", "category", "kind", "type"].includes(item))) {
        headers = first;
        lines.shift();
    }
    return lines
        .map((line) => normalizeImportedTag(parseDelimitedLine(line), headers))
        .filter((row) => row?.prompt);
}

function loraPromptText(item) {
    const weight = Number(item?.preferred_weight || item?.user_metadata?.["preferred weight"] || 0);
    const strength = weight > 0 ? weight : 1;
    const base = `<lora:${item.alias || item.base_name || item.name}:${Number(strength).toFixed(2).replace(/\.?0+$/, "")}>`;
    const activation = String(item?.activation_text || item?.user_metadata?.["activation text"] || "").trim();
    return activation ? `${base}, ${activation}` : base;
}

function applyLoraDetailToItem(item, detail) {
    const user = detail?.user_metadata || {};
    item.description = user.description || detail?.description || "";
    item.user_metadata = user;
    item.manual_category = user.category || "";
    item.category = item.manual_category;
    item.activation_text = user["activation text"] || "";
    item.negative_text = user["negative text"] || "";
    item.preferred_weight = Number(user["preferred weight"] || 0);
    item.sd_version = user["sd version"] || detail?.sd_version || "";
    item.notes = user.notes || "";
    item.auto_category = loraAutoCategoryForItem(item);
    item.category_label = loraCategoryForItem(item);
    item.kind_label = item.category_label;
    if (detail?.thumbnail) item.thumbnail = `${detail.thumbnail}${detail.thumbnail.includes("?") ? "&" : "?"}t=${Date.now()}`;
    item.prompt = loraPromptText(item);
    return item;
}

function randomPromptFromTrainingTags(tags) {
    const list = Array.isArray(tags) ? tags : [];
    if (!list.length) return "";
    const maxCount = Number(list[0]?.count || 1) || 1;
    const selected = [];
    for (const item of list) {
        const tag = String(item.tag || "").trim();
        const count = Number(item.count || 0);
        if (tag && count > Math.random() * maxCount) selected.push(tag.replace(/[()[\]{}]/g, "\\$&"));
    }
    return selected.sort().join(", ");
}

function showLoraMetadataDialog(item, { categoryOptions = [], onSaved, onStatus } = {}) {
    const mask = el("div", { class: "webui-bridge-lora-mask" });
    const preview = el("div", { class: "webui-bridge-lora-edit-preview" }, "NO PREVIEW");
    const title = el("div", { class: "webui-bridge-lora-edit-title" }, loraDisplayName(item));
    const description = el("textarea", { class: "webui-bridge-lora-edit-textarea", rows: "4" });
    const tableBody = el("div", { class: "webui-bridge-lora-edit-table" });
    const categoryListId = `webui-bridge-lora-category-${Math.random().toString(36).slice(2)}`;
    const categoryList = el("datalist", { id: categoryListId }, collectLoraCategoryOptions([{ ...item }, ...categoryOptions.map((value) => ({ manual_category: value }))]).map((value) => el("option", { value })));
    const category = el("input", {
        class: "webui-bridge-lora-edit-input",
        list: categoryListId,
        title: "留空使用自动分类",
    });
    const autoCategory = el("span", { class: "webui-bridge-lora-auto-category" });
    const sdVersion = el("select", { class: "webui-bridge-lora-edit-input" }, [
        el("option", { value: "SD1" }, "SD1"),
        el("option", { value: "SD2" }, "SD2"),
        el("option", { value: "SDXL" }, "SDXL"),
        el("option", { value: "Unknown" }, "Unknown"),
    ]);
    const tagBox = el("div", { class: "webui-bridge-lora-tags" });
    const activation = el("textarea", { class: "webui-bridge-lora-edit-input", rows: "2" });
    const preferredWeight = el("input", { class: "webui-bridge-lora-edit-weight", type: "number", min: "0", max: "2", step: "0.01" });
    const negative = el("textarea", { class: "webui-bridge-lora-edit-input", rows: "2" });
    const randomPrompt = el("textarea", { class: "webui-bridge-lora-edit-input", rows: "3", readonly: "readonly" });
    const notes = el("textarea", { class: "webui-bridge-lora-edit-textarea", rows: "4" });
    const status = el("div", { class: "webui-bridge-lora-edit-status" });
    const fileInput = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp", style: { display: "none" } });
    let detail = null;

    const close = () => mask.remove();
    const setDialogStatus = (text) => {
        status.textContent = text || "";
        status.classList.toggle("visible", Boolean(text));
    };
    const fill = (nextDetail) => {
        detail = nextDetail;
        applyLoraDetailToItem(item, detail);
        title.textContent = loraDisplayName(item);
        description.value = item.description || "";
        category.value = loraManualCategory(item);
        category.placeholder = `自动: ${item.auto_category || loraAutoCategoryForItem(item)}`;
        autoCategory.textContent = `自动: ${item.auto_category || loraAutoCategoryForItem(item)}`;
        sdVersion.value = item.sd_version || "Unknown";
        activation.value = item.activation_text || "";
        preferredWeight.value = String(item.preferred_weight || 0);
        negative.value = item.negative_text || "";
        notes.value = item.notes || "";
        if (detail.thumbnail) {
            preview.innerHTML = "";
            preview.append(el("img", { src: item.thumbnail || detail.thumbnail, alt: "" }));
        } else {
            preview.textContent = "NO PREVIEW";
        }
        tableBody.innerHTML = "";
        for (const row of detail.metadata_table || []) {
            if (!row.value) continue;
            tableBody.append(el("div", { class: "webui-bridge-lora-edit-table-row" }, [
                el("strong", {}, row.label),
                el("span", {}, row.value),
            ]));
        }
        tagBox.innerHTML = "";
        const tags = detail.training_tags || [];
        for (const tag of tags.slice(0, 32)) {
            tagBox.append(el("button", {
                type: "button",
                title: "Add/remove this tag in activation text",
                onclick: () => {
                    const parts = activation.value.split(/\s*,\s*/).filter(Boolean);
                    const index = parts.indexOf(tag.tag);
                    if (index >= 0) parts.splice(index, 1);
                    else parts.push(tag.tag);
                    activation.value = parts.join(", ");
                },
            }, [
                el("span", {}, tag.tag),
                el("b", {}, tag.count),
            ]));
        }
        randomPrompt.value = randomPromptFromTrainingTags(tags);
    };

    const panel = el("div", { class: "webui-bridge-lora-edit" }, [
        el("div", { class: "webui-bridge-lora-edit-head" }, [
            title,
            el("button", { type: "button", title: "Close", onclick: close }, "x"),
        ]),
        el("div", { class: "webui-bridge-lora-edit-body" }, [
            el("div", { class: "webui-bridge-lora-edit-main" }, [
                el("label", {}, ["描述", description]),
                tableBody,
                el("label", {}, [
                    "分类",
                    el("div", { class: "webui-bridge-lora-category-row" }, [
                        category,
                        autoCategory,
                    ]),
                ]),
                el("label", {}, ["Stable Diffusion 版本", sdVersion]),
                el("label", {}, ["数据集的训练标签", tagBox]),
                el("label", {}, ["触发词", activation]),
                el("label", { class: "webui-bridge-lora-weight-row" }, [
                    el("span", {}, "推荐权重"),
                    preferredWeight,
                ]),
                el("label", {}, ["反向提示词", negative]),
                el("label", {}, [
                    el("span", { class: "webui-bridge-lora-random-head" }, [
                        el("span", {}, "随机提示词"),
                        el("button", {
                            type: "button",
                            onclick: () => {
                                randomPrompt.value = randomPromptFromTrainingTags(detail?.training_tags || []);
                            },
                        }, "生成"),
                    ]),
                    randomPrompt,
                ]),
                el("label", {}, ["注意事项", notes]),
            ]),
            preview,
        ]),
        el("div", { class: "webui-bridge-lora-edit-actions" }, [
            el("button", { type: "button", onclick: close }, "取消"),
            el("button", { type: "button", class: "primary", onclick: () => fileInput.click() }, "替换预览图"),
            el("button", {
                type: "button",
                class: "primary",
                onclick: async () => {
                    try {
                        setDialogStatus("保存中...");
                        const saved = await saveLoraUserMetadata(item.name, {
                            description: description.value,
                            category: category.value.trim(),
                            sd_version: sdVersion.value,
                            activation_text: activation.value,
                            preferred_weight: Number(preferredWeight.value || 0),
                            negative_text: negative.value,
                            notes: notes.value,
                        });
                        fill(saved);
                        onSaved?.(saved, item);
                        onStatus?.("LoRA metadata saved");
                        close();
                    } catch (error) {
                        setDialogStatus(error.message || "Save failed");
                    }
                },
            }, "保存"),
        ]),
        status,
        fileInput,
        categoryList,
    ]);

    fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        try {
            setDialogStatus("替换预览图...");
            const updated = await replaceLoraPreview(item.name, file);
            fill(updated);
            onSaved?.(updated, item);
            onStatus?.("LoRA preview replaced");
            setDialogStatus("");
        } catch (error) {
            setDialogStatus(error.message || "Preview upload failed");
        } finally {
            fileInput.value = "";
        }
    });

    mask.addEventListener("click", (event) => {
        if (event.target === mask) close();
    });
    mask.append(panel);
    document.body.append(mask);
    setDialogStatus("读取 LoRA 信息...");
    fetchLoraUserMetadata(item.name).then((nextDetail) => {
        fill(nextDetail);
        setDialogStatus("");
    }).catch((error) => {
        setDialogStatus(error.message || "Load failed");
    });
}

function compactCount(value) {
    const count = Number(value || 0);
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${Math.round(count / 100) / 10}K`;
    return count ? String(count) : "";
}

function promptTokenAtCursor(textarea) {
    const text = textarea.value || "";
    const cursor = textarea.selectionStart || 0;
    let start = cursor;
    while (start > 0 && !",，、\n\r".includes(text[start - 1])) start -= 1;
    let end = cursor;
    while (end < text.length && !",，、\n\r".includes(text[end])) end += 1;
    while (start < cursor && /\s/.test(text[start])) start += 1;
    return { start, end, value: text.slice(start, cursor).trim() };
}

function replacePromptToken(textarea, item) {
    const token = promptTokenAtCursor(textarea);
    const prompt = item.text || item.prompt || "";
    if (!token.value || !prompt) return;
    const text = textarea.value || "";
    const suffix = text.slice(token.end).match(/^\s*,/) ? "" : EXTRA_SEPARATOR;
    const next = text.slice(0, token.start) + prompt + suffix + text.slice(token.end).replace(/^\s*,\s*/, "");
    setTextareaValue(textarea, next);
    const caret = token.start + prompt.length + suffix.length;
    textarea.focus();
    textarea.selectionStart = caret;
    textarea.selectionEnd = caret;
}

async function resolveKeywordInput(value, autoTranslate = true) {
    const raw = String(value || "").trim();
    if (!raw) return [];
    if (!autoTranslate) return [{ prompt: raw, local: "" }];

    try {
        const translated = await translatePromptAllInOne(raw, "english");
        const tags = (translated.tags || []).filter((tag) => tag.prompt && tag.prompt !== "\n");
        if (translated.matched || tags.some((tag) => tag.prompt !== tag.input)) return tags;
    } catch {
        // Fall back to autocomplete.
    }

    try {
        const suggestions = await fetchAutocomplete(raw, 1);
        const first = suggestions.items?.[0];
        if (first?.text) return [{ prompt: first.text, local: first.local || "" }];
    } catch {
        // Keep raw input below.
    }
    return [{ prompt: raw.replace(/\s+/g, "_"), local: "" }];
}

function installAutocomplete(input, options) {
    const popup = el("div", { class: "webui-bridge-autocomplete" });
    if (options.compact) popup.classList.add("compact");
    input.__webuiBridgeAutocompletePopup = popup;
    input.__webuiBridgePickAutocomplete = () => pick(activeIndex);
    document.body.append(popup);
    let activeIndex = 0;
    let lastQuery = "";
    let lastItems = [];
    let timer = 0;
    let picking = false;

    const getQuery = () => options.getQuery?.() ?? input.value;
    const close = () => {
        popup.classList.remove("visible");
        popup.innerHTML = "";
        lastItems = [];
        activeIndex = 0;
    };
    const pick = async (index) => {
        if (picking) return false;
        const item = lastItems[index];
        if (!item) return false;
        picking = true;
        try {
            await options.onPick(item);
            close();
        } finally {
            picking = false;
        }
        return true;
    };
    const position = () => {
        const rect = input.getBoundingClientRect();
        const minWidth = options.popupMinWidth || 260;
        const maxWidth = options.popupMaxWidth || Math.max(minWidth, Math.round(rect.width));
        const width = Math.min(Math.max(minWidth, Math.round(rect.width)), maxWidth);
        const left = Math.max(8, Math.min(Math.round(rect.left), window.innerWidth - width - 12));
        popup.style.left = `${left}px`;
        popup.style.top = `${Math.round(rect.bottom + 4)}px`;
        popup.style.width = `${width}px`;
        if (options.popupMaxHeight) popup.style.maxHeight = `${options.popupMaxHeight}px`;
    };
    const render = (items) => {
        lastItems = items || [];
        activeIndex = 0;
        popup.innerHTML = "";
        if (!lastItems.length) {
            close();
            return;
        }
        position();
        lastItems.forEach((item, index) => {
            const choose = async (event) => {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation?.();
                await pick(index);
            };
            const row = el("button", {
                class: index === activeIndex ? "active" : "",
                type: "button",
                onpointerdown: choose,
                onmousedown: choose,
                onclick: choose,
            }, [
                el("span", { class: "webui-bridge-ac-main" }, item.text),
                item.local ? el("span", { class: "webui-bridge-ac-local" }, item.local) : null,
                el("span", { class: "webui-bridge-ac-count" }, compactCount(item.count)),
            ]);
            popup.append(row);
        });
        popup.classList.add("visible");
    };
    const request = () => {
        const query = String(getQuery() || "").trim();
        lastQuery = query;
        if (query.length < 1 || query.startsWith("<")) {
            close();
            return;
        }
        clearTimeout(timer);
        timer = window.setTimeout(async () => {
            try {
                const data = await fetchAutocomplete(query, options.limit || 10);
                if (lastQuery === query) render(data.items || []);
            } catch {
                close();
            }
        }, 90);
    };

    input.addEventListener("input", () => {
        if (input.__webuiBridgeSettingValue) return;
        request();
    });
    if (options.showOnFocus !== false) input.addEventListener("focus", request);
    input.addEventListener("blur", () => window.setTimeout(close, 120));
    input.addEventListener("keydown", (event) => {
        if (!popup.classList.contains("visible")) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
            event.preventDefault();
            activeIndex = (activeIndex + (event.key === "ArrowDown" ? 1 : -1) + lastItems.length) % lastItems.length;
            [...popup.children].forEach((child, index) => child.classList.toggle("active", index === activeIndex));
        } else if (event.key === "Enter" || event.key === "Tab") {
            event.preventDefault();
            pick(activeIndex);
        } else if (event.key === "Escape") {
            close();
        }
    });
    window.addEventListener("resize", close);
    return { close, request };
}

async function updatePromptAllInOneStorage(action, kind, prompt = "", name = "", id = "") {
    const response = await api.fetchApi("/webui_prompt_bridge/prompt_all_in_one/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, kind, prompt, name, id, lang: "zh_CN" }),
    });
    if (!response.ok) throw new Error(await response.text());
    return await response.json();
}

function normalizeWebUISampler(name) {
    const raw = String(name || "").trim();
    const lower = raw.toLowerCase();
    let sampler = raw;
    let scheduler = null;

    if (lower.includes("karras")) scheduler = "karras";
    else if (lower.includes("exponential")) scheduler = "exponential";
    else if (lower.includes("sgm uniform")) scheduler = "sgm_uniform";
    else if (lower.includes("normal")) scheduler = "normal";

    const base = lower
        .replace(/\s*karras|\s*exponential|\s*sgm uniform|\s*normal/g, "")
        .replace(/\+\+/g, "pp")
        .replace(/\s+/g, " ")
        .trim();

    const map = new Map([
        ["euler a", "euler_ancestral"],
        ["euler", "euler"],
        ["lms", "lms"],
        ["heun", "heun"],
        ["dpm2", "dpm_2"],
        ["dpm2 a", "dpm_2_ancestral"],
        ["dpmpp 2m", "dpmpp_2m"],
        ["dpmpp 2s a", "dpmpp_2s_ancestral"],
        ["dpmpp sde", "dpmpp_sde"],
        ["dpmpp 3m sde", "dpmpp_3m_sde"],
        ["ddim", "ddim"],
        ["uni pc", "uni_pc"],
        ["uni pc bh2", "uni_pc_bh2"],
    ]);
    sampler = map.get(base) || base.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    return { sampler, scheduler };
}

function applyGenerationParameters(parameters) {
    const changed = [];
    const samplerNode = findFirstNode(["KSampler", "KSamplerAdvanced"]);
    const latentNode = findFirstNode(["EmptyLatentImage", "EmptySD3LatentImage"]);

    if (samplerNode) {
        if (setNodeWidgetValue(samplerNode, "seed", parameters.Seed)) changed.push("Seed");
        if (setNodeWidgetValue(samplerNode, "steps", parameters.Steps)) changed.push("Steps");
        if (setNodeWidgetValue(samplerNode, "cfg", parameters["CFG scale"])) changed.push("CFG");
        if (parameters.Sampler) {
            const { sampler, scheduler } = normalizeWebUISampler(parameters.Sampler);
            if (setNodeWidgetValue(samplerNode, "sampler_name", sampler)) changed.push("Sampler");
            if (scheduler && setNodeWidgetValue(samplerNode, "scheduler", scheduler)) changed.push("Scheduler");
        }
        if (parameters["Denoising strength"]) {
            if (setNodeWidgetValue(samplerNode, "denoise", parameters["Denoising strength"])) changed.push("Denoise");
        }
    }

    if (latentNode) {
        if (setNodeWidgetValue(latentNode, "width", parameters["Size-1"])) changed.push("Width");
        if (setNodeWidgetValue(latentNode, "height", parameters["Size-2"])) changed.push("Height");
    }

    return changed;
}

function createPromptRow(label, value, placeholder, onFocus, onInput, options = {}) {
    const textarea = el("textarea", {
        spellcheck: "false",
        placeholder,
        onfocus: (event) => onFocus(event.currentTarget),
        oninput: (event) => onInput(event.currentTarget),
    });
    textarea.value = value || "";
    const counter = el("div", { class: "webui-bridge-token-counter" }, "0/75");
    const translateStatus = el("div", { class: "webui-bridge-translate-status" }, "");
    const baseKey = String(label || "prompt").toLowerCase().replace(/\W+/g, "-");
    const textareaHeightKey = options.textareaHeightKey || `webui-bridge-textarea-height-${baseKey}`;
    const chipHeightKey = options.sizeKey || `webui-bridge-chip-height-${baseKey}`;
    const collapseKey = options.collapseKey || `webui-bridge-collapse-${String(label || "prompt").toLowerCase().replace(/\W+/g, "-")}`;
    const chips = el("div", { class: "webui-bridge-prompt-chips empty" });
    textarea.__webuiBridgeHeightKey = textareaHeightKey;
    textarea.__webuiBridgeMinHeight = 48;
    textarea.__webuiBridgeMaxHeight = 520;
    chips.__webuiBridgeHeightKey = chipHeightKey;
    chips.__webuiBridgeMinHeight = PROMPT_CHIPS_MIN_HEIGHT;
    chips.__webuiBridgeMaxHeight = 520;
    applyStoredHeight(textarea, textareaHeightKey, { min: 48, max: 520 });
    applyStoredHeight(chips, chipHeightKey, { min: PROMPT_CHIPS_MIN_HEIGHT, max: 520 });
    const resetButton = el("button", {
        class: "webui-bridge-prompt-label-btn",
        title: "恢复这个提示词窗口的默认高度",
        onclick: () => {
            clearLocalValue(textareaHeightKey);
            clearLocalValue(chipHeightKey);
            textarea.style.height = "";
            textarea.style.flex = "";
            chips.style.height = "";
            chips.style.flex = "";
        },
    }, "↺");
    const labelTools = [resetButton];
    let collapsed = options.collapsible ? readLocalBoolean(collapseKey, false) : false;
    let collapseButton = null;
    let row = null;
    let textChipGrip = null;
    let chipBottomGrip = null;
    const applyCollapsedState = (nextCollapsed) => {
        collapsed = Boolean(nextCollapsed);
        row?.classList.toggle("collapsed", collapsed);
        const prompts = row?.closest(".webui-bridge-prompts");
        prompts?.classList.toggle("negative-collapsed", collapsed);
        applyTopRowCollapsedState(prompts?.closest(".webui-bridge-toprow"), collapsed);
        if (row) row.style.maxHeight = collapsed ? "42px" : "";
        if (collapseButton) collapseButton.textContent = collapsed ? "展开" : "折叠";
        for (const part of [textarea, chips, textChipGrip, chipBottomGrip, counter]) {
            if (part) part.style.display = collapsed ? "none" : "";
        }
    };
    if (options.collapsible) {
        collapseButton = el("button", {
            class: "webui-bridge-prompt-label-btn",
            title: "折叠/展开这个提示词区域",
            onclick: () => {
                applyCollapsedState(!collapsed);
                writeLocalBoolean(collapseKey, collapsed);
            },
        }, collapsed ? "展开" : "折叠");
        labelTools.unshift(collapseButton);
    }
    textChipGrip = createHeightSplitGrip(textarea, chips, textareaHeightKey, chipHeightKey, {
        beforeMin: 48,
        beforeMax: 520,
        afterMin: PROMPT_CHIPS_MIN_HEIGHT,
        afterMax: 520,
        title: "上下拖动分配文本框和已输入 tag 区高度，双击恢复",
    });
    chipBottomGrip = createHeightResizeGrip(chips, chipHeightKey, { min: PROMPT_CHIPS_MIN_HEIGHT, max: 520, title: "拖动调整已输入 tag 区底边高度，双击恢复" });
    row = el("div", { class: "webui-bridge-prompt-row" }, [
        el("div", { class: "webui-bridge-prompt-label" }, [
            el("span", {}, label),
            el("span", { class: "webui-bridge-prompt-label-tools" }, labelTools),
        ]),
        translateStatus,
        textarea,
        textChipGrip,
        chips,
        chipBottomGrip,
        counter,
    ]);
    applyCollapsedState(collapsed);
    row.chips = chips;
    row.translateStatus = translateStatus;
    row.__webuiBridgeBottomResizeTarget = () => chips.classList.contains("empty") ? textarea : chips;
    row.__webuiBridgeBottomResizeKey = () => chips.classList.contains("empty") ? textareaHeightKey : chipHeightKey;
    return { row, textarea, counter };
}

function setPromptTranslateStatus(textarea, message = "", active = false) {
    const row = textarea?.closest?.(".webui-bridge-prompt-row");
    if (!row) return;
    row.classList.toggle("translating", Boolean(active));
    if (row.translateStatus) {
        row.translateStatus.textContent = message || "";
        row.translateStatus.classList.toggle("visible", Boolean(message));
    }
}

function createToolButton(text, title, onclick) {
    return el("button", { class: "webui-bridge-tool", title, onclick }, text);
}

function createPanelErrorView(error) {
    const message = error?.stack || error?.message || String(error || "Unknown error");
    return el("div", { class: "webui-bridge-panel webui-bridge-panel-error" }, [
        el("div", { class: "webui-bridge-error-title" }, "WebUI Prompt Bridge failed to render"),
        el("pre", {}, message),
    ]);
}

function promptContains(text, prompt) {
    if (!prompt) return false;
    return (text || "").toLowerCase().includes(prompt.toLowerCase());
}

function promptHasExactTag(text, prompt) {
    const target = String(prompt || "").trim().toLowerCase();
    if (!target) return false;
    return splitPromptTags(text).some((tag) => tag.value.trim().toLowerCase() === target);
}

function promptHintScore(tags, hints) {
    let score = 0;
    for (const tag of tags) {
        const normalized = tag.replace(/[_-]+/g, " ").toLowerCase();
        if (hints.some((hint) => normalized === hint || normalized.includes(hint))) score += 1;
    }
    return score;
}

function looksLikeMisplacedPositivePrompt(text) {
    const value = String(text || "").trim();
    if (!value) return false;
    const tags = splitPromptTags(value).map((tag) => tag.value.trim().toLowerCase()).filter(Boolean);
    const hasLora = /<\s*(?:lora|lyco)\s*:/i.test(value);
    const positiveScore = promptHintScore(tags, POSITIVE_PROMPT_HINTS);
    const negativeScore = promptHintScore(tags, NEGATIVE_PROMPT_HINTS);
    if (hasLora && negativeScore <= Math.max(1, positiveScore + 1)) return true;
    return positiveScore >= 2 && positiveScore >= negativeScore;
}

function queueErrorMessage(error) {
    const messages = [];
    const visit = (value) => {
        if (!value || messages.length >= 5) return;
        if (typeof value === "string") {
            messages.push(value);
            return;
        }
        if (Array.isArray(value)) {
            for (const item of value) visit(item);
            return;
        }
        if (typeof value !== "object") return;
        if (value.message) messages.push(value.message);
        if (value.details) messages.push(value.details);
        if (value.exception_message) messages.push(value.exception_message);
        if (value.received_value !== undefined && value.input_name) {
            messages.push(`${value.input_name}: ${value.received_value}`);
        }
        visit(value.error);
        visit(value.errors);
        visit(value.node_errors);
        visit(value.extra_info);
    };
    visit(error);
    const raw = messages.find(Boolean) || error?.message || error || "未知错误";
    let message = String(raw).replace(/\s+/g, " ").trim();
    if (/Failed to convert an input value to a FLOAT value/i.test(message)) {
        message = `数字参数为空或格式不对: ${message}`;
    }
    return message.length > 260 ? `${message.slice(0, 257)}...` : message;
}

function createTagButton(tag, textarea, sync, rerender, isNegative = false, state = null) {
    const prompt = tag.prompt || "";
    const label = tag.local || tag.name || prompt;
    const tagDisplay = state?.settings?.tag_display || "local_first";
    const children = tagDisplay === "compact"
        ? [el("span", { class: "webui-bridge-aio-local" }, label || prompt)]
        : tagDisplay === "prompt_first"
            ? [
                el("span", { class: "webui-bridge-aio-local" }, prompt),
                label && label !== prompt ? el("span", { class: "webui-bridge-aio-en" }, label) : null,
            ]
            : [
                el("span", { class: "webui-bridge-aio-local" }, label || prompt),
                label && label !== prompt ? el("span", { class: "webui-bridge-aio-en" }, prompt) : null,
            ];
    if (tag.favoriteItem && tag.id && state) {
        children.push(el("span", {
            class: "webui-bridge-aio-fav-remove",
            title: "从收藏中移除",
            onclick: async (event) => {
                event.stopPropagation();
                event.preventDefault();
                if (!confirm("只删除这个收藏项？")) return;
                const kind = isNegative ? "negative" : "positive";
                const result = await updatePromptAllInOneStorage("delete_favorite", kind, prompt, "", tag.id);
                await refreshFavoritesFromResult(state, result);
                rerender?.();
            },
        }, "×"));
    }
    const button = el("button", {
        class: "webui-bridge-aio-tag",
        title: [label && label !== prompt ? label : "", tag.name && tag.name !== label ? tag.name : "", prompt].filter(Boolean).join("\n"),
        onclick: async () => {
            await updatePromptAreaWithLoraKeywords(textarea, prompt, isNegative, sync);
            rerender?.();
        },
    }, children);
    button.classList.toggle("selected", promptContains(textarea.value, prompt));
    return button;
}

function createPromptAllInOnePanel(kind, title, textarea, state, sync) {
    const isNegative = kind === "negative";
    const root = el("div", { class: `webui-bridge-aio webui-bridge-aio-${kind}` });
    const header = el("div", { class: "webui-bridge-aio-header" });
    const tabs = el("div", { class: "webui-bridge-aio-tabs" });
    const subTabs = el("div", { class: "webui-bridge-aio-subtabs" });
    const body = el("div", { class: "webui-bridge-aio-body" });
    const hint = el("div", { class: "webui-bridge-aio-hint" }, "");
    const colorRow = el("div", { class: "webui-bridge-aio-color" }, [
        el("span", {}, "标签颜色:"),
        el("span", { class: "webui-bridge-aio-swatch" }),
        el("button", { title: "Reset tag color" }, "↺"),
        el("button", { title: "Clear tag color" }, "⌫"),
    ]);
    const query = el("input", {
        class: "webui-bridge-aio-new",
        placeholder: "在这里输入关键词，按 Enter 或 + 添加",
        title: "输入中文或英文关键词，按 Enter 或右侧 + 添加到当前 Prompt",
    });
    const autoLoad = el("input", { type: "checkbox", checked: "checked", title: "自动加载提示词" });
    const translateStorageKey = `webui-bridge-aio-auto-translate-${kind}`;
    const autoTranslate = el("input", {
        type: "checkbox",
        title: "自动把中文输入翻译为 Anima 英文 tag；未命中本地词库时会保留原文",
    });
    autoTranslate.checked = readLocalBoolean(translateStorageKey, true);
    autoTranslate.addEventListener("change", () => writeLocalBoolean(translateStorageKey, autoTranslate.checked));
    const showInput = el("input", { type: "checkbox", title: "显示默认输入框" });
    const panelHeightKey = `webui-bridge-aio-panel-height-${kind}`;
    root.__webuiBridgeHeightKey = panelHeightKey;
    root.__webuiBridgeMinHeight = kind === "negative" ? AIO_NEGATIVE_MIN_HEIGHT : AIO_POSITIVE_MIN_HEIGHT;
    root.__webuiBridgeMaxHeight = 680;
    applyStoredHeight(root, panelHeightKey, { min: root.__webuiBridgeMinHeight, max: 680 });
    const toggles = el("div", { class: "webui-bridge-aio-toggles" }, [
        autoLoad,
        autoTranslate,
        showInput,
    ]);
    const appendMenu = el("div", { class: "webui-bridge-append-menu" });
    const closeAppendMenu = () => appendMenu.classList.remove("visible");
    const showAppendMenu = () => {
        appendMenu.innerHTML = "";
        const favorites = state.promptAllInOne?.favorites?.[kind] || [];
        const menuItems = [
            {
                label: "↵ 换行符",
                action: () => {
                    const sep = textarea.value.trim() ? "\n" : "";
                    setTextareaValue(textarea, textarea.value + sep);
                    sync();
                    render();
                },
            },
            {
                label: kind === "negative" ? "收藏列表 / 反向词" : "收藏列表 / 文生图",
                disabled: favorites.length === 0,
                action: () => {
                    activeGroup = groups.findIndex((group) => group.type === "favorite");
                    activeSubGroup = 0;
                    if (activeGroup < 0) activeGroup = 0;
                    saveActive();
                    render();
                },
            },
            {
                label: "收藏列表 / 图生图",
                disabled: true,
                action: () => {},
            },
        ];
        for (const item of menuItems) {
            appendMenu.append(el("button", {
                class: item.disabled ? "disabled" : "",
                onmousedown: (event) => {
                    event.preventDefault();
                    if (item.disabled) return;
                    item.action();
                    closeAppendMenu();
                },
            }, item.label));
        }
        appendMenu.classList.add("visible");
    };
    const appendKeyword = async () => {
        const value = query.value.trim();
        if (!value) return;
        const hasCjk = /[\u3400-\u9fff]/.test(value);
        const aiMode = normalizeBridgeSettings(state.settings).translation_source === "ai";
        if (autoTranslate.checked && hasCjk) {
            hint.textContent = aiMode ? "AI 正在翻译关键词..." : "正在翻译关键词...";
            query.classList.add("webui-bridge-input-busy");
            addBtn.disabled = true;
        }
        try {
            const tags = await resolveKeywordInput(value, autoTranslate.checked);
            for (const tag of tags) {
                if (!tag.prompt || tag.prompt === "\n") continue;
                await updatePromptAreaWithLoraKeywords(textarea, tag.prompt, isNegative, sync, (message) => {
                    hint.textContent = message;
                }, { toggle: false });
            }
            hint.textContent = tags.length
                ? `${aiMode && autoTranslate.checked && hasCjk ? "AI " : ""}已加入: ${tags.map((tag) => tag.prompt).join(", ")}`
                : "";
            query.value = "";
            closeAppendMenu();
            sync();
            render();
        } finally {
            query.classList.remove("webui-bridge-input-busy");
            addBtn.disabled = false;
        }
    };
    const addBtn = el("button", {
        class: "webui-bridge-aio-add",
        title: "Append keyword",
        onclick: appendKeyword,
    }, "+");
    const appendRow = el("div", { class: "webui-bridge-aio-append" }, [
        query,
        addBtn,
        appendMenu,
    ]);
    const promptTools = el("div", { class: "webui-bridge-aio-prompt-tools" });
    const toolButton = (text, title, onclick) => el("button", {
        class: "webui-bridge-aio-mini",
        title,
        onclick,
    }, text);
    const showPromptSettings = () => {
        const mask = el("div", { class: "webui-bridge-config-mask" });
        const close = () => mask.remove();
        const autoTranslateSetting = el("input", { type: "checkbox" });
        autoTranslateSetting.checked = autoTranslate.checked;
        autoTranslateSetting.addEventListener("change", () => {
            autoTranslate.checked = autoTranslateSetting.checked;
            writeLocalBoolean(translateStorageKey, autoTranslate.checked);
        });
        mask.addEventListener("mousedown", (event) => {
            if (event.target === mask) close();
        });
        mask.append(el("div", { class: "webui-bridge-config-panel webui-bridge-prompt-settings" }, [
            el("div", { class: "webui-bridge-config-head" }, [
                el("span", {}, `${title}设置`),
                el("button", { type: "button", onclick: close }, "×"),
            ]),
            el("div", { class: "webui-bridge-config-body" }, [
                el("label", { class: "webui-bridge-config-check" }, [
                    autoTranslateSetting,
                    el("span", {}, "回车添加时翻译中文"),
                ]),
                el("div", { class: "webui-bridge-config-note" }, "“未匹配本地关键词组，保留原文”表示本地 Prompt-all-in-one 词库没有这段中文的映射；不是生成错误。可以换成更短的词、点“英”做整段翻译，或在收藏/词库里补充本地关键词。"),
                el("div", { class: "webui-bridge-config-note" }, "Prompt 文本框、已输入 tag 区、收藏/标签列表和 Extra Networks 边界都有细拖拽条；上下拖动会自动分配相邻区域高度，双击恢复默认。"),
                el("div", { class: "webui-bridge-config-note" }, "Negative prompt 右侧可以折叠反向词区域，适合只管理正向提示词时腾出空间。"),
            ]),
            el("div", { class: "webui-bridge-config-actions" }, [
                el("button", { type: "button", class: "primary", onclick: close }, "完成"),
            ]),
        ]));
        document.body.append(mask);
    };
    const translateAll = async () => {
        const value = textarea.value.trim();
        if (!value) return;
        const aiMode = normalizeBridgeSettings(state.settings).translation_source === "ai";
        hint.textContent = aiMode ? "AI 正在翻译整段提示词..." : "正在翻译整段提示词...";
        setPromptTranslateStatus(textarea, hint.textContent, true);
        try {
            const translated = await translatePromptAllInOne(value, "english");
            setTextareaValue(textarea, translated.prompt || value);
            hint.textContent = translated.matched
                ? `${aiMode ? "AI " : ""}已翻译 ${translated.matched} 个关键词`
                : "本地词库未匹配，已保留原文；可在设置里查看说明";
            setPromptTranslateStatus(textarea, hint.textContent, false);
            sync();
            render();
        } catch (error) {
            hint.textContent = "整段翻译失败";
            setPromptTranslateStatus(textarea, hint.textContent, false);
        }
    };
    const copyPrompt = async () => {
        await navigator.clipboard.writeText(textarea.value).catch(() => {});
        hint.textContent = "已复制提示词";
    };
    const saveHistory = async () => {
        if (!textarea.value.trim()) return;
        await updatePromptAllInOneStorage("push_history", kind, textarea.value, "");
        hint.textContent = "已保存到历史记录";
    };
    const loadLatestHistory = async () => {
        const result = await updatePromptAllInOneStorage("latest_history", kind);
        if (!result.item?.prompt) {
            hint.textContent = "没有历史记录";
            return;
        }
        setTextareaValue(textarea, result.item.prompt);
        hint.textContent = "已加载最近历史";
        sync();
        render();
    };
    const saveFavorite = async () => {
        if (!textarea.value.trim()) return;
        const name = prompt("收藏名称", textarea.value.slice(0, 40));
        if (name === null) return;
        const result = await updatePromptAllInOneStorage("push_favorite", kind, textarea.value, name);
        if (result.favorites) state.promptAllInOne.favorites = result.favorites;
        hint.textContent = "已加入收藏";
        render();
    };
    const clearHistory = async () => {
        if (!confirm("Clear prompt history?")) return;
        await updatePromptAllInOneStorage("clear_history", kind);
        hint.textContent = "已清空历史记录";
    };
    promptTools.append(
        toolButton("英", "整段翻译为 Anima 英文 tag", translateAll),
        toolButton("⚙", "提示词管理设置 / 翻译说明", showPromptSettings),
        toolButton("⧉", "复制提示词", copyPrompt),
        toolButton("↥", "保存到历史", saveHistory),
        toolButton("↧", "加载最近历史", loadLatestHistory),
        toolButton("☆", "加入收藏", saveFavorite),
        toolButton("⌫", "清空历史", clearHistory),
    );
    header.append(
        el("div", { class: "webui-bridge-aio-title" }, title),
        el("div", { class: "webui-bridge-aio-actions" }, [promptTools, toggles]),
    );
    root.append(
        header,
        tabs,
        subTabs,
        appendRow,
        body,
        hint,
        colorRow,
        createHeightResizeGrip(root, panelHeightKey, { min: root.__webuiBridgeMinHeight, max: 680, title: "拖动调整收藏/标签列表高度，双击恢复" }),
    );

    let groups = [];
    let activeGroup = 0;
    let activeSubGroup = 0;
    const storageKey = `webui-bridge-aio-${kind}`;
    try {
        const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
        activeGroup = saved.activeGroup || 0;
        activeSubGroup = saved.activeSubGroup || 0;
    } catch {
        // Ignore bad local state.
    }

    const saveActive = () => {
        localStorage.setItem(storageKey, JSON.stringify({ activeGroup, activeSubGroup }));
    };

    const buildGroups = () => {
        const favoriteItems = state.promptAllInOne?.favorites?.[kind] || [];
        const favoriteGroup = {
            name: "收藏列表",
            type: "favorite",
            groups: [{
                name: kind === "negative" ? "反向词" : "提示词",
                tags: favoriteItems.map((item) => ({
                    id: item.id,
                    prompt: item.prompt,
                    local: item.name || item.prompt,
                    favoriteTags: item.tags,
                    favoriteItem: true,
                })),
            }],
        };
        const embeddingItems = state.models?.embeddings || [];
        const extraGroup = {
            name: "扩展模型",
            type: "extraNetworks",
            groups: [
                {
                    name: "Lora",
                    tags: state.loras.map((item) => ({
                        prompt: item.prompt,
                        local: loraDisplayName(item),
                        name: item.name,
                    })),
                },
                {
                    name: "Embedding",
                    tags: embeddingItems.map((name) => {
                        const prompt = stripModelExtension(name).split("/").pop();
                        return {
                            prompt,
                            local: prompt,
                            name,
                        };
                    }).filter((item) => item.prompt),
                },
            ],
        };
        const sourceGroups = (state.promptAllInOne?.group_tags || []).filter((group) => {
            if (kind === "negative") return group.name === "反向提示词";
            return group.name !== "反向提示词";
        });
        groups = [...sourceGroups, favoriteGroup, extraGroup];
        if (kind === "negative" && !root.__webuiBridgeInitializedTabs) {
            const negIndex = groups.findIndex((group) => group.name === "反向提示词");
            if (negIndex >= 0) activeGroup = negIndex;
        }
        activeGroup = Math.min(activeGroup, Math.max(groups.length - 1, 0));
        activeSubGroup = Math.min(activeSubGroup, Math.max((groups[activeGroup]?.groups || []).filter((g) => g.type !== "wrap").length - 1, 0));
        root.__webuiBridgeInitializedTabs = true;
    };

    function renderTabs() {
        tabs.innerHTML = "";
        groups.forEach((group, index) => {
            tabs.append(el("button", {
                class: index === activeGroup ? "active" : "",
                onclick: () => {
                    activeGroup = index;
                    activeSubGroup = 0;
                    saveActive();
                    render();
                },
            }, group.name));
        });
    }

    function renderSubTabs() {
        subTabs.innerHTML = "";
        const cleanSubGroups = (groups[activeGroup]?.groups || []).filter((group) => group.type !== "wrap");
        cleanSubGroups.forEach((group, index) => {
            subTabs.append(el("button", {
                class: index === activeSubGroup ? "active" : "",
                onclick: () => {
                    activeSubGroup = index;
                    saveActive();
                    render();
                },
            }, group.name || "Tags"));
        });
    }

    function renderBody() {
        body.innerHTML = "";
        const cleanSubGroups = (groups[activeGroup]?.groups || []).filter((group) => group.type !== "wrap");
        const subGroup = cleanSubGroups[activeSubGroup];
        if (!subGroup) return;
        const q = query.value.trim().toLowerCase();
        const tags = (subGroup.tags || []).filter((tag) => {
            if (!q) return true;
            return String(tag.prompt || "").toLowerCase().includes(q) || String(tag.local || "").toLowerCase().includes(q);
        });
        if (!tags.length) {
            body.append(el("div", { class: "webui-bridge-aio-empty" }, q ? "没有匹配的标签" : "这个分组目前没有标签"));
            return;
        }
        tags.slice(0, 260).forEach((tag) => body.append(createTagButton(tag, textarea, sync, renderBody, isNegative, state)));
    }

    function render() {
        buildGroups();
        renderTabs();
        renderSubTabs();
        renderBody();
    }

    query.addEventListener("focus", () => {
        if (!query.value.trim()) showAppendMenu();
    });
    query.addEventListener("blur", () => window.setTimeout(closeAppendMenu, 180));
    query.addEventListener("input", () => {
        if (query.value.trim()) closeAppendMenu();
        else showAppendMenu();
        renderBody();
    });
    query.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
            event.stopPropagation();
            event.stopImmediatePropagation();
            closeAppendMenu();
            const hasCjk = /[\u3400-\u9fff]/.test(query.value || "");
            if (!hasCjk && query.__webuiBridgeAutocompletePopup?.classList.contains("visible")) {
                if (query.__webuiBridgePickAutocomplete?.()) {
                    event.preventDefault();
                    return;
                }
            }
            event.preventDefault();
            appendKeyword();
        }
    });
    installAutocomplete(query, {
        limit: 8,
        compact: true,
        popupMinWidth: 220,
        popupMaxWidth: 440,
        popupMaxHeight: 224,
        onPick: async (item) => {
            await updatePromptAreaWithLoraKeywords(textarea, item.text, isNegative, sync, (message) => {
                hint.textContent = message;
            }, { toggle: false });
            query.value = "";
            sync();
            render();
        },
    });
    textarea.addEventListener("input", renderBody);
    render();
    root.__webuiBridgeRender = render;
    return root;
}

function buildPanel(node) {
    const positiveWidget = getWidget(node, "positive_prompt");
    const negativeWidget = getWidget(node, "negative_prompt");
    const clipStrengthWidget = getWidget(node, "default_clip_strength");
    const failOnMissingWidget = getWidget(node, "fail_on_missing_lora");
    const initialClipStrength = repairClipStrengthWidget(node);
    const state = {
        bridgeNode: node,
        activeTextarea: null,
        loras: [],
        styles: [],
        models: { checkpoints: [], unets: [], clips: [], vaes: [], embeddings: [] },
        webuiIntegration: null,
        promptAllInOne: { group_tags: [], favorites: {} },
        settings: normalizeBridgeSettings(),
        customTagCount: 0,
        assets: null,
        selectedStyles: new Set(),
        loraFolder: "__all",
        loraSort: "path",
        loraSortDescending: false,
        loraPage: 0,
        loraPageSize: 0,
        selectedLoras: new Set(),
        loraTreeOpen: new Set(["__all", "group:smart", "group:sd", "group:status", "group:folders"]),
    };
    let clearPromptPlacementWarning = () => {};
    let statusTimer = null;

    const sync = () => {
        setWidgetValue(node, "positive_prompt", positive.textarea.value);
        setWidgetValue(node, "negative_prompt", negative.textarea.value);
        updateCounters();
    };

    const importUpstreamLoras = () => {
        let added = 0;
        const seen = new Set();
        for (const loader of collectUpstreamLoraLoaders(node)) {
            const item = loraPromptFromLoader(loader, state);
            if (!item || seen.has(item.key) || promptHasLora(positive.textarea.value, item.key)) continue;
            seen.add(item.key);
            if (addPromptArea(positive.textarea, item.prompt)) added += 1;
        }
        if (added) {
            setWidgetValue(node, "positive_prompt", positive.textarea.value);
            setStatus(`已自动导入前置 LoRA: ${added} 个`, { kind: "success" });
        }
        return added;
    };

    const onFocus = (textarea) => {
        state.activeTextarea = textarea;
        positive.row.classList.toggle("active", textarea === positive.textarea);
        negative.row.classList.toggle("active", textarea === negative.textarea);
    };

    const scheduleAutoTranslateInput = (textarea) => {
        if (!textarea || textarea.__webuiBridgeAutoTranslating || textarea.__webuiBridgeComposing) return;
        const kind = textarea.__webuiBridgeKind || "positive";
        if (!readLocalBoolean(`webui-bridge-live-auto-translate-${kind}`, false)) return;
        if (!/[\u3400-\u9fff]/.test(textarea.value || "")) return;
        window.clearTimeout(textarea.__webuiBridgeAutoTranslateTimer);
        setPromptTranslateStatus(textarea, "等待翻译...", false);
        textarea.__webuiBridgeAutoTranslateTimer = window.setTimeout(async () => {
            if (textarea.__webuiBridgeComposing || !/[\u3400-\u9fff]/.test(textarea.value || "")) return;
            const before = textarea.value;
            const aiMode = normalizeBridgeSettings(state.settings).translation_source === "ai";
            try {
                textarea.__webuiBridgeAutoTranslating = true;
                setPromptTranslateStatus(textarea, aiMode ? "AI 正在翻译..." : "正在翻译...", true);
                setStatus(aiMode ? "AI 正在翻译提示词..." : "正在自动翻译提示词...");
                const translated = await translatePromptAllInOne(before, "english");
                const next = translated.prompt || before;
                if (translated.matched && next && next !== before) {
                    setTextareaValue(textarea, next);
                    const translatedByAI = aiMode || (translated.tags || []).some((tag) => tag.source === "ai");
                    const message = `${translatedByAI ? "AI " : ""}已自动翻译 ${translated.matched} 个关键词`;
                    setPromptTranslateStatus(textarea, message, false);
                    setStatus(message);
                    sync();
                    positiveTagPanel.__webuiBridgeRender?.();
                    negativeTagPanel.__webuiBridgeRender?.();
                } else {
                    setPromptTranslateStatus(textarea, aiMode ? "AI 已返回，内容未变化" : "已检查，内容未变化", false);
                }
            } catch {
                setPromptTranslateStatus(textarea, "自动翻译失败", false);
                setStatus("自动翻译失败");
            } finally {
                textarea.__webuiBridgeAutoTranslating = false;
            }
        }, 1200);
    };

    const onInput = (textarea) => {
        clearPromptPlacementWarning();
        if (textarea.__webuiBridgeAutoTranslating) {
            sync();
            return;
        }
        setPromptTranslateStatus(textarea, "", false);
        sync();
        scheduleAutoTranslateInput(textarea);
    };

    const positive = createPromptRow(
        "Prompt",
        positiveWidget?.value,
        "Prompt\nCtrl+Up/Down edits attention, Alt+Left/Right moves comma tags",
        onFocus,
        onInput,
        { sizeKey: "webui-bridge-chip-size-positive" },
    );
    positive.textarea.__webuiBridgeKind = "positive";
    const negative = createPromptRow(
        "Negative prompt",
        negativeWidget?.value,
        "Negative prompt",
        onFocus,
        onInput,
        { sizeKey: "webui-bridge-chip-size-negative", collapseKey: "webui-bridge-negative-collapsed", collapsible: true },
    );
    negative.textarea.__webuiBridgeKind = "negative";
    state.activeTextarea = positive.textarea;
    positive.row.classList.add("active");
    for (const textarea of [positive.textarea, negative.textarea]) {
        textarea.addEventListener("compositionstart", () => {
            textarea.__webuiBridgeComposing = true;
            setPromptTranslateStatus(textarea, "", false);
        });
        textarea.addEventListener("compositionend", () => {
            textarea.__webuiBridgeComposing = false;
            scheduleAutoTranslateInput(textarea);
        });
    }

    const positiveTagPanel = createPromptAllInOnePanel("positive", "提示词", positive.textarea, state, sync);
    const negativeTagPanel = createPromptAllInOnePanel("negative", "反向词", negative.textarea, state, sync);
    const renderPromptPanels = () => {
        positiveTagPanel.__webuiBridgeRender?.();
        negativeTagPanel.__webuiBridgeRender?.();
    };
    positive.row.__webuiBridgeRenderPanels = renderPromptPanels;
    negative.row.__webuiBridgeRenderPanels = renderPromptPanels;

    const styleSelect = el("select", { class: "webui-bridge-styles", multiple: "multiple" });
    const styleName = el("input", { class: "webui-bridge-style-name", placeholder: "Style name" });
    const networkSearch = el("input", { class: "webui-bridge-search", placeholder: "Search LoRA / LyCORIS" });
    const networkCount = el("span", { class: "webui-bridge-network-count" }, "0");
    const selectedLoraCount = el("span", { class: "webui-bridge-network-count" }, "选中 0");
    const loraPageSizeSelect = el("select", { class: "webui-bridge-page-size", title: "每页最多显示多少张 LoRA 卡片" }, [
        el("option", { value: "32" }, "32/页"),
        el("option", { value: "48" }, "48/页"),
        el("option", { value: "72" }, "72/页"),
        el("option", { value: "96" }, "96/页"),
        el("option", { value: "0" }, "全部"),
    ]);
    loraPageSizeSelect.value = String(state.loraPageSize);
    const loraPagePrev = el("button", { class: "webui-bridge-network-tool", type: "button", title: "上一页" }, "‹");
    const loraPageInfo = el("span", { class: "webui-bridge-network-count webui-bridge-page-info" }, "1/1");
    const loraPageNext = el("button", { class: "webui-bridge-network-tool", type: "button", title: "下一页" }, "›");
    const networkTree = el("div", { class: "webui-bridge-network-tree" });
    const networkPane = el("div", { class: "webui-bridge-network-pane" });
    const cards = el("div", { class: "webui-bridge-card-grid" });
    const modelSelect = el("select", { class: "webui-bridge-model-select", title: "选择任意整合 checkpoint 模型" });
    const modelModeBadge = el("span", { class: "webui-bridge-model-mode" }, "模型");
    const modelCount = el("span", { class: "webui-bridge-model-count" }, "0");
    const status = el("div", { class: "webui-bridge-status" }, "");
    const clipStrengthInput = el("input", {
        type: "number",
        min: "-10",
        max: "10",
        step: "0.05",
        value: initialClipStrength,
        title: "Default LoRA CLIP strength when tag has no third value",
        oninput: (event) => {
            event.currentTarget.classList.remove("error");
            const value = event.currentTarget.value;
            if (value.trim() === "") {
                setWidgetValue(node, "default_clip_strength", DEFAULT_CLIP_STRENGTH);
                return;
            }
            const numeric = Number(value);
            if (Number.isFinite(numeric)) setWidgetValue(node, "default_clip_strength", numeric);
        },
        onblur: (event) => {
            const repaired = normalizeClipStrength(event.currentTarget.value);
            event.currentTarget.value = repaired;
            setWidgetValue(node, "default_clip_strength", repaired);
        },
    });
    const failOnMissingInput = el("input", {
        type: "checkbox",
        title: "Stop generation when a LoRA tag cannot be found",
        onchange: (event) => setWidgetValue(node, "fail_on_missing_lora", event.currentTarget.checked),
    });
    failOnMissingInput.checked = Boolean(failOnMissingWidget?.value ?? true);

    const setStatus = (message, options = {}) => {
        window.clearTimeout(statusTimer);
        status.textContent = message || "";
        status.classList.toggle("visible", Boolean(message));
        status.classList.toggle("error", options.kind === "error");
        status.classList.toggle("success", options.kind === "success");
        status.classList.remove("has-actions");
        if (message && !options.sticky) {
            statusTimer = window.setTimeout(() => status.classList.remove("visible"), options.duration || 5000);
        }
    };

    const widgetDisplayName = (graphNode, widgetName) => {
        const title = graphNode?.title || graphNode?.type || `Node ${graphNode?.id ?? ""}`;
        const labels = {
            default_clip_strength: "CLIP",
            cfg: "CFG",
            denoise: "Denoise",
            steps: "Steps",
        };
        return `${title} / ${labels[widgetName] || widgetName}`;
    };

    const numericWidgetIsInvalid = (value) => {
        if (value === undefined || value === null) return true;
        if (typeof value === "string" && value.trim() === "") return true;
        return !Number.isFinite(Number(value));
    };

    const validateNumericParameters = () => {
        const invalid = [];
        const repairedClip = repairClipStrengthWidget(node);
        if (numericWidgetIsInvalid(clipStrengthInput.value)) clipStrengthInput.value = repairedClip;
        clipStrengthInput.classList.remove("error");
        if (numericWidgetIsInvalid(clipStrengthInput.value)) {
            invalid.push("Bridge / CLIP");
            clipStrengthInput.classList.add("error");
        }
        const samplerNodes = getGraphNodes().filter((graphNode) => ["KSampler", "KSamplerAdvanced"].includes(graphNode.type));
        for (const samplerNode of samplerNodes) {
            for (const widgetName of ["steps", "cfg", "denoise"]) {
                const widget = getWidget(samplerNode, widgetName);
                if (widget && numericWidgetIsInvalid(widget.value)) invalid.push(widgetDisplayName(samplerNode, widgetName));
            }
        }
        if (!invalid.length) return true;
        setStatus(`这些数字参数为空或格式不对，请先填数字: ${invalid.join("，")}`, { kind: "error", sticky: true });
        return false;
    };

    clearPromptPlacementWarning = () => {
        positive.row.classList.remove("prompt-placement-error");
        negative.row.classList.remove("prompt-placement-error");
        positive.textarea.classList.remove("error");
        negative.textarea.classList.remove("error");
    };

    const repairMisplacedPrompt = () => {
        const misplaced = negative.textarea.value.trim();
        if (!misplaced) return;
        setTextareaValue(positive.textarea, misplaced);
        setTextareaValue(negative.textarea, DEFAULT_NEGATIVE_PROMPT);
        clearPromptPlacementWarning();
        sync();
        renderPromptPanels();
    };

    const showPromptPlacementWarning = () => {
        positive.row.classList.add("prompt-placement-error");
        negative.row.classList.add("prompt-placement-error");
        positive.textarea.classList.add("error");
        negative.textarea.classList.add("error");
        setStatus("正向 Prompt 是空的；人物、角色和 LoRA 被放进了 Negative prompt，所以这次不会提交。", { kind: "error", sticky: true });
        status.classList.add("has-actions");
        status.append(
            el("button", {
                class: "webui-bridge-status-action primary",
                type: "button",
                onclick: async (event) => {
                    event.stopPropagation();
                    repairMisplacedPrompt();
                    await queuePrompt();
                },
            }, "修正并生成"),
            el("button", {
                class: "webui-bridge-status-action",
                type: "button",
                onclick: (event) => {
                    event.stopPropagation();
                    repairMisplacedPrompt();
                    setStatus("已把内容移到 Prompt，并填入默认反向词。", { kind: "success" });
                },
            }, "只修正"),
        );
        positive.textarea.focus();
    };

    const refreshBridgeData = async (options = {}) => {
        const data = await loadBridgeData({ fallbackLoras: state.loras, ...options });
        state.loras = data.loras;
        state.styles = data.styles;
        state.models = data.models;
        state.webuiIntegration = data.webuiIntegration;
        state.promptAllInOne = data.promptAllInOne;
        state.settings = data.settings;
        state.customTagCount = data.customTagCount;
        state.assets = data.assets;
        renderStyles();
        renderModelSwitch();
        renderTree();
        renderCards();
        renderPromptPanels();
        updateCounters();
        return data;
    };

    const webuiStatusText = (info) => {
        const checks = info?.checks || {};
        const ok = Object.values(checks).filter((item) => item?.exists).length;
        const total = Object.keys(checks).length;
        const missing = Object.entries(checks)
            .filter(([, item]) => !item?.exists)
            .map(([key]) => WEBUI_CHECK_LABELS[key] || key);
        const suffix = missing.length ? `，缺少 ${missing.slice(0, 2).join("、")}${missing.length > 2 ? "等" : ""}` : "";
        return info?.webui_root ? `WebUI: ${info.webui_root} (${ok}/${total}${suffix})` : "WebUI: 未接入";
    };

    const showWebUIIntegrationDialog = async () => {
        const mask = el("div", { class: "webui-bridge-config-mask" });
        const statusLine = el("div", { class: "webui-bridge-config-status" }, "正在读取配置...");
        const rootInput = el("input", {
            class: "webui-bridge-config-input",
            placeholder: "例如 H:/sd-webui-aki-v4.9",
            spellcheck: "false",
        });
        const guessSelect = el("select", { class: "webui-bridge-config-input" }, [
            el("option", { value: "" }, "自动检测到的 WebUI 目录"),
        ]);
        let webuiAssetsButton = null;
        const close = () => mask.remove();
        const renderInfo = (info) => {
            state.webuiIntegration = info;
            if (info?.assets) state.assets = info.assets;
            rootInput.value = info?.webui_root || rootInput.value || info?.guesses?.[0] || "";
            guessSelect.innerHTML = "";
            guessSelect.append(el("option", { value: "" }, "自动检测到的 WebUI 目录"));
            for (const guess of info?.guesses || []) guessSelect.append(el("option", { value: guess }, guess));
            const ready = webuiExtensionsReady(info, state.assets);
            statusLine.textContent = ready ? `${webuiStatusText(info)}；配套扩展已存在，直接接入即可` : webuiStatusText(info);
            if (webuiAssetsButton) {
                webuiAssetsButton.disabled = ready;
                webuiAssetsButton.textContent = ready ? "扩展已存在" : "补齐缺失扩展";
                webuiAssetsButton.title = ready ? "Prompt All in One 和 TagComplete 已存在，不需要下载" : "只下载 WebUI 中缺失的配套扩展";
            }
        };
        const connect = async (autoDetect = false) => {
            let root = rootInput.value.trim();
            statusLine.textContent = autoDetect ? "正在自动检测并接入..." : "正在接入 WebUI...";
            try {
                if (autoDetect && !root) {
                    const latest = await fetchWebUIIntegration();
                    renderInfo(latest);
                    root = rootInput.value.trim() || latest?.guesses?.[0] || "";
                    if (!root) {
                        statusLine.textContent = "没有自动检测到 WebUI 目录，请把 WebUI 根目录粘贴到上面的输入框。";
                        return;
                    }
                }
                const info = await connectWebUIRoot(root, autoDetect);
                renderInfo(info);
                const data = await refreshBridgeData({ loraDetail: "basic", loraTimeoutMs: 8000 });
                setStatus(`已接入 WebUI：${info.webui_root}`, { kind: "success" });
                statusLine.textContent = data.lorasLoaded
                    ? `${webuiStatusText(info)}；已刷新提示词、样式、LoRA 和模型列表`
                    : `${webuiStatusText(info)}；已刷新提示词、样式和模型列表，LoRA 扫描较慢，已保留原列表`;
            } catch (error) {
                statusLine.textContent = `接入失败: ${error?.message || error}`;
            }
        };
        const installWebUIAssets = async () => {
            let root = rootInput.value.trim();
            statusLine.textContent = "正在检测 WebUI 配套扩展...";
            try {
                if (!root) {
                    const latest = await fetchWebUIIntegration();
                    renderInfo(latest);
                    root = rootInput.value.trim() || latest?.guesses?.[0] || "";
                }
                if (!root) {
                    statusLine.textContent = "没有 WebUI 根目录；没有 WebUI 的用户请在设置里点“下载本地数据包”。已有 WebUI 和扩展的用户直接接入即可。";
                    return;
                }
                const result = await installBridgeAssets("webui", root);
                if (result.webui_root) rootInput.value = result.webui_root;
                state.settings = normalizeBridgeSettings(result.settings);
                state.customTagCount = result.custom_tag_count || state.customTagCount;
                renderInfo(await fetchWebUIIntegration());
                await refreshBridgeData();
                statusLine.textContent = `${assetInstallMessage(result)}；已存在的扩展不会重复下载`;
                setStatus("WebUI 配套扩展检查完成", { kind: "success" });
            } catch (error) {
                statusLine.textContent = `安装失败: ${error?.message || error}`;
            }
        };
        guessSelect.addEventListener("change", () => {
            if (guessSelect.value) rootInput.value = guessSelect.value;
        });
        mask.append(el("div", { class: "webui-bridge-config-panel" }, [
            el("div", { class: "webui-bridge-config-head" }, [
                el("span", {}, "一键接入 WebUI"),
                el("button", { type: "button", onclick: close }, "×"),
            ]),
            el("div", { class: "webui-bridge-config-body" }, [
                el("label", {}, [
                    el("span", {}, "WebUI 根目录"),
                    rootInput,
                ]),
                guessSelect,
                statusLine,
            ]),
            el("div", { class: "webui-bridge-config-actions" }, [
                el("button", { type: "button", onclick: () => connect(true) }, "自动检测"),
                webuiAssetsButton = el("button", { type: "button", onclick: installWebUIAssets }, "补齐缺失扩展"),
                el("button", { type: "button", class: "primary", onclick: () => connect(false) }, "接入并刷新"),
            ]),
        ]));
        document.body.append(mask);
        try {
            renderInfo(await fetchWebUIIntegration());
        } catch (error) {
            statusLine.textContent = error?.message || "读取配置失败，请粘贴 WebUI 根目录后重试";
        }
        rootInput.focus();
        rootInput.select();
    };

    let quickLoraOverlayButton = null;
    const applyLayoutPreset = (preset) => {
        if (quickLoraOverlayButton) {
            quickLoraOverlayButton.style.display = preset === "minimal_lora" ? "none" : "";
        }
        const collapseNegative = (collapsed) => {
            negative.row.classList.toggle("collapsed", collapsed);
            promptsColumn?.classList?.toggle("negative-collapsed", collapsed);
            applyTopRowCollapsedState(topRow, collapsed);
        };
        const setPanelHeights = ({ top, lora, positiveText, positiveTags } = {}) => {
            requestAnimationFrame(() => {
                if (top === null) {
                    resetResizeTargetHeight(topRow, topRowHeightKey);
                } else if (top !== undefined) {
                    setResizeTargetHeight(topRow, topRowHeightKey, top, { min: 64, max: topRow.__webuiBridgeMaxHeight });
                }
                if (lora === null) {
                    resetResizeTargetHeight(extraSection, extraHeightKey, "1 1 auto");
                    extraSection.style.flex = "1 1 auto";
                } else if (lora !== undefined && !extraCollapsed) {
                    setResizeTargetHeight(extraSection, extraHeightKey, lora, { min: EXTRA_NETWORKS_MIN_HEIGHT, max: extraSection.__webuiBridgeMaxHeight });
                    extraSection.style.flex = "1 1 auto";
                }
                if (positiveText === null) {
                    resetResizeTargetHeight(positive.textarea, positive.textarea.__webuiBridgeHeightKey);
                } else if (positiveText !== undefined) {
                    setResizeTargetHeight(positive.textarea, positive.textarea.__webuiBridgeHeightKey, positiveText, { min: 48, max: positive.textarea.__webuiBridgeMaxHeight });
                }
                if (positiveTags === null) {
                    resetResizeTargetHeight(positiveTagPanel, positiveTagPanel.__webuiBridgeHeightKey);
                } else if (positiveTags !== undefined) {
                    setResizeTargetHeight(positiveTagPanel, positiveTagPanel.__webuiBridgeHeightKey, positiveTags, { min: positiveTagPanel.__webuiBridgeMinHeight, max: positiveTagPanel.__webuiBridgeMaxHeight });
                }
            });
        };
        if (preset === "compact") {
            setNodeSize(920, 760);
            collapseNegative(false);
            extraCollapsed = false;
            writeLocalBoolean(extraCollapsedKey, false);
            applyExtraCollapsedState?.();
            setPanelHeights({ top: 430, lora: 120, positiveText: 88, positiveTags: 180 });
        } else if (preset === "roomy") {
            setNodeSize(1380, 1280);
            collapseNegative(false);
            extraCollapsed = false;
            writeLocalBoolean(extraCollapsedKey, false);
            applyExtraCollapsedState?.();
            setPanelHeights({ top: 620, lora: 420, positiveText: 120, positiveTags: 280 });
        } else if (preset === "positive_focus") {
            setNodeSize(1180, 1040);
            collapseNegative(true);
            extraCollapsed = false;
            writeLocalBoolean(extraCollapsedKey, false);
            applyExtraCollapsedState?.();
            setPanelHeights({ top: 560, lora: 180, positiveText: 170, positiveTags: 340 });
        } else if (preset === "minimal_lora") {
            setNodeSize(940, 680);
            collapseNegative(true);
            extraCollapsed = false;
            writeLocalBoolean(extraCollapsedKey, false);
            applyExtraCollapsedState?.();
            setPanelHeights({ top: 500, lora: 72, positiveText: 150, positiveTags: 260 });
        } else {
            setNodeSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT);
            collapseNegative(false);
            extraCollapsed = false;
            writeLocalBoolean(extraCollapsedKey, false);
            applyExtraCollapsedState?.();
            setPanelHeights({ top: null, lora: null, positiveText: null, positiveTags: null });
        }
    };

    const settingSelect = (value, options) => el("select", { class: "webui-bridge-config-input" }, options.map((item) => (
        el("option", { value: item.value, selected: item.value === value ? "selected" : undefined }, item.label)
    )));

    const promptLibraryKeys = () => {
        const keys = new Set();
        for (const group of state.promptAllInOne?.group_tags || []) {
            const kind = group.name === "反向提示词" ? "negative" : "positive";
            for (const subGroup of group.groups || []) {
                for (const tag of subGroup.tags || []) {
                    const prompt = String(tag.prompt || "").trim().toLowerCase();
                    if (prompt) keys.add(`${kind}:${prompt}`);
                }
            }
        }
        return keys;
    };

    const promptCategoryOptions = () => {
        const groups = new Set(["导入词库", "人物", "服饰", "表情动作", "画面", "环境", "场景", "物品", "反向提示词"]);
        const subgroups = new Set(["提示词", "对象", "头发", "服装", "动作", "质量", "反向词"]);
        for (const group of state.promptAllInOne?.group_tags || []) {
            if (group.name) groups.add(group.name);
            for (const subGroup of group.groups || []) {
                if (subGroup.name) subgroups.add(subGroup.name);
            }
        }
        return {
            groups: [...groups].filter(Boolean).sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
            subgroups: [...subgroups].filter(Boolean).sort((a, b) => a.localeCompare(b, "zh-Hans-CN")),
        };
    };

    const showImportTagsDialog = (options = {}) => {
        const editorMode = options.mode === "editor";
        const mask = el("div", { class: `webui-bridge-config-mask${editorMode ? " webui-bridge-prompt-editor-mask" : ""}` });
        const fileInput = el("input", { type: "file", accept: ".csv,.tsv,.txt,.json,application/json,text/csv,text/plain", style: { display: "none" } });
        const statusLine = el("div", { class: "webui-bridge-config-status" }, `自定义提示词 ${state.customTagCount || 0} 条`);
        const searchInput = el("input", { class: "webui-bridge-config-input", placeholder: "搜索 prompt / 中文名 / 分类" });
        const filterKind = settingSelect("all", [
            { value: "all", label: "全部" },
            { value: "positive", label: "正向" },
            { value: "negative", label: "反向" },
        ]);
        const filterSource = settingSelect("all", [
            { value: "all", label: "全部来源" },
            { value: "custom", label: "自定义/市场" },
            { value: "main", label: "主页面/WebUI" },
        ]);
        const filterGroup = settingSelect("", [{ value: "", label: "全部分组" }]);
        const filterSubgroup = settingSelect("", [{ value: "", label: "全部子分组" }]);
        const promptInput = el("input", { class: "webui-bridge-config-input", placeholder: "英文 tag / prompt" });
        const localInput = el("input", { class: "webui-bridge-config-input", placeholder: "中文名 / 备注" });
        const categories = promptCategoryOptions();
        const groupListId = `webui-bridge-groups-${Math.random().toString(36).slice(2)}`;
        const subgroupListId = `webui-bridge-subgroups-${Math.random().toString(36).slice(2)}`;
        const groupInput = el("input", { class: "webui-bridge-config-input", list: groupListId, placeholder: "分组，例如 人物" });
        const subgroupInput = el("input", { class: "webui-bridge-config-input", list: subgroupListId, placeholder: "子分组，例如 发型" });
        const groupList = el("datalist", { id: groupListId }, categories.groups.map((value) => el("option", { value })));
        const subgroupList = el("datalist", { id: subgroupListId }, categories.subgroups.map((value) => el("option", { value })));
        const kindInput = settingSelect("positive", [
            { value: "positive", label: "正向" },
            { value: "negative", label: "反向" },
        ]);
        const customList = el("div", { class: "webui-bridge-custom-tags" });
        const countLine = el("div", { class: "webui-bridge-config-status" }, "");
        let editingIndex = -1;
        let editingLibraryKey = "";
        let customItems = [];
        const close = () => mask.remove();
        const pickFile = () => fileInput.click();
        const refillFilterOptions = () => {
            const groupValue = filterGroup.value;
            const subgroupValue = filterSubgroup.value;
            const rows = editorRows();
            const groups = [...new Set(rows.map((row) => row.item.group || "导入词库"))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
            const subgroups = [...new Set(rows.map((row) => row.item.subgroup || "提示词"))].sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
            filterGroup.innerHTML = "";
            filterGroup.append(el("option", { value: "" }, "全部分组"));
            groups.forEach((value) => filterGroup.append(el("option", { value, selected: value === groupValue ? "selected" : undefined }, value)));
            filterSubgroup.innerHTML = "";
            filterSubgroup.append(el("option", { value: "" }, "全部子分组"));
            subgroups.forEach((value) => filterSubgroup.append(el("option", { value, selected: value === subgroupValue ? "selected" : undefined }, value)));
        };
        const duplicateKeyFor = (item) => `${item.kind || "positive"}:${String(item.prompt || "").trim().toLowerCase()}`;
        const isDuplicatePrompt = (item) => {
            const key = duplicateKeyFor(item);
            const previous = editingIndex >= 0 ? duplicateKeyFor(customItems[editingIndex] || {}) : "";
            if (key && key === previous) return false;
            if (key && key === editingLibraryKey) return false;
            if (customItems.some((existing, index) => index !== editingIndex && duplicateKeyFor(existing) === key)) return true;
            const libraryKeys = promptLibraryKeys();
            if (previous) libraryKeys.delete(previous);
            if (editingLibraryKey) libraryKeys.delete(editingLibraryKey);
            return libraryKeys.has(key);
        };
        const clearEditor = () => {
            editingIndex = -1;
            editingLibraryKey = "";
            promptInput.value = "";
            localInput.value = "";
            groupInput.value = "";
            subgroupInput.value = "";
            kindInput.value = "positive";
        };
        const mainLibraryRows = () => {
            const rows = [];
            for (const group of state.promptAllInOne?.group_tags || []) {
                if (String(group.tabKey || "").startsWith("customTags")) continue;
                const kind = group.name === "反向提示词" ? "negative" : "positive";
                for (const subGroup of group.groups || []) {
                    if (subGroup.type === "wrap") continue;
                    for (const tag of subGroup.tags || []) {
                        const prompt = String(tag.prompt || "").trim();
                        if (!prompt) continue;
                        rows.push({
                            source: "main",
                            index: -1,
                            item: {
                                prompt,
                                local: String(tag.local || ""),
                                group: group.name || "主页面词库",
                                subgroup: subGroup.name || "提示词",
                                kind,
                            },
                        });
                    }
                }
            }
            return rows;
        };
        const editorRows = () => [
            ...customItems.map((item, index) => ({ source: "custom", index, item })),
            ...mainLibraryRows(),
        ];
        const renderCustomList = () => {
            customList.innerHTML = "";
            const q = searchInput.value.trim().toLowerCase();
            const group = filterGroup.value;
            const subgroup = filterSubgroup.value;
            const kind = filterKind.value;
            const source = filterSource.value;
            const allRows = editorRows();
            const rows = allRows
                .filter((row) => {
                    const { item } = row;
                    if (source !== "all" && row.source !== source) return false;
                    if (kind !== "all" && (item.kind || "positive") !== kind) return false;
                    if (group && (item.group || "导入词库") !== group) return false;
                    if (subgroup && (item.subgroup || "提示词") !== subgroup) return false;
                    if (!q) return true;
                    return [item.prompt, item.local, item.group, item.subgroup, item.kind]
                        .some((value) => String(value || "").toLowerCase().includes(q));
                });
            const mainCount = allRows.filter((row) => row.source === "main").length;
            countLine.textContent = `显示 ${rows.length} / ${allRows.length} 条；自定义 ${customItems.length}，主页面/WebUI ${mainCount}；修改主页面词会保存为自定义覆盖项`;
            rows.forEach(({ item, index, source: rowSource }) => {
                const isMainRow = rowSource === "main";
                customList.append(el("div", { class: "webui-bridge-custom-tag-row" }, [
                    el("span", {}, `${isMainRow ? "主页面" : "自定义"} / ${item.kind === "negative" ? "反向" : "正向"} / ${item.group || "导入词库"} / ${item.subgroup || "提示词"}`),
                    el("b", {}, item.local || item.prompt),
                    el("code", {}, item.prompt),
                    el("button", {
                        type: "button",
                        onclick: () => {
                            editingIndex = isMainRow ? -1 : index;
                            editingLibraryKey = isMainRow ? duplicateKeyFor(item) : "";
                            promptInput.value = item.prompt || "";
                            localInput.value = item.local || "";
                            groupInput.value = item.group || "";
                            subgroupInput.value = item.subgroup || "";
                            kindInput.value = item.kind || "positive";
                            statusLine.textContent = isMainRow ? `正在编辑主页面词库: ${item.prompt}；保存后会作为自定义覆盖项` : `正在编辑: ${item.prompt}`;
                        },
                    }, "改"),
                    el("button", {
                        type: "button",
                        disabled: isMainRow ? "disabled" : undefined,
                        title: isMainRow ? "主页面/WebUI 原始词不能直接删除；可以保存同名自定义项来覆盖显示" : "",
                        onclick: async () => {
                            if (isMainRow) return;
                            await deleteCustomTag(index);
                            clearEditor();
                            await refreshBridgeData();
                            await refreshCustomList();
                            setStatus("提示词已删除", { kind: "success" });
                        },
                    }, isMainRow ? "源" : "删"),
                ]));
            });
        };
        const refreshCustomList = async () => {
            const result = await fetchCustomTags();
            customItems = result.items || [];
            state.customTagCount = result.custom_tag_count || result.total || customItems.length;
            statusLine.textContent = `自定义提示词 ${state.customTagCount || 0} 条`;
            refillFilterOptions();
            renderCustomList();
        };
        const saveManualTag = async () => {
            const item = {
                prompt: promptInput.value.trim(),
                local: localInput.value.trim(),
                group: groupInput.value.trim(),
                subgroup: subgroupInput.value.trim(),
                kind: kindInput.value,
            };
            if (!item.prompt) {
                statusLine.textContent = "请先填写英文 tag / prompt";
                return;
            }
            if (isDuplicatePrompt(item)) {
                statusLine.textContent = "主页面或自定义词库里已经有这个提示词；请换一个 prompt，避免重复显示";
                return;
            }
            const result = await saveCustomTag(editingIndex, item);
            state.customTagCount = result.custom_tag_count || result.total || state.customTagCount;
            await refreshBridgeData();
            await refreshCustomList();
            clearEditor();
            setStatus("提示词已保存并同步到主页面", { kind: "success" });
        };
        const handleFile = async () => {
            const file = fileInput.files?.[0];
            if (!file) return;
            statusLine.textContent = "正在导入...";
            try {
                const items = await parseImportedTagFile(file);
                if (!items.length) {
                    statusLine.textContent = "没有读到可用 tag";
                    return;
                }
                const result = await importBridgeTags(items);
                state.settings = normalizeBridgeSettings(result.settings);
                state.customTagCount = result.custom_tag_count || result.total || state.customTagCount;
                await refreshBridgeData();
                await refreshCustomList();
                statusLine.textContent = `已导入 ${result.imported || 0} 条，当前共 ${state.customTagCount || 0} 条`;
                setStatus("词库已导入", { kind: "success" });
            } catch (error) {
                statusLine.textContent = `导入失败: ${error?.message || error}`;
            } finally {
                fileInput.value = "";
            }
        };
        fileInput.addEventListener("change", handleFile);
        searchInput.addEventListener("input", renderCustomList);
        filterKind.addEventListener("change", renderCustomList);
        filterSource.addEventListener("change", renderCustomList);
        filterGroup.addEventListener("change", renderCustomList);
        filterSubgroup.addEventListener("change", renderCustomList);
        mask.addEventListener("mousedown", (event) => {
            if (event.target === mask) close();
        });
        mask.append(el("div", { class: "webui-bridge-config-panel webui-bridge-prompt-editor-panel" }, [
            el("div", { class: "webui-bridge-config-head" }, [
                el("span", {}, editorMode ? "提示词编辑" : "导入词库"),
                el("button", { type: "button", onclick: close }, "×"),
            ]),
            el("div", { class: "webui-bridge-config-body" }, [
                el("div", { class: "webui-bridge-config-note" }, editorMode
                    ? "这里可以查看自定义/市场词和主页面/WebUI 词库。修改主页面词会保存为自定义覆盖项，避免和原始词重复显示。"
                    : "支持 JSON、CSV、TSV。字段可用 prompt/local/group/subgroup/kind；导入后也可以在这里继续编辑分类。"),
                el("div", { class: "webui-bridge-custom-editor" }, [
                    promptInput,
                    localInput,
                    groupInput,
                    subgroupInput,
                    kindInput,
                    el("button", { type: "button", class: "primary", onclick: saveManualTag }, "保存提示词"),
                    el("button", { type: "button", onclick: clearEditor }, "新建"),
                ]),
                groupList,
                subgroupList,
                el("div", { class: "webui-bridge-custom-filters" }, [
                    searchInput,
                    filterKind,
                    filterSource,
                    filterGroup,
                    filterSubgroup,
                ]),
                statusLine,
                countLine,
                customList,
                fileInput,
            ]),
            el("div", { class: "webui-bridge-config-actions" }, [
                el("button", { type: "button", onclick: close }, "关闭"),
                el("button", { type: "button", class: "primary", onclick: pickFile }, "选择文件"),
            ]),
        ]));
        document.body.append(mask);
        refreshCustomList().catch((error) => {
            statusLine.textContent = `读取自定义标签失败: ${error?.message || error}`;
        });
    };

    const showPromptMarketDialog = () => {
        const mask = el("div", { class: "webui-bridge-config-mask" });
        const sourceList = el("div", { class: "webui-bridge-prompt-market-list" });
        const statusLine = el("div", { class: "webui-bridge-config-status" }, "正在读取提示词市场...");
        const close = () => mask.remove();
        const renderSources = (sources) => {
            sourceList.innerHTML = "";
            for (const source of sources || []) {
                const importLabel = source.importable ? (source.imported ? "重新导入" : "一键导入") : "仅可打开";
                const importButton = el("button", {
                    type: "button",
                    disabled: source.importable ? undefined : "disabled",
                    onclick: async () => {
                        importButton.disabled = true;
                        importButton.textContent = "导入中...";
                        statusLine.textContent = source.imported ? `正在重新导入 ${source.label}...` : `正在下载 ${source.label}...`;
                        try {
                            const result = await importPromptMarketSource(source.id);
                            state.settings = normalizeBridgeSettings(result.settings);
                            state.customTagCount = result.custom_tag_count || result.total || state.customTagCount;
                            await refreshBridgeData();
                            source.imported = true;
                            source.imported_at = result.imported_at || source.imported_at;
                            source.imported_count = result.downloaded || source.imported_count || 0;
                            source.last_added = result.imported || 0;
                            const actionText = source.last_added ? `新增 ${source.last_added} 条` : "没有新增，已补齐可用项";
                            statusLine.textContent = `${result.source?.label || source.label}: 下载 ${result.downloaded || 0} 条，${actionText}，当前共 ${state.customTagCount || 0} 条`;
                            setStatus("提示词市场导入完成", { kind: "success" });
                            importButton.disabled = false;
                            importButton.textContent = "重新导入";
                            metaLine.textContent = marketSourceMeta(source);
                        } catch (error) {
                            statusLine.textContent = `导入失败: ${error?.message || error}`;
                            importButton.disabled = false;
                            importButton.textContent = importLabel;
                        }
                    },
                }, importLabel);
                const openButton = el("button", {
                    type: "button",
                    disabled: source.open_url ? undefined : "disabled",
                    onclick: () => {
                        if (source.open_url) window.open(source.open_url, "_blank", "noopener,noreferrer");
                    },
                }, source.open_url ? "打开" : "本地");
                const marketSourceMeta = (item) => [
                    item.license,
                    item.limit ? `最多 ${item.limit} 条` : "",
                    item.imported ? `已导入 ${item.imported_count || 0} 条` : "",
                    item.imported_at ? `上次 ${String(item.imported_at).replace("T", " ")}` : "",
                ].filter(Boolean).join(" / ");
                const metaLine = el("code", {}, marketSourceMeta(source));
                sourceList.append(el("div", { class: "webui-bridge-prompt-market-source" }, [
                    el("div", { class: "webui-bridge-prompt-market-main" }, [
                        el("b", {}, source.label || source.id),
                        el("span", {}, source.description || ""),
                        metaLine,
                    ]),
                    el("div", { class: "webui-bridge-prompt-market-actions" }, [
                        openButton,
                        importButton,
                    ]),
                ]));
            }
        };
        mask.addEventListener("mousedown", (event) => {
            if (event.target === mask) close();
        });
        mask.append(el("div", { class: "webui-bridge-config-panel webui-bridge-settings-panel" }, [
            el("div", { class: "webui-bridge-config-head" }, [
                el("span", {}, "提示词市场"),
                el("button", { type: "button", onclick: close }, "×"),
            ]),
            el("div", { class: "webui-bridge-config-body" }, [
                el("div", { class: "webui-bridge-config-note" }, "可一键导入的来源会下载公开词库并自动分类；案例网站会在浏览器中打开，适合手动挑选完整 prompt。"),
                sourceList,
                statusLine,
            ]),
            el("div", { class: "webui-bridge-config-actions" }, [
                el("button", { type: "button", onclick: showImportTagsDialog }, "导入本地文件"),
                el("button", { type: "button", class: "primary", onclick: close }, "关闭"),
            ]),
        ]));
        document.body.append(mask);
        fetchPromptMarketSources()
            .then((result) => {
                renderSources(result.sources || []);
                statusLine.textContent = `已加载 ${(result.sources || []).length} 个来源`;
            })
            .catch((error) => {
                statusLine.textContent = `读取失败: ${error?.message || error}`;
            });
    };

    const showAIConfigDialog = async () => {
        const mask = el("div", { class: "webui-bridge-config-mask" });
        const enabledInput = el("input", { type: "checkbox" });
        const baseUrlInput = el("input", { class: "webui-bridge-config-input", placeholder: "https://api.siliconflow.cn/v1" });
        const modelListId = `webui-bridge-ai-models-${Date.now()}`;
        const modelInput = el("input", { class: "webui-bridge-config-input", placeholder: "deepseek-ai/DeepSeek-V4-Flash", list: modelListId });
        const modelDatalist = el("datalist", { id: modelListId });
        const modelList = el("div", { class: "webui-bridge-ai-model-list" });
        const apiKeyInput = el("input", { class: "webui-bridge-config-input", type: "password", placeholder: "留空表示不修改已保存的 API Key" });
        const clearKeyInput = el("input", { type: "checkbox" });
        const systemPromptInput = el("textarea", { class: "webui-bridge-config-input", rows: "5", placeholder: "AI 生成提示词的系统提示" });
        const testPromptInput = el("input", { class: "webui-bridge-config-input", placeholder: "测试输入，例如：花园里的少女" });
        const statusLine = el("div", { class: "webui-bridge-config-status" }, "正在读取 AI 配置...");
        const close = () => mask.remove();
        const fill = (config) => {
            enabledInput.checked = Boolean(config.enabled);
            baseUrlInput.value = config.base_url || "https://api.siliconflow.cn/v1";
            modelInput.value = config.model || "deepseek-ai/DeepSeek-V4-Flash";
            systemPromptInput.value = config.system_prompt || "";
            statusLine.textContent = config.api_key_set ? `API Key: ${config.api_key_preview}` : "API Key 未设置";
        };
        const save = async () => {
            statusLine.textContent = "正在保存 AI 配置...";
            try {
                const result = await saveAIConfig({
                    enabled: enabledInput.checked,
                    base_url: baseUrlInput.value.trim(),
                    model: normalizeAIModelInput(modelInput.value, baseUrlInput.value),
                    api_key: apiKeyInput.value.trim(),
                    clear_api_key: clearKeyInput.checked,
                    system_prompt: systemPromptInput.value.trim(),
                });
                apiKeyInput.value = "";
                clearKeyInput.checked = false;
                fill(result.config || {});
                setStatus("AI 接口配置已保存", { kind: "success" });
            } catch (error) {
                statusLine.textContent = `保存失败: ${error?.message || error}`;
            }
        };
        const renderModels = (models) => {
            modelDatalist.replaceChildren();
            modelList.replaceChildren();
            for (const item of models.slice(0, 120)) {
                const id = item.id || item;
                if (!id) continue;
                modelDatalist.append(el("option", { value: id }));
                const modelButton = el("button", {
                    type: "button",
                    onclick: () => {
                        modelInput.value = id;
                        statusLine.textContent = `已选择模型: ${id}`;
                    },
                    title: item.owned_by ? `owned_by: ${item.owned_by}` : id,
                }, id);
                modelList.append(modelButton);
            }
        };
        const detectModels = async () => {
            statusLine.textContent = "正在检测上游模型...";
            modelList.replaceChildren();
            try {
                const result = await fetchAIModels({
                    base_url: baseUrlInput.value.trim(),
                    api_key: apiKeyInput.value.trim(),
                });
                const models = result.models || [];
                renderModels(models);
                const preferred = models.find((item) => item.id === "deepseek-ai/DeepSeek-V4-Flash")
                    || models.find((item) => /deepseek.*v4.*flash/i.test(item.id || ""))
                    || models.find((item) => /deepseek/i.test(item.id || ""))
                    || models[0];
                if (preferred?.id && !modelInput.value.trim()) {
                    modelInput.value = preferred.id;
                }
                statusLine.textContent = models.length ? `检测到 ${models.length} 个模型，点击下方模型名即可填入` : "没有检测到模型";
            } catch (error) {
                statusLine.textContent = `检测失败: ${error?.message || error}`;
            }
        };
        const test = async () => {
            statusLine.textContent = "正在测试 AI 接口...";
            try {
                await save();
                const result = await testAIConfig(testPromptInput.value.trim() || "花园里的少女");
                statusLine.textContent = `测试成功: ${(result.content || "").slice(0, 180)}`;
            } catch (error) {
                statusLine.textContent = `测试失败: ${error?.message || error}`;
            }
        };
        mask.addEventListener("mousedown", (event) => {
            if (event.target === mask) close();
        });
        mask.append(el("div", { class: "webui-bridge-config-panel webui-bridge-settings-panel" }, [
            el("div", { class: "webui-bridge-config-head" }, [
                el("span", {}, "AI 接口"),
                el("button", { type: "button", onclick: close }, "×"),
            ]),
            el("div", { class: "webui-bridge-config-body" }, [
                el("div", { class: "webui-bridge-config-note" }, "支持 OpenAI 兼容接口。SiliconFlow 可填 base URL https://api.siliconflow.cn/v1，模型 deepseek-ai/DeepSeek-V4-Flash；DeepSeek 官方也可填 https://api.deepseek.com/v1。API Key 只保存在本机 config.local.json。"),
                el("label", { class: "webui-bridge-config-check" }, [enabledInput, el("span", {}, "启用 AI 提示词接口")]),
                el("label", {}, [el("span", {}, "Base URL"), baseUrlInput]),
                el("label", {}, [el("span", {}, "模型"), modelInput, modelDatalist]),
                el("div", { class: "webui-bridge-config-row-actions" }, [
                    el("button", { type: "button", onclick: detectModels }, "检测模型"),
                    el("span", {}, "从上游 /models 读取真实模型 ID"),
                ]),
                modelList,
                el("label", {}, [el("span", {}, "API Key"), apiKeyInput]),
                el("label", { class: "webui-bridge-config-check" }, [clearKeyInput, el("span", {}, "清除已保存 API Key")]),
                el("label", {}, [el("span", {}, "系统提示"), systemPromptInput]),
                el("label", {}, [el("span", {}, "测试输入"), testPromptInput]),
                statusLine,
            ]),
            el("div", { class: "webui-bridge-config-actions" }, [
                el("button", { type: "button", onclick: close }, "关闭"),
                el("button", { type: "button", onclick: detectModels }, "检测模型"),
                el("button", { type: "button", onclick: test }, "保存并测试"),
                el("button", { type: "button", class: "primary", onclick: save }, "保存"),
            ]),
        ]));
        document.body.append(mask);
        try {
            const result = await fetchAIConfig();
            fill(result.config || {});
        } catch (error) {
            statusLine.textContent = `读取失败: ${error?.message || error}`;
        }
    };

    const showBridgeSettingsDialog = () => {
        const mask = el("div", { class: "webui-bridge-config-mask" });
        const current = normalizeBridgeSettings(state.settings);
        const dataSource = settingSelect(current.data_source, [
            { value: "auto", label: "自动" },
            { value: "builtin", label: "内置数据" },
            { value: "webui", label: "WebUI" },
        ]);
        const translationSource = settingSelect(current.translation_source, [
            { value: "auto", label: "自动" },
            { value: "builtin", label: "内置映射" },
            { value: "webui", label: "WebUI 翻译" },
            { value: "online", label: "联网翻译" },
            { value: "ai", label: "AI 翻译" },
        ]);
        const tagTranslationSource = settingSelect(current.tag_translation_source, [
            { value: "auto", label: "自动" },
            { value: "local", label: "只用本地中文" },
            { value: "online", label: "联网补全中文" },
            { value: "off", label: "关闭中文解释" },
        ]);
        const layoutPreset = settingSelect(current.layout_preset, LAYOUT_PRESET_OPTIONS.map(({ value, label }) => ({ value, label })));
        const tagDisplay = settingSelect(current.tag_display, [
            { value: "local_first", label: "中文优先" },
            { value: "prompt_first", label: "英文优先" },
            { value: "compact", label: "紧凑" },
        ]);
        const loraCardSize = settingSelect(current.lora_card_size, [
            { value: "compact", label: "紧凑" },
            { value: "normal", label: "标准" },
            { value: "large", label: "大图" },
        ]);
        const fontSizeInput = el("input", {
            class: "webui-bridge-config-input",
            type: "number",
            min: String(MIN_FONT_SIZE),
            max: String(MAX_FONT_SIZE),
            step: "1",
            oninput: (event) => {
                const value = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Number(event.currentTarget.value || DEFAULT_FONT_SIZE)));
                applyPanelFontSize(panel, value);
            },
        });
        fontSizeInput.value = String(readLocalNumber("webui-bridge-font-size", DEFAULT_FONT_SIZE));
        const wizardToggle = el("input", { type: "checkbox" });
        wizardToggle.checked = current.show_startup_wizard;
        const statusLine = el("div", { class: "webui-bridge-config-status" }, webuiStatusText(state.webuiIntegration));
        const webuiReady = webuiExtensionsReady(state.webuiIntegration, state.assets);
        const installWebUIButton = el("button", {
            type: "button",
            onclick: () => installWebUIAssetsFromSettings(),
            disabled: webuiReady ? "disabled" : undefined,
            title: webuiReady ? "WebUI 配套扩展已存在，不需要下载" : "只补齐 WebUI 中缺失的配套扩展",
        }, webuiReady ? "扩展已存在" : "补齐 WebUI 扩展");
        const close = () => mask.remove();
        const downloadLocalAssets = async () => {
            statusLine.textContent = "正在下载本地数据包...";
            try {
                const result = await installBridgeAssets("local");
                state.settings = normalizeBridgeSettings(result.settings);
                state.customTagCount = result.custom_tag_count || state.customTagCount;
                state.assets = result.assets || state.assets;
                dataSource.value = state.settings.data_source;
                translationSource.value = state.settings.translation_source;
                wizardToggle.checked = state.settings.show_startup_wizard;
                await refreshBridgeData();
                statusLine.textContent = `${assetInstallMessage(result)}；没有 WebUI 也可以直接使用补全和分类`;
                setStatus("本地数据包已就绪", { kind: "success" });
            } catch (error) {
                statusLine.textContent = `下载失败: ${error?.message || error}`;
            }
        };
        const installWebUIAssetsFromSettings = async () => {
            statusLine.textContent = "正在检测 WebUI 扩展...";
            try {
                const result = await installBridgeAssets("webui", state.webuiIntegration?.webui_root || "");
                state.settings = normalizeBridgeSettings(result.settings);
                state.customTagCount = result.custom_tag_count || state.customTagCount;
                state.assets = result.assets || state.assets;
                await refreshBridgeData();
                installWebUIButton.disabled = true;
                installWebUIButton.textContent = "扩展已存在";
                statusLine.textContent = `${assetInstallMessage(result)}；已存在的扩展不会重复下载`;
                setStatus("WebUI 扩展检查完成", { kind: "success" });
            } catch (error) {
                statusLine.textContent = `检查失败: ${error?.message || error}。没有 WebUI 时请点“下载本地数据包”。`;
            }
        };
        const save = async () => {
            statusLine.textContent = "正在保存...";
            try {
                const result = await saveBridgeSettings({
                    data_source: dataSource.value,
                    translation_source: translationSource.value,
                    tag_translation_source: tagTranslationSource.value,
                    layout_preset: layoutPreset.value,
                    tag_display: tagDisplay.value,
                    lora_card_size: loraCardSize.value,
                    show_startup_wizard: wizardToggle.checked,
                });
                state.settings = normalizeBridgeSettings(result.settings);
                state.customTagCount = result.custom_tag_count || state.customTagCount;
                writeLocalNumber("webui-bridge-font-size", Number(fontSizeInput.value || DEFAULT_FONT_SIZE));
                applyPanelFontSize(panel);
                await refreshBridgeData();
                applyLayoutPreset(state.settings.layout_preset);
                setStatus("设置已保存", { kind: "success" });
                close();
            } catch (error) {
                statusLine.textContent = `保存失败: ${error?.message || error}`;
            }
        };
        mask.addEventListener("mousedown", (event) => {
            if (event.target === mask) close();
        });
        mask.append(el("div", { class: "webui-bridge-config-panel webui-bridge-settings-panel" }, [
            el("div", { class: "webui-bridge-config-head" }, [
                el("span", {}, "设置"),
                el("button", { type: "button", onclick: close }, "×"),
            ]),
            el("div", { class: "webui-bridge-config-body" }, [
                el("label", {}, [el("span", {}, "数据来源"), dataSource]),
                el("label", {}, [el("span", {}, "翻译来源"), translationSource]),
                el("label", {}, [el("span", {}, "补全中文解释"), tagTranslationSource]),
                el("label", {}, [el("span", {}, "布局尺寸"), layoutPreset]),
                el("label", {}, [el("span", {}, "Tag 显示"), tagDisplay]),
                el("label", {}, [el("span", {}, "LoRA 卡片"), loraCardSize]),
                el("label", {}, [el("span", {}, "字体大小（默认 12px）"), fontSizeInput]),
                el("label", { class: "webui-bridge-config-check" }, [
                    wizardToggle,
                    el("span", {}, "首次向导"),
                ]),
                el("div", { class: "webui-bridge-config-note" }, "已有 WebUI 和扩展的用户直接接入即可，不需要下载。没有 WebUI 时点“下载本地数据包”，会把 Prompt All in One 和 TagComplete 的词库下载到本节点 data 目录；有 WebUI 但缺扩展时点“补齐 WebUI 扩展”。"),
                statusLine,
            ]),
            el("div", { class: "webui-bridge-config-actions" }, [
                el("button", { type: "button", onclick: showPromptMarketDialog }, "提示词市场"),
                el("button", { type: "button", onclick: () => showImportTagsDialog({ mode: "editor" }) }, "提示词编辑"),
                el("button", { type: "button", onclick: showAIConfigDialog }, "AI 接口"),
                el("button", { type: "button", onclick: showImportTagsDialog }, "导入词库"),
                el("button", { type: "button", onclick: showWebUIIntegrationDialog }, "连接 WebUI"),
                el("button", { type: "button", onclick: downloadLocalAssets }, "下载本地数据包"),
                installWebUIButton,
                el("button", { type: "button", class: "primary", onclick: save }, "保存"),
            ]),
        ]));
        document.body.append(mask);
    };

    const useBuiltinData = async () => {
        const result = await saveBridgeSettings({
            data_source: "builtin",
            translation_source: "builtin",
            show_startup_wizard: false,
        });
        state.settings = normalizeBridgeSettings(result.settings);
        await refreshBridgeData();
        setStatus("已启用内置数据", { kind: "success" });
    };

    const showStartupWizard = () => {
        const mask = el("div", { class: "webui-bridge-config-mask" });
        const close = async (remember = false) => {
            if (remember) {
                await saveBridgeSettings({ show_startup_wizard: false }).catch(() => {});
                state.settings.show_startup_wizard = false;
            }
            mask.remove();
        };
        mask.append(el("div", { class: "webui-bridge-config-panel webui-bridge-startup" }, [
            el("div", { class: "webui-bridge-config-head" }, [
                el("span", {}, "WebUI Prompt Bridge"),
                el("button", { type: "button", onclick: () => close(false) }, "×"),
            ]),
            el("div", { class: "webui-bridge-config-body webui-bridge-startup-actions" }, [
                el("button", {
                    type: "button",
                    onclick: async () => {
                        await close(true);
                        showWebUIIntegrationDialog();
                    },
                }, [el("b", {}, "连接 WebUI"), el("span", {}, "复用本机 WebUI 数据")]),
                el("button", {
                    type: "button",
                    onclick: async () => {
                        await useBuiltinData();
                        await close(true);
                    },
                }, [el("b", {}, "使用内置数据"), el("span", {}, "不依赖 WebUI")]),
                el("button", {
                    type: "button",
                    onclick: async () => {
                        await close(true);
                        showImportTagsDialog();
                    },
                }, [el("b", {}, "导入词库"), el("span", {}, "JSON / CSV / TSV")]),
                el("button", {
                    type: "button",
                    onclick: async () => {
                        await close(true);
                        showPromptMarketDialog();
                    },
                }, [el("b", {}, "提示词市场"), el("span", {}, "免费来源 / 一键导入")]),
            ]),
            el("div", { class: "webui-bridge-config-actions" }, [
                el("button", { type: "button", onclick: () => close(true) }, "不再提示"),
                el("button", {
                    type: "button",
                    class: "primary",
                    onclick: async () => {
                        await close(false);
                        showBridgeSettingsDialog();
                    },
                }, "设置"),
            ]),
        ]));
        document.body.append(mask);
    };

    const maybeShowStartupWizard = () => {
        if (window.__webuiBridgeStartupWizardShown) return;
        if (state.settings?.show_startup_wizard === false) return;
        if (state.webuiIntegration?.webui_root) return;
        window.__webuiBridgeStartupWizardShown = true;
        window.setTimeout(showStartupWizard, 200);
    };

    const renderModelSwitch = () => {
        const checkpoints = collectCheckpointOptions(state.models);
        const current = currentCheckpointName();
        const split = isSplitModelMode();
        const canUseSplit = split !== null || hasSplitAnimaModelSource();
        modelSelect.innerHTML = "";
        if (canUseSplit) {
            modelSelect.append(el("option", { value: SPLIT_ANIMA_MODEL_VALUE }, SPLIT_ANIMA_MODEL_LABEL));
        }
        if (!checkpoints.length && !canUseSplit) {
            modelSelect.append(el("option", { value: "" }, "No model source connected"));
            modelSelect.disabled = true;
        } else {
            for (const checkpoint of checkpoints) {
                modelSelect.append(el("option", { value: checkpoint }, checkpoint));
            }
            modelSelect.disabled = false;
            if (split === true && canUseSplit) modelSelect.value = SPLIT_ANIMA_MODEL_VALUE;
            else if (current && checkpoints.includes(current)) modelSelect.value = current;
        }
        modelModeBadge.textContent = split === null ? "未连接模式开关" : split ? "分体 Anima/Qwen" : "整合 Checkpoint";
        modelModeBadge.classList.toggle("checkpoint", split === false);
        modelCount.textContent = `${checkpoints.length + (canUseSplit ? 1 : 0)} models`;
    };

    const applySelectedModel = () => {
        const result = modelSelect.value === SPLIT_ANIMA_MODEL_VALUE
            ? applySplitModelMode()
            : applyCheckpointModel(modelSelect.value);
        renderModelSwitch();
        setStatus(result.message);
    };

    const updateCounters = () => {
        for (const item of [
            { ...positive, kind: "positive" },
            { ...negative, kind: "negative" },
        ]) {
            const errors = bracketErrors(item.textarea.value);
            const stats = promptStats(item.textarea.value);
            const tokenText = `${stats.tags}/75${stats.loras.length ? ` L${stats.loras.length}` : ""}`;
            item.counter.textContent = errors.length ? errors.join(" ") : tokenText;
            item.counter.classList.toggle("error", errors.length > 0);
            item.textarea.classList.toggle("error", errors.length > 0);
            item.textarea.title = errors.length ? errors.join("\n") : "";
            renderPromptChips(item.row, item.textarea, state, sync, item.kind);
        }
    };

    const renderStyles = () => {
        styleSelect.innerHTML = "";
        for (const style of state.styles) {
            styleSelect.append(el("option", { value: style.name }, style.name));
        }
    };

    const renderTree = () => {
        const tree = buildLoraFolderTree(state.loras);
        networkTree.innerHTML = "";
        const renderNode = (node, depth = 0) => {
            const isRoot = node.path === "__all";
            const open = isRoot || state.loraTreeOpen.has(node.path);
            const selected = state.loraFolder === node.path;
            const children = [...node.children.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
            const row = el("button", {
                class: `webui-bridge-tree-row${selected ? " selected" : ""}`,
                title: isRoot ? "All LoRA" : node.name,
                style: { "--depth": String(depth) },
                onclick: (event) => {
                    const hitChevron = event.target?.classList?.contains("webui-bridge-tree-chevron");
                    if (hitChevron && children.length) {
                        if (state.loraTreeOpen.has(node.path)) state.loraTreeOpen.delete(node.path);
                        else state.loraTreeOpen.add(node.path);
                    } else {
                        state.loraFolder = node.path;
                        state.loraPage = 0;
                    }
                    renderTree();
                    renderCards();
                },
            }, [
                el("span", { class: `webui-bridge-tree-chevron${open ? " open" : ""}` }, children.length ? "›" : ""),
                el("span", { class: "webui-bridge-tree-icon" }, node.icon || (isRoot ? "All" : "Dir")),
                el("span", { class: "webui-bridge-tree-name" }, isRoot ? "全部 LoRA" : node.name),
                el("span", { class: "webui-bridge-tree-count" }, String(node.count)),
            ]);
            networkTree.append(row);
            if (open) {
                for (const child of children) renderNode(child, depth + 1);
            }
        };
        renderNode(tree);
    };

    const loraSelectionKey = (item) => item?.name || item?.alias || item?.base_name || "";
    const selectedLoraItems = () => {
        const selected = state.selectedLoras || new Set();
        return (state.loras || []).filter((item) => selected.has(loraSelectionKey(item)));
    };
    const updateSelectedLoraCount = () => {
        selectedLoraCount.textContent = `选中 ${state.selectedLoras?.size || 0}`;
    };
    const addSelectedLorasToPositive = async () => {
        const items = selectedLoraItems();
        if (!items.length) {
            setStatus("请先勾选 LoRA 卡片", { kind: "error" });
            return;
        }
        let added = 0;
        for (const item of items) {
            const before = positive.textarea.value;
            await updatePromptAreaWithLoraKeywords(positive.textarea, loraPromptText(item), false, sync, setStatus, { toggle: false });
            if (positive.textarea.value !== before) added += 1;
            if (item.negative_text) updatePromptArea(negative.textarea, `(${item.negative_text}:1)`, true);
        }
        sync();
        renderPromptPanels();
        state.selectedLoras.clear();
        updateSelectedLoraCount();
        renderCards();
        setStatus(`已添加 ${added || items.length} 个选中 LoRA 到正向提示词`, { kind: "success" });
    };
    const clearSelectedLoras = () => {
        state.selectedLoras.clear();
        updateSelectedLoraCount();
        renderCards();
        setStatus("已清空 LoRA 选择");
    };
    loraPageSizeSelect.addEventListener("change", (event) => {
        const value = Number(event.currentTarget.value);
        state.loraPageSize = Number.isFinite(value) ? value : 32;
        state.loraPage = 0;
        renderCards();
    });
    loraPagePrev.addEventListener("click", () => {
        state.loraPage = Math.max(0, state.loraPage - 1);
        renderCards();
    });
    loraPageNext.addEventListener("click", () => {
        state.loraPage += 1;
        renderCards();
    });

    const renderCards = () => {
        const q = networkSearch.value.trim().toLowerCase();
        const filter = state.loraFolder || "__all";
        cards.classList.toggle("compact", state.settings?.lora_card_size === "compact");
        cards.classList.toggle("large", state.settings?.lora_card_size === "large");
        const filtered = sortLoras(state.loras.filter((item) => (
            loraMatchesFilter(item, filter) &&
            loraMatchesQuery(item, q)
        )), state.loraSort, state.loraSortDescending);
        const pageSize = Number(state.loraPageSize) || 0;
        const showAll = pageSize <= 0;
        const totalPages = showAll ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
        state.loraPage = showAll ? 0 : Math.min(Math.max(0, Number(state.loraPage) || 0), totalPages - 1);
        const start = state.loraPage * Math.max(1, pageSize);
        const visible = showAll ? filtered : filtered.slice(start, start + pageSize);
        cards.innerHTML = "";
        networkCount.textContent = `${filtered.length} 个 LoRA`;
        loraPageInfo.textContent = showAll ? "全部" : `${state.loraPage + 1}/${totalPages}`;
        loraPagePrev.disabled = showAll || state.loraPage <= 0;
        loraPageNext.disabled = showAll || state.loraPage >= totalPages - 1;
        updateSelectedLoraCount();
        if (!visible.length) {
            cards.append(el("div", { class: "webui-bridge-empty" }, "No LoRA matched"));
            return;
        }
        for (const item of visible) {
            item.prompt = loraPromptText(item);
            const displayName = loraDisplayName(item);
            const folderLabel = loraFolderLabel(item.folder);
            const categoryLabel = loraCategoryForItem(item);
            const categorySource = loraManualCategory(item) ? "手动分类" : "自动分类";
            const selectionKey = loraSelectionKey(item);
            const selected = state.selectedLoras.has(selectionKey);
            const openEditor = (event) => {
                event.preventDefault();
                event.stopPropagation();
                showLoraMetadataDialog(item, {
                    categoryOptions: collectLoraCategoryOptions(state.loras),
                    onSaved: () => {
                        renderCards();
                        renderTree();
                    },
                    onStatus: setStatus,
                });
            };
            const card = el("div", {
                class: `webui-bridge-card${selected ? " selected" : ""}`,
                title: [displayName, item.name !== displayName ? item.name : "", folderLabel && folderLabel !== "Root" ? folderLabel : ""].filter(Boolean).join("\n"),
                role: "button",
                tabindex: "0",
                onclick: async () => {
                    const target = state.activeTextarea || positive.textarea;
                    await updatePromptAreaWithLoraKeywords(target, loraPromptText(item), target === negative.textarea, sync, setStatus);
                    if (item.negative_text) {
                        updatePromptArea(negative.textarea, `(${item.negative_text}:1)`, true);
                        sync();
                    }
                    renderCards();
                },
                onkeydown: (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.currentTarget.click();
                    }
                },
            }, [
                el("label", {
                    class: "webui-bridge-card-select",
                    title: "勾选后可批量添加到正向提示词",
                    onclick: (event) => event.stopPropagation(),
                }, [
                    el("input", {
                        type: "checkbox",
                        checked: selected ? "checked" : undefined,
                        onchange: (event) => {
                            event.stopPropagation();
                            if (event.currentTarget.checked) state.selectedLoras.add(selectionKey);
                            else state.selectedLoras.delete(selectionKey);
                            updateSelectedLoraCount();
                            renderCards();
                        },
                    }),
                    el("span", {}, ""),
                ]),
                item.thumbnail
                    ? el("img", {
                        class: "webui-bridge-card-preview",
                        src: item.thumbnail,
                        alt: "",
                        loading: "lazy",
                        onerror: (event) => event.currentTarget.replaceWith(loraPreviewFallback()),
                    })
                    : loraPreviewFallback(),
                el("span", { class: "webui-bridge-card-buttons" }, [
                    el("button", {
                        type: "button",
                        title: "Copy LoRA path",
                        onclick: async (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            await navigator.clipboard?.writeText(item.name);
                            setStatus("LoRA path copied");
                        },
                    }, "⧉"),
                    el("button", {
                        type: "button",
                        title: "Show LoRA metadata",
                        onclick: openEditor,
                    }, "i"),
                    el("button", {
                        type: "button",
                        title: "Edit LoRA metadata",
                        onclick: openEditor,
                    }, "✎"),
                ]),
                el("span", { class: "webui-bridge-card-actions" }, [
                    el("span", { class: "webui-bridge-card-name" }, displayName),
                    el("span", { class: "webui-bridge-card-category", title: categorySource }, categoryLabel),
                    el("span", { class: "webui-bridge-card-folder", title: item.name }, folderLabel),
                    item.description ? el("span", { class: "webui-bridge-card-desc" }, item.description) : null,
                ]),
            ]);
            cards.append(card);
        }
    };

    const applyStyles = () => {
        const selected = [...styleSelect.selectedOptions].map((option) => option.value);
        for (const name of selected) {
            const style = state.styles.find((x) => x.name === name);
            if (!style) continue;
            positive.textarea.value = applyStyleText(positive.textarea.value, style.prompt);
            negative.textarea.value = applyStyleText(negative.textarea.value, style.negative_prompt);
        }
        styleSelect.selectedIndex = -1;
        sync();
    };

    const saveStyle = async () => {
        const name = styleName.value.trim() || styleSelect.selectedOptions[0]?.value || "";
        if (!name) {
            setStatus("Style name is required");
            return;
        }
        state.styles = await updateStyle("save", name, positive.textarea.value, negative.textarea.value);
        renderStyles();
        styleName.value = name;
        setStatus(`Saved style: ${name}`);
    };

    const deleteStyle = async () => {
        const name = styleName.value.trim() || styleSelect.selectedOptions[0]?.value || "";
        if (!name) {
            setStatus("Select a style to delete");
            return;
        }
        if (!confirm(`Delete style "${name}"?`)) return;
        state.styles = await updateStyle("delete", name);
        renderStyles();
        styleName.value = "";
        setStatus(`Deleted style: ${name}`);
    };

    const pasteParams = async () => {
        const text = await navigator.clipboard.readText().catch(() => "");
        if (!text) {
            setStatus("Clipboard is empty or blocked");
            return;
        }
        const parameters = await parseInfotext(text);
        if (parameters.Prompt) positive.textarea.value = parameters.Prompt;
        if (parameters["Negative prompt"] !== undefined) negative.textarea.value = parameters["Negative prompt"];
        if (!parameters.Prompt && !parameters["Negative prompt"]) positive.textarea.value = text.trim();
        const changed = applyGenerationParameters(parameters);
        sync();
        setStatus(changed.length ? `Pasted prompt and ${changed.join(", ")}` : "Pasted prompt");
    };

    const clearPrompts = () => {
        if (!confirm("Delete prompt?")) return;
        positive.textarea.value = "";
        negative.textarea.value = "";
        sync();
    };

    const swapPrompts = () => {
        const value = positive.textarea.value;
        positive.textarea.value = negative.textarea.value;
        negative.textarea.value = value;
        sync();
    };

    const completePrompt = async () => {
        await completePromptForGeneration(positive.textarea, negative.textarea, sync, setStatus);
        positiveTagPanel.__webuiBridgeRender?.();
        negativeTagPanel.__webuiBridgeRender?.();
    };

    const applyFastMode = () => {
        ensureAnimaFastLoras(positive.textarea, state);
        if (!negative.textarea.value.trim()) setTextareaValue(negative.textarea, DEFAULT_NEGATIVE_PROMPT);
        const changed = applySamplerPreset({
            steps: 16,
            cfg: 1.5,
            sampler_name: "euler",
            scheduler: "simple",
            denoise: 1,
        });
        sync();
        renderPromptPanels();
        setStatus(changed.length
            ? "已切换极速模式: 仅加入加速 LoRA + 16 steps / CFG 1.5"
            : "已加入加速 LoRA；没找到 KSampler，采样参数未改");
    };

    const applyPureQualityMode = () => {
        setTextareaValue(positive.textarea, removeAnimaFastLoras(positive.textarea.value));
        if (!negative.textarea.value.trim()) setTextareaValue(negative.textarea, DEFAULT_NEGATIVE_PROMPT);
        const changed = applySamplerPreset({
            steps: 34,
            cfg: 3.5,
            sampler_name: "euler",
            scheduler: "simple",
            denoise: 1,
        });
        sync();
        renderPromptPanels();
        setStatus(changed.length
            ? "已切换纯模型质量模式: 仅移除加速 LoRA + 34 steps / CFG 3.5"
            : "已移除加速 LoRA；没找到 KSampler，采样参数未改");
    };

    const queuePrompt = async () => {
        sync();
        if (!validateNumericParameters()) return;
        const positiveText = positive.textarea.value.trim();
        const negativeText = negative.textarea.value.trim();
        if (
            (promptHasAnyLora(positiveText) || promptHasAnyLora(negativeText)) &&
            !bridgeModelOutputConnected(node) &&
            !collectUpstreamLoraLoaders(node).length
        ) {
            setStatus("LoRA 已匹配到文件，但本节点 model 输出没有接到采样器模型链路；这次 LoRA 不会影响出图。请先接 model 输出，或使用前置 LoRA Loader。", { kind: "error", sticky: true });
            renderPromptPanels();
            return;
        }
        if (!positiveText && looksLikeMisplacedPositivePrompt(negativeText)) {
            showPromptPlacementWarning();
            return;
        }
        try {
            setStatus("正在提交生成任务...");
            const preflightRepairs = repairStaleInputLinks();
            if (preflightRepairs) setStatus(`已修复 ${preflightRepairs} 个悬空参数连接，正在提交...`);
            setStatus(await submitComfyQueue(), { kind: "success" });
        } catch (error) {
            const repaired = repairQueueParentLinkError(error);
            if (repaired) {
                try {
                    setStatus("已修复尺寸/参数的悬空连接，正在重试提交...");
                    setStatus(await submitComfyQueue(), { kind: "success" });
                    return;
                } catch (retryError) {
                    console.error("[WebUIPromptBridge] Queue retry failed", retryError);
                    setStatus(`重试后仍提交失败: ${queueErrorMessage(retryError)}`, { kind: "error", sticky: true });
                    return;
                }
            }
            console.error("[WebUIPromptBridge] Queue failed", error);
            setStatus(`生成提交失败: ${queueErrorMessage(error)}`, { kind: "error", sticky: true });
        }
    };

    const setNodeSize = (width, height) => {
        const [nextWidth, nextHeight] = clampPanelSize(width, height);
        node.__webuiBridgeDesiredSize = [nextWidth, nextHeight];
        node.setSize([nextWidth, nextHeight]);
        app.graph?.setDirtyCanvas(true, true);
    };

    const resizeNode = (deltaWidth, deltaHeight) => {
        setNodeSize((node.size?.[0] || DEFAULT_PANEL_WIDTH) + deltaWidth, (node.size?.[1] || DEFAULT_PANEL_HEIGHT) + deltaHeight);
    };

    const installResizeDrag = (handle) => {
        handle.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            event.stopPropagation();
            handle.setPointerCapture?.(event.pointerId);
            const startX = event.clientX;
            const startY = event.clientY;
            const startWidth = node.size?.[0] || DEFAULT_PANEL_WIDTH;
            const startHeight = node.size?.[1] || DEFAULT_PANEL_HEIGHT;
            const onMove = (moveEvent) => {
                setNodeSize(startWidth + (moveEvent.clientX - startX), startHeight + (moveEvent.clientY - startY));
            };
            const onUp = () => {
                document.removeEventListener("pointermove", onMove, true);
                document.removeEventListener("pointerup", onUp, true);
                document.removeEventListener("pointercancel", onUp, true);
            };
            document.addEventListener("pointermove", onMove, true);
            document.addEventListener("pointerup", onUp, true);
            document.addEventListener("pointercancel", onUp, true);
        });
    };

    const openLargeEditor = () => {
        const mask = el("div", { class: "webui-bridge-mask" });
        const pos = createPromptRow("Prompt", positive.textarea.value, "Prompt", () => {}, () => {});
        const neg = createPromptRow("Negative prompt", negative.textarea.value, "Negative prompt", () => {}, () => {});
        const panel = el("div", { class: "webui-bridge-large" }, [
            el("div", { class: "webui-bridge-large-title" }, "WebUI Prompt Editor"),
            pos.row,
            neg.row,
            el("div", { class: "webui-bridge-large-actions" }, [
                el("button", { onclick: () => mask.remove() }, "Cancel"),
                el("button", {
                    class: "primary",
                    onclick: () => {
                        positive.textarea.value = pos.textarea.value;
                        negative.textarea.value = neg.textarea.value;
                        sync();
                        mask.remove();
                    },
                }, "Apply"),
            ]),
        ]);
        for (const textarea of [pos.textarea, neg.textarea]) installPromptKeys(textarea, () => {});
        mask.append(panel);
        document.body.append(mask);
        pos.textarea.focus();
    };

    const toolbar = el("div", { class: "webui-bridge-tools" }, [
        createToolButton("↙", "Read generation parameters from clipboard", pasteParams),
        createToolButton("🗑", "Clear prompt", clearPrompts),
        createToolButton("⇅", "Switch prompt and negative prompt", swapPrompts),
        createToolButton("补", "补全质量词、LoRA触发词和推荐负面词", completePrompt),
        createToolButton("⛶", "Open large editor", openLargeEditor),
    ]);

    const animaModeControls = el("div", { class: "webui-bridge-mode-controls" }, [
        el("button", {
            class: "fast",
            title: "使用 Anima 加速/质量 LoRA，并切到低步数低 CFG 参数",
            onclick: applyFastMode,
        }, "极速模式"),
        el("button", {
            class: "quality",
            title: "移除加速/质量 LoRA，并切到纯 Anima 更稳的高步数参数",
            onclick: applyPureQualityMode,
        }, "纯模型质量"),
    ]);

    const modelSwitchControls = el("div", { class: "webui-bridge-model-switch" }, [
        el("div", { class: "webui-bridge-model-head" }, [
            el("span", { class: "webui-bridge-model-title" }, "模型切换"),
            modelModeBadge,
        ]),
        modelSelect,
        el("div", { class: "webui-bridge-model-actions" }, [
            el("button", {
                type: "button",
                title: "应用当前下拉选择；选择 Anima 分体项会切回分体模型，选择 checkpoint 会切到整合模型",
                onclick: applySelectedModel,
            }, "应用选择"),
            el("button", {
                type: "button",
                title: "切回默认 Anima/Qwen 分体模型",
                onclick: () => {
                    const result = applySplitModelMode();
                    renderModelSwitch();
                    setStatus(result.message);
                },
            }, "分体模型"),
            modelCount,
        ]),
    ]);

    const sizeControls = el("div", { class: "webui-bridge-size-controls" }, [
        el("button", { title: "Compact size", onclick: () => setNodeSize(840, 620) }, "S"),
        el("button", { title: "Smaller node", onclick: () => resizeNode(-120, -90) }, "-"),
        el("button", { title: "Larger node", onclick: () => resizeNode(120, 90) }, "+"),
        el("button", { title: "恢复节点默认尺寸", onclick: () => setNodeSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT) }, "默认尺寸"),
    ]);
    let layoutPresetControls = null;
    const updateLayoutPresetControls = () => {
        const active = state.settings?.layout_preset || "default";
        for (const button of layoutPresetControls?.querySelectorAll?.(".webui-bridge-layout-preset") || []) {
            button.classList.toggle("active", button.dataset.preset === active);
        }
    };
    const applyAndSaveLayoutPreset = async (preset) => {
        const nextSettings = { ...normalizeBridgeSettings(state.settings), layout_preset: preset };
        state.settings = nextSettings;
        updateLayoutPresetControls();
        applyLayoutPreset(preset);
        try {
            const result = await saveBridgeSettings(nextSettings);
            state.settings = normalizeBridgeSettings(result.settings);
            state.customTagCount = result.custom_tag_count || state.customTagCount;
            updateLayoutPresetControls();
            setStatus(`已切换布局: ${LAYOUT_PRESET_OPTIONS.find((item) => item.value === preset)?.label || preset}`, { kind: "success" });
        } catch (error) {
            setStatus(`布局保存失败: ${error?.message || error}`, { kind: "error" });
        }
    };
    layoutPresetControls = el("div", { class: "webui-bridge-layout-presets" }, LAYOUT_PRESET_OPTIONS.map((item) => el("button", {
        class: `webui-bridge-layout-preset${state.settings?.layout_preset === item.value ? " active" : ""}`,
        type: "button",
        title: item.title,
        "data-preset": item.value,
        onclick: () => applyAndSaveLayoutPreset(item.value),
    }, item.short)));
    const makeNetworkSortButton = (key, label, title) => el("button", {
        class: `webui-bridge-network-tool${state.loraSort === key ? " active" : ""}`,
        title,
        onclick: (event) => {
            state.loraSort = key;
            state.loraPage = 0;
            for (const button of event.currentTarget.parentElement.querySelectorAll(".webui-bridge-network-tool[data-sort]")) {
                button.classList.toggle("active", button.dataset.sort === key);
            }
            renderCards();
        },
        "data-sort": key,
    }, label);
    const networkControls = el("div", { class: "webui-bridge-network-controls" }, [
        networkSearch,
        el("button", {
            class: "webui-bridge-network-tool webui-bridge-network-primary",
            title: "把勾选的 LoRA 添加到正向提示词",
            onclick: addSelectedLorasToPositive,
        }, "添加选中到正向"),
        el("button", {
            class: "webui-bridge-network-tool",
            title: "清空已勾选的 LoRA",
            onclick: clearSelectedLoras,
        }, "清空选择"),
        selectedLoraCount,
        loraPageSizeSelect,
        loraPagePrev,
        loraPageInfo,
        loraPageNext,
        el("span", { class: "webui-bridge-network-sort-label" }, "Sort"),
        makeNetworkSortButton("path", "Path", "Sort by folder path"),
        makeNetworkSortButton("name", "Name", "Sort by LoRA name"),
        makeNetworkSortButton("modified", "Date", "Sort by modified time"),
        el("button", {
            class: "webui-bridge-network-tool",
            title: "Reverse sort direction",
            onclick: (event) => {
                state.loraSortDescending = !state.loraSortDescending;
                state.loraPage = 0;
                event.currentTarget.classList.toggle("active", state.loraSortDescending);
                renderCards();
            },
        }, "↓"),
        networkCount,
    ]);
    const resizeGrip = el("div", { class: "webui-bridge-resize-grip", title: "Drag to resize this node" }, "↘");
    installResizeDrag(resizeGrip);

    const promptRowBottomTarget = (row) => row.__webuiBridgeBottomResizeTarget?.() || row;
    const promptRowBottomKey = (row) => row.__webuiBridgeBottomResizeKey?.() || row.__webuiBridgeHeightKey || "";
    const promptsColumn = el("div", { class: "webui-bridge-prompts" }, [
        positive.row,
        createHeightSplitGrip(
            () => promptRowBottomTarget(positive.row),
            positiveTagPanel,
            () => promptRowBottomKey(positive.row),
            () => positiveTagPanel.__webuiBridgeHeightKey,
            {
                beforeMin: () => promptRowBottomTarget(positive.row).__webuiBridgeMinHeight || 48,
                beforeMax: () => promptRowBottomTarget(positive.row).__webuiBridgeMaxHeight || 520,
                afterMin: () => positiveTagPanel.__webuiBridgeMinHeight,
                afterMax: () => positiveTagPanel.__webuiBridgeMaxHeight,
                title: "上下拖动分配提示词区和标签列表高度，双击恢复",
            },
        ),
        positiveTagPanel,
        createHeightSplitGrip(
            positiveTagPanel,
            negative.textarea,
            () => positiveTagPanel.__webuiBridgeHeightKey,
            () => negative.textarea.__webuiBridgeHeightKey,
            {
                className: "webui-bridge-negative-main-resizer",
                beforeMin: () => positiveTagPanel.__webuiBridgeMinHeight,
                beforeMax: () => positiveTagPanel.__webuiBridgeMaxHeight,
                afterMin: () => negative.textarea.__webuiBridgeMinHeight,
                afterMax: () => negative.textarea.__webuiBridgeMaxHeight,
                title: "上下拖动分配标签列表和反向词文本框高度，双击恢复",
            },
        ),
        negative.row,
        createHeightSplitGrip(
            () => promptRowBottomTarget(negative.row),
            negativeTagPanel,
            () => promptRowBottomKey(negative.row),
            () => negativeTagPanel.__webuiBridgeHeightKey,
            {
                className: "webui-bridge-negative-detail-resizer",
                beforeMin: () => promptRowBottomTarget(negative.row).__webuiBridgeMinHeight || 48,
                beforeMax: () => promptRowBottomTarget(negative.row).__webuiBridgeMaxHeight || 520,
                afterMin: () => negativeTagPanel.__webuiBridgeMinHeight,
                afterMax: () => negativeTagPanel.__webuiBridgeMaxHeight,
                title: "上下拖动分配反向词区和反向标签列表高度，双击恢复",
            },
        ),
        negativeTagPanel,
    ]);
    positive.row.classList.add("webui-bridge-positive-prompt-row");
    promptsColumn.classList.toggle("negative-collapsed", negative.row.classList.contains("collapsed"));
    const topRowHeightKey = "webui-bridge-toprow-height";
    const extraHeightKey = "webui-bridge-extra-height";
    const extraCollapsedKey = "webui-bridge-extra-collapsed";
    migrateLayoutStorage([topRowHeightKey, extraHeightKey]);
    let extraCollapsed = readLocalBoolean(extraCollapsedKey, false);
    let loraOverlayOpen = false;
    const extraBody = el("div", { class: "webui-bridge-extra-body" }, [
        networkTree,
        networkPane,
    ]);
    const ensureUsableExtraHeight = () => {
        if (extraCollapsed || loraOverlayOpen) return;
        const height = extraSection?.getBoundingClientRect?.().height || 0;
        if (height < EXTRA_NETWORKS_MIN_HEIGHT) {
            setResizeTargetHeight(extraSection, extraHeightKey, EXTRA_NETWORKS_MIN_HEIGHT, {
                min: EXTRA_NETWORKS_MIN_HEIGHT,
                max: extraSection.__webuiBridgeMaxHeight || EXTRA_NETWORKS_MAX_HEIGHT,
            });
            extraSection.style.flex = "1 1 auto";
        }
    };
    const extraToggle = el("button", {
        class: "webui-bridge-network-tool",
        type: "button",
        title: "折叠/展开 LoRA 卡片区域",
        onclick: () => {
            extraCollapsed = !extraCollapsed;
            writeLocalBoolean(extraCollapsedKey, extraCollapsed);
            applyExtraCollapsedState();
        },
    }, extraCollapsed ? "显示 LoRA" : "隐藏 LoRA");
    networkControls.prepend(extraToggle);
    const openLoraOverlay = () => {
        loraOverlayOpen = true;
        extraCollapsed = false;
        writeLocalBoolean(extraCollapsedKey, false);
        panel?.classList?.add("lora-overlay");
        extraSection?.classList?.remove("collapsed");
        extraBody.style.display = "";
        extraToggle.textContent = "隐藏 LoRA";
        clearLocalValue(extraHeightKey);
        extraSection.style.height = "";
        extraSection.style.flex = "";
    };
    const closeLoraOverlay = () => {
        loraOverlayOpen = false;
        panel?.classList?.remove("lora-overlay");
    };
    const overlayClose = el("button", {
        class: "webui-bridge-network-tool webui-bridge-lora-overlay-close",
        type: "button",
        title: "关闭 LoRA 浮层",
        onclick: closeLoraOverlay,
    }, "× 关闭快速添加");
    networkControls.prepend(overlayClose);
    const extraSection = el("div", { class: "webui-bridge-extra webui-bridge-extra-compact" }, [
        el("div", { class: "webui-bridge-extra-head" }, [
            el("span", {}, "Extra Networks"),
            networkControls,
        ]),
        extraBody,
    ]);
    extraSection.__webuiBridgeHeightKey = extraHeightKey;
    extraSection.__webuiBridgeMinHeight = EXTRA_NETWORKS_MIN_HEIGHT;
    extraSection.__webuiBridgeMaxHeight = EXTRA_NETWORKS_MAX_HEIGHT;
    function applyExtraCollapsedState() {
        extraSection.classList.toggle("collapsed", extraCollapsed);
        extraBody.style.display = extraCollapsed ? "none" : "";
        extraToggle.textContent = extraCollapsed ? "显示 LoRA" : "隐藏 LoRA";
        if (extraCollapsed) {
            extraSection.style.height = "42px";
            extraSection.style.minHeight = "42px";
            extraSection.style.maxHeight = "42px";
            extraSection.style.flex = "0 0 42px";
            return;
        }
        extraSection.style.height = "";
        extraSection.style.minHeight = "";
        extraSection.style.maxHeight = "";
        extraSection.style.flex = "1 1 auto";
        applyStoredHeight(extraSection, extraHeightKey, { min: EXTRA_NETWORKS_MIN_HEIGHT, max: extraSection.__webuiBridgeMaxHeight });
        extraSection.style.flex = "1 1 auto";
        requestAnimationFrame(ensureUsableExtraHeight);
    }
    applyExtraCollapsedState();

    const topRow = el("div", { class: "webui-bridge-toprow" }, [
        promptsColumn,
        el("div", { class: "webui-bridge-action-column" }, [
            el("button", { class: "webui-bridge-generate", title: "Queue Prompt", onclick: queuePrompt }, "Generate"),
            status,
            modelSwitchControls,
            animaModeControls,
            sizeControls,
            layoutPresetControls,
            toolbar,
            el("div", { class: "webui-bridge-backend-settings" }, [
                el("button", {
                    class: "webui-bridge-config-button",
                    type: "button",
                    title: "只填写 WebUI 根目录，自动接入 Prompt All in One、TagComplete、styles、LoRA 和模型目录",
                    onclick: showWebUIIntegrationDialog,
                }, "一键接入 WebUI"),
                quickLoraOverlayButton = el("button", {
                    class: "webui-bridge-config-button",
                    type: "button",
                    title: "打开 LoRA / LyCORIS 浮层，添加完成后可关闭让节点更紧凑",
                    onclick: openLoraOverlay,
                }, "快速添加 LoRA"),
                el("button", {
                    class: "webui-bridge-config-button",
                    type: "button",
                    title: "设置数据来源、翻译、布局、Tag 和 LoRA 卡片显示",
                    onclick: showBridgeSettingsDialog,
                }, "设置"),
                el("label", {}, [
                    el("span", {}, "CLIP"),
                    clipStrengthInput,
                ]),
                el("label", {}, [
                    failOnMissingInput,
                    el("span", {}, "Missing LoRA stops"),
                ]),
            ]),
            el("div", { class: "webui-bridge-style-row" }, [
                styleSelect,
                el("div", { class: "webui-bridge-style-edit" }, [
                    styleName,
                    createToolButton("+", "Save current prompts as style", saveStyle),
                    createToolButton("-", "Delete selected style", deleteStyle),
                ]),
            ]),
        ]),
    ]);
    topRow.__webuiBridgeHeightKey = topRowHeightKey;
    topRow.__webuiBridgeMinHeight = 220;
    topRow.__webuiBridgeMaxHeight = 100000;
    applyStoredHeight(topRow, topRowHeightKey, { min: topRow.__webuiBridgeMinHeight, max: topRow.__webuiBridgeMaxHeight });
    applyTopRowCollapsedState(topRow, negative.row.classList.contains("collapsed"));

    const panel = el("div", { class: "webui-bridge-panel" }, [
        topRow,
        createHeightSplitGrip(topRow, extraSection, () => topRow.classList.contains("negative-collapsed") ? "" : topRowHeightKey, extraHeightKey, {
            className: "webui-bridge-panel-splitter",
            beforeMin: () => topRow.classList.contains("negative-collapsed") ? 64 : topRow.__webuiBridgeMinHeight,
            beforeMax: topRow.__webuiBridgeMaxHeight,
            afterMin: EXTRA_NETWORKS_MIN_HEIGHT,
            afterMax: EXTRA_NETWORKS_MAX_HEIGHT,
            afterFlex: "1 1 auto",
            title: "上下拖动分配提示词区域和 Extra Networks 高度，双击恢复",
        }),
        extraSection,
        resizeGrip,
    ]);
    applyPanelFontSize(panel);
    networkPane.append(cards);

    function installPromptKeys(textarea, after) {
        textarea.addEventListener("keydown", (event) => {
            if ((event.ctrlKey || event.metaKey) && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
                if (editAttention(textarea, event.key === "ArrowUp")) {
                    event.preventDefault();
                    sync();
                    after?.();
                }
            } else if (event.altKey && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
                if (movePromptTag(textarea, event.key === "ArrowLeft")) {
                    event.preventDefault();
                    sync();
                    after?.();
                }
            }
        });
    }

    installPromptKeys(positive.textarea);
    installPromptKeys(negative.textarea);
    for (const item of [positive, negative]) {
        installAutocomplete(item.textarea, {
            limit: 8,
            showOnFocus: false,
            getQuery: () => promptTokenAtCursor(item.textarea).value,
            onPick: (suggestion) => {
                replacePromptToken(item.textarea, suggestion);
                sync();
            },
        });
    }
    networkSearch.addEventListener("input", () => {
        ensureUsableExtraHeight();
        state.loraPage = 0;
        renderCards();
    });
    modelSelect.addEventListener("change", applySelectedModel);
    styleSelect.addEventListener("change", () => {
        styleName.value = styleSelect.selectedOptions[0]?.value || "";
    });

    loadBridgeData().then((data) => {
        state.loras = data.loras;
        state.styles = data.styles;
        state.models = data.models;
        state.promptAllInOne = data.promptAllInOne;
        state.settings = data.settings;
        state.customTagCount = data.customTagCount;
        state.assets = data.assets;
        renderStyles();
        renderModelSwitch();
        renderTree();
        renderCards();
        importUpstreamLoras();
        updateCounters();
        updateLayoutPresetControls();
        positiveTagPanel.__webuiBridgeRender?.();
        negativeTagPanel.__webuiBridgeRender?.();
        maybeShowStartupWizard();
    });

    renderModelSwitch();
    importUpstreamLoras();
    updateCounters();
    panel.__webuiBridgeImportUpstreamLoras = () => {
        const added = importUpstreamLoras();
        if (added) updateCounters();
        renderPromptPanels();
    };
    return panel;
}

function installWebUIPanel(node) {
    if (node.__webuiBridgePanel) {
        const existingWidget = node.widgets?.find((widget) => widget.name === "webui_prompt_frontend");
        const usablePanel = existingWidget?.element === node.__webuiBridgePanel &&
            node.__webuiBridgePanel.querySelector?.(".webui-bridge-toprow, .webui-bridge-panel-error");
        if (usablePanel) {
            node.__webuiBridgePanel.style.display = "";
            return;
        }
        node.__webuiBridgePanel.remove?.();
        node.__webuiBridgePanel = null;
    }
    removeBridgeDomWidgets(node);
    if (!node.__webuiBridgeSetSizeWrapped && typeof node.setSize === "function") {
        const originalSetSize = node.setSize.bind(node);
        node.setSize = function (size) {
            if (Array.isArray(size) && Number.isFinite(size[0]) && Number.isFinite(size[1])) {
                const clamped = clampPanelSize(size[0], size[1]);
                node.__webuiBridgeDesiredSize = clamped;
                return originalSetSize(clamped);
            }
            return originalSetSize(size);
        };
        node.__webuiBridgeSetSizeWrapped = true;
    }
    hideNativeWidgets(node);
    let panel = null;
    try {
        panel = buildPanel(node);
    } catch (error) {
        console.error("[WebUIPromptBridge] Failed to build panel", error);
        panel = createPanelErrorView(error);
    }
    if (!node.__webuiBridgeConnectionsWrapped) {
        chainCallback(node, "onConnectionsChange", () => {
            window.setTimeout(() => node.__webuiBridgePanel?.__webuiBridgeImportUpstreamLoras?.(), 0);
        });
        node.__webuiBridgeConnectionsWrapped = true;
    }
    if (!node.__webuiBridgeSerializeWrapped) {
        chainCallback(node, "onSerialize", function (data) {
            if (!data || !Array.isArray(data.widgets_values)) return;
            if (data.widgets_values.length > 2) {
                data.widgets_values[2] = normalizeClipStrength(data.widgets_values[2]);
            }
            while (data.widgets_values.length > 4 && data.widgets_values[data.widgets_values.length - 1] == null) {
                data.widgets_values.pop();
            }
        });
        node.__webuiBridgeSerializeWrapped = true;
    }
    if (looksLikeAutoExtendedDefaultSize(node.__webuiBridgeDesiredSize) || looksLikeAutoExtendedDefaultSize(node.size)) {
        node.__webuiBridgeDesiredSize = clampPanelSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT);
        node.setSize(node.__webuiBridgeDesiredSize);
    }
    if (!node.__webuiBridgeDesiredSize) {
        node.__webuiBridgeDesiredSize = node.__webuiBridgeFreshNode && !node.__webuiBridgeWasConfigured
            ? clampPanelSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT)
            : looksLikeLegacyDefaultSize(node.size)
                ? clampPanelSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT)
            : looksLikeAutoExtendedDefaultSize(node.size)
                ? clampPanelSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT)
            : clampPanelSize(
                Math.max(node.size?.[0] || DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_WIDTH),
                Math.max(node.size?.[1] || DEFAULT_PANEL_HEIGHT, DEFAULT_PANEL_HEIGHT),
            );
    }
    if (!node.__webuiBridgeComputeSizeWrapped && typeof node.computeSize === "function") {
        const originalComputeSize = node.computeSize.bind(node);
        node.computeSize = function (...args) {
            if (node.__webuiBridgeDesiredSize) return [...node.__webuiBridgeDesiredSize];
            return originalComputeSize(...args);
        };
        node.__webuiBridgeComputeSizeWrapped = true;
    }
    const domWidget = node.addDOMWidget("webui_prompt_frontend", "webui_prompt_frontend", panel, {
        serialize: false,
        hideOnZoom: false,
        getMinHeight: () => 280,
        getMaxHeight: () => 100000,
    });
    installWidgetSerializationFallback(domWidget, () => null);
    if (Array.isArray(node.widgets)) {
        const index = node.widgets.indexOf(domWidget);
        if (index >= 0 && index < node.widgets.length - 1) {
            node.widgets.splice(index, 1);
            node.widgets.push(domWidget);
        }
    }
    for (const widget of node.widgets || []) installWidgetSerializationFallback(widget);
    ensureGraphLinksSerializableCompatibility();
    domWidget.y = 0;
    domWidget.last_y = 0;
    const applyDomWidgetSize = (nodeWidth, nodeHeight, widgetTop = 0) => {
        domWidget.y = 0;
        domWidget.last_y = 0;
        const widgetWidth = Math.max(PANEL_MIN_WIDTH, nodeWidth - 20);
        const widgetHeight = Math.max(280, nodeHeight - Math.max(0, widgetTop) - DOM_WIDGET_LAYOUT_PAD);
        panel.style.width = `${widgetWidth}px`;
        panel.style.height = `${widgetHeight}px`;
        return [widgetWidth, widgetHeight];
    };
    domWidget.computeSize = (width) => {
        const desired = node.__webuiBridgeDesiredSize || node.size || [width || 1040, 820];
        const nodeWidth = desired[0] || width || 1040;
        const nodeHeight = desired[1] || 820;
        const widgetTop = Number.isFinite(domWidget.y) && domWidget.y > 0 ? domWidget.y : 0;
        return applyDomWidgetSize(nodeWidth, nodeHeight, widgetTop);
    };
    applyDomWidgetSize(node.__webuiBridgeDesiredSize[0], node.__webuiBridgeDesiredSize[1]);
    node.__webuiBridgePanel = panel;
    node.resizable = true;
    if (node.__webuiBridgeFreshNode && !node.__webuiBridgeWasConfigured && !node.__webuiBridgeFreshSizeApplied) {
        node.__webuiBridgeDesiredSize = clampPanelSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT);
        node.__webuiBridgeFreshSizeApplied = true;
        node.setSize(node.__webuiBridgeDesiredSize);
        const enforceFreshSize = () => {
            const desired = node.__webuiBridgeDesiredSize;
            if (!node.__webuiBridgeFreshNode || node.__webuiBridgeWasConfigured || !Array.isArray(desired)) return;
            if ((node.size?.[1] || 0) > desired[1] + 8 || (node.size?.[0] || 0) !== desired[0]) {
                node.setSize(desired);
                app.graph?.setDirtyCanvas?.(true, true);
            }
        };
        window.setTimeout(enforceFreshSize, 0);
        window.setTimeout(enforceFreshSize, 250);
    } else if (looksLikeLegacyDefaultSize(node.size)) {
        node.__webuiBridgeDesiredSize = clampPanelSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT);
        node.setSize(node.__webuiBridgeDesiredSize);
    } else if (looksLikeAutoExtendedDefaultSize(node.size)) {
        node.__webuiBridgeDesiredSize = clampPanelSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT);
        node.setSize(node.__webuiBridgeDesiredSize);
    } else if (!node.size || node.size[0] < PANEL_MIN_WIDTH || node.size[1] < PANEL_MIN_HEIGHT) {
        node.__webuiBridgeDesiredSize = clampPanelSize(node.size?.[0] || DEFAULT_PANEL_WIDTH, node.size?.[1] || DEFAULT_PANEL_HEIGHT);
        node.setSize(node.__webuiBridgeDesiredSize);
    } else if (node.size[0] > PANEL_MAX_WIDTH) {
        node.setSize(clampPanelSize(node.size[0], node.size[1]));
    }
}

function addStyles() {
    if (document.getElementById("webui-prompt-bridge-style")) return;
    const style = document.createElement("style");
    style.id = "webui-prompt-bridge-style";
    style.textContent = `
        .webui-bridge-panel {
            position: relative;
            width: 100%;
            min-width: 0;
            height: 100%;
            min-height: ${PANEL_MIN_HEIGHT}px;
            padding: 6px 6px 2px;
            box-sizing: border-box;
            display: flex;
            flex: 0 0 auto !important;
            flex-direction: column;
            gap: 6px;
            background: #20242d;
            color: #f2f4f8;
            font-family: Arial, sans-serif;
            font-size: var(--webui-bridge-font-size, 12px);
            overflow: hidden;
            container-type: inline-size;
        }
        .webui-bridge-panel-error {
            justify-content: center;
            padding: 18px;
            overflow: auto;
            background: #241820;
        }
        .webui-bridge-error-title {
            color: #ffd1d1;
            font-size: 15px;
            font-weight: 700;
        }
        .webui-bridge-panel-error pre {
            margin: 0;
            padding: 12px;
            border: 1px solid #7a3d45;
            border-radius: 6px;
            background: #130c10;
            color: #ffdede;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
            font: 12px/1.45 Consolas, Monaco, monospace;
        }
        .webui-bridge-resize-grip {
            position: absolute;
            right: 4px;
            bottom: 4px;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #4d5666;
            border-radius: 4px;
            background: rgba(32, 39, 51, .92);
            color: #dce6f5;
            cursor: nwse-resize;
            user-select: none;
            z-index: 5;
            font-size: 13px;
        }
        .webui-bridge-resize-grip:hover {
            border-color: #6aa3ff;
            background: #30394a;
        }
        .webui-bridge-section-resizer {
            flex: 0 0 8px;
            min-height: 8px;
            cursor: ns-resize;
            background:
                linear-gradient(to bottom, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.12)),
                repeating-linear-gradient(90deg, transparent 0 7px, rgba(134, 156, 190, .32) 7px 9px, transparent 9px 16px);
            border-top: 1px solid rgba(84, 99, 124, .5);
            border-bottom: 1px solid rgba(0, 0, 0, .22);
            box-sizing: border-box;
            user-select: none;
        }
        .webui-bridge-section-resizer:hover {
            background:
                linear-gradient(to bottom, rgba(106, 163, 255, 0.14), rgba(20, 47, 82, 0.16)),
                repeating-linear-gradient(90deg, transparent 0 7px, rgba(156, 194, 255, .72) 7px 9px, transparent 9px 16px);
        }
        .webui-bridge-split-resizer {
            position: relative;
            z-index: 2;
        }
        .webui-bridge-panel-splitter {
            flex: 0 0 12px;
            min-height: 12px;
            margin: -4px 0 -4px;
            border-top: 2px solid rgba(112, 143, 190, .8);
            border-bottom: 2px solid rgba(30, 38, 52, .95);
            border-radius: 4px;
            z-index: 8;
        }
        .webui-bridge-size-controls {
            display: grid;
            grid-template-columns: 32px 32px 32px minmax(42px, 1fr);
            gap: 5px;
        }
        .webui-bridge-size-controls button {
            height: 26px;
            min-width: 0;
            border: 1px solid #4d5666;
            border-radius: 5px;
            background: #202733;
            color: #f2f4f8;
            cursor: pointer;
            font-size: 12px;
        }
        .webui-bridge-size-controls button:hover {
            border-color: #6aa3ff;
            background: #30394a;
        }
        .webui-bridge-mode-controls {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5px;
        }
        .webui-bridge-mode-controls button {
            min-width: 0;
            min-height: 32px;
            padding: 5px 6px;
            border: 1px solid #4d5666;
            border-radius: 5px;
            background: #202733;
            color: #f2f4f8;
            cursor: pointer;
            font-size: 12px;
            line-height: 1.2;
        }
        .webui-bridge-mode-controls button.fast {
            border-color: #5475b8;
            background: #1d304f;
        }
        .webui-bridge-mode-controls button.quality {
            border-color: #6f6942;
            background: #35331f;
            color: #fff3bd;
        }
        .webui-bridge-mode-controls button:hover {
            border-color: #8bb9ff;
            filter: brightness(1.12);
        }
        .webui-bridge-layout-presets {
            display: grid;
            grid-template-columns: repeat(5, minmax(0, 1fr));
            gap: 4px;
            padding: 5px;
            border: 1px solid #3d4a5d;
            border-radius: 6px;
            background: #151c27;
        }
        .webui-bridge-layout-preset {
            min-width: 0;
            height: 28px;
            padding: 3px 4px;
            border: 1px solid #435066;
            border-radius: 5px;
            background: #202733;
            color: #d9e2ee;
            cursor: pointer;
            font-size: 11px;
            line-height: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .webui-bridge-layout-preset:hover {
            border-color: #7fb0ff;
            background: #273348;
            color: #fff;
        }
        .webui-bridge-layout-preset.active {
            border-color: #7db2ff;
            background: #1b3f6d;
            color: #f6fbff;
            box-shadow: inset 0 0 0 1px rgba(130, 180, 255, .22);
        }
        .webui-bridge-model-switch {
            display: grid;
            gap: 6px;
            padding: 8px;
            border: 1px solid #4c678f;
            border-radius: 6px;
            background: #142033;
            box-shadow: inset 0 0 0 1px rgba(96, 150, 230, .16);
        }
        .webui-bridge-model-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            min-width: 0;
        }
        .webui-bridge-model-title {
            color: #eef5ff;
            font-size: 13px;
            font-weight: 700;
            white-space: nowrap;
        }
        .webui-bridge-model-mode {
            min-width: 0;
            padding: 2px 6px;
            border-radius: 4px;
            background: #3a4b64;
            color: #dce9fb;
            font-size: 10px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .webui-bridge-model-mode.checkpoint {
            background: #2d694f;
            color: #eafff5;
        }
        .webui-bridge-model-select {
            width: 100%;
            min-width: 0;
            height: 30px;
            box-sizing: border-box;
            padding: 4px 8px;
            border: 1px solid #5b7092;
            border-radius: 5px;
            background: #0d131d;
            color: #f3f7ff;
            font-size: 12px;
        }
        .webui-bridge-model-actions {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
            align-items: center;
            gap: 5px;
        }
        .webui-bridge-model-actions button {
            min-width: 0;
            min-height: 28px;
            padding: 4px 6px;
            border: 1px solid #526785;
            border-radius: 5px;
            background: #24334a;
            color: #edf5ff;
            cursor: pointer;
            font-size: 11px;
        }
        .webui-bridge-model-actions button:hover {
            border-color: #8bb9ff;
            background: #2c4870;
        }
        .webui-bridge-model-count {
            color: #a9bad2;
            font-size: 10px;
            white-space: nowrap;
        }
        .webui-bridge-toprow {
            display: grid;
            grid-template-columns: minmax(0, 1fr) clamp(220px, 24%, 280px);
            gap: 8px;
            flex: 0 1 auto;
            min-height: 0;
            max-height: none;
            overflow: hidden;
        }
        .webui-bridge-toprow.negative-collapsed {
            align-items: start;
            flex: 0 0 auto;
            min-height: 0;
        }
        .webui-bridge-prompts {
            display: flex;
            flex-direction: column;
            gap: 6px;
            min-width: 0;
            min-height: 0;
            align-content: flex-start;
            justify-content: flex-start;
            overflow: hidden auto;
        }
        .webui-bridge-prompts.negative-collapsed {
            overflow: visible;
        }
        .webui-bridge-prompts.negative-collapsed .webui-bridge-negative-detail-resizer,
        .webui-bridge-prompts.negative-collapsed .webui-bridge-negative-main-resizer,
        .webui-bridge-prompts.negative-collapsed .webui-bridge-aio-negative {
            display: none;
        }
        .webui-bridge-prompts.negative-collapsed .webui-bridge-aio-positive {
            flex: 1 1 auto;
        }
        .webui-bridge-prompt-row {
            position: relative;
            display: flex;
            flex-direction: column;
            flex: 0 0 auto;
            border: 1px solid #3e4654;
            border-radius: 6px;
            background: #171a20;
            overflow: hidden;
        }
        .webui-bridge-prompt-row.has-chips {
            min-height: 198px;
        }
        .webui-bridge-prompt-row.collapsed,
        .webui-bridge-prompt-row.collapsed.has-chips {
            min-height: 0 !important;
            height: auto !important;
            max-height: 42px !important;
        }
        .webui-bridge-prompt-row.active {
            border-color: #6aa3ff;
        }
        .webui-bridge-positive-prompt-row {
            position: sticky;
            top: 0;
            z-index: 15;
            box-shadow: 0 6px 12px rgba(0, 0, 0, .22);
        }
        .webui-bridge-prompt-row.prompt-placement-error {
            border-color: #d84a4a;
            box-shadow: 0 0 0 1px rgba(216, 74, 74, .35);
        }
        .webui-bridge-prompt-label {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 5px 8px;
            color: #cbd4e1;
            font-size: 12px;
            background: #252a34;
            border-bottom: 1px solid #3e4654;
        }
        .webui-bridge-prompt-label-tools {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            flex: 0 0 auto;
        }
        .webui-bridge-prompt-label-btn {
            min-width: 24px;
            height: 22px;
            padding: 0 6px;
            border: 1px solid #4b5a70;
            border-radius: 4px;
            background: #1c2634;
            color: #e5eefb;
            cursor: pointer;
            font-size: 11px;
            line-height: 20px;
        }
        .webui-bridge-prompt-label-btn:hover {
            border-color: #79a9ef;
            background: #263853;
        }
        .webui-bridge-prompt-row textarea {
            width: 100%;
            flex: 0 0 auto;
            height: 96px;
            min-height: 48px;
            max-height: none;
            padding: 9px 56px 9px 9px;
            box-sizing: border-box;
            border: 0;
            resize: vertical;
            background: #111318;
            color: #f2f4f8;
            font: 12px/1.45 Consolas, Monaco, monospace;
            outline: none;
        }
        .webui-bridge-prompt-row.translating textarea,
        .webui-bridge-input-busy {
            box-shadow: inset 0 0 0 1px #5d9bff, 0 0 0 2px rgba(93, 155, 255, .16);
        }
        .webui-bridge-translate-status {
            display: none;
            margin: 0;
            padding: 5px 9px;
            border-bottom: 1px solid #2d3542;
            background: #10223a;
            color: #d7e8ff;
            font-size: 12px;
            line-height: 1.35;
        }
        .webui-bridge-translate-status.visible {
            display: block;
        }
        .webui-bridge-prompt-row.translating .webui-bridge-translate-status.visible::before {
            content: "";
            display: inline-block;
            width: 8px;
            height: 8px;
            margin-right: 7px;
            border: 2px solid rgba(215, 232, 255, .45);
            border-top-color: #d7e8ff;
            border-radius: 50%;
            vertical-align: -1px;
            animation: webui-bridge-spin .85s linear infinite;
        }
        @keyframes webui-bridge-spin {
            to { transform: rotate(360deg); }
        }
        .webui-bridge-prompt-row textarea.error {
            box-shadow: inset 0 0 0 1px #d84a4a;
        }
        .webui-bridge-prompt-chips {
            display: flex;
            flex: 0 0 auto;
            align-items: flex-start;
            align-content: flex-start;
            gap: 8px;
            padding: 8px 8px 56px;
            height: 104px;
            min-height: 104px;
            max-height: none;
            overflow: auto;
            flex-wrap: wrap;
            border-top: 1px solid #2d3542;
            background: #151922;
        }
        .webui-bridge-prompt-row.collapsed textarea,
        .webui-bridge-prompt-row.collapsed .webui-bridge-prompt-chips,
        .webui-bridge-prompt-row.collapsed .webui-bridge-section-resizer,
        .webui-bridge-prompt-row.collapsed .webui-bridge-token-counter {
            display: none !important;
        }
        .webui-bridge-prompt-row.collapsed + .webui-bridge-aio-negative {
            display: none;
        }
        .webui-bridge-prompt-chips.empty {
            display: none;
        }
        .webui-bridge-prompt-chips.empty + .webui-bridge-section-resizer {
            display: none;
        }
        .webui-bridge-prompt-chips.drag-active {
            cursor: grabbing;
        }
        .webui-bridge-prompt-chip {
            position: relative;
            display: flex;
            flex-direction: column;
            min-width: 74px;
            max-width: 190px;
            min-height: 40px;
            padding: 0;
            border: 1px solid #323b4d;
            border-radius: 4px;
            background: #242b38;
            color: #edf2fb;
            overflow: visible;
            cursor: pointer;
            user-select: none;
        }
        .webui-bridge-prompt-chip[draggable="true"] {
            cursor: grab;
        }
        .webui-bridge-prompt-chip.dragging {
            opacity: 0.42;
            cursor: grabbing;
            border-style: dashed;
        }
        .webui-bridge-prompt-chip.selected {
            border-color: #9cc2ff;
            box-shadow: 0 0 0 2px rgba(117, 168, 255, .28);
        }
        .webui-bridge-prompt-chip.drop-before {
            box-shadow: -4px 0 0 #77b5ff;
        }
        .webui-bridge-prompt-chip.drop-after {
            box-shadow: 4px 0 0 #77b5ff;
        }
        .webui-bridge-prompt-chip:hover {
            border-color: #6aa3ff;
            background: #30394a;
        }
        .webui-bridge-prompt-chip.disabled {
            opacity: 0.48;
            border-style: dashed;
            filter: grayscale(0.6);
        }
        .webui-bridge-prompt-chip.disabled .webui-bridge-chip-main {
            text-decoration: line-through;
        }
        .webui-bridge-prompt-chip::after {
            content: "";
            position: absolute;
            left: -4px;
            right: -4px;
            top: 100%;
            height: 10px;
            display: none;
        }
        .webui-bridge-prompt-chip.show-tools::after,
        .webui-bridge-prompt-chip:hover::after {
            display: block;
        }
        .webui-bridge-prompt-chip.lora {
            border-color: #6e4b56;
            background: #3a2730;
        }
        .webui-bridge-prompt-chip.lora.found {
            border-color: #2f7a66;
            background: #18392f;
        }
        .webui-bridge-prompt-chip.lora.missing {
            border-color: #9b4b4b;
            background: #4a2429;
        }
        .webui-bridge-prompt-chip.lora.warning {
            border-color: #c78931;
            background: #46331d;
        }
        .webui-bridge-chip-main,
        .webui-bridge-chip-local {
            display: block;
            height: 19px;
            padding: 2px 6px;
            box-sizing: border-box;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .webui-bridge-chip-main {
            font: 11px/15px Consolas, Monaco, monospace;
        }
        .webui-bridge-chip-local {
            color: #ffdca7;
            background: rgba(255, 255, 255, 0.06);
            font-size: 11px;
            line-height: 15px;
        }
        .webui-bridge-chip-tools {
            position: absolute;
            z-index: 80;
            left: -1px;
            top: calc(100% + 2px);
            display: none;
            align-items: center;
            flex-wrap: wrap;
            gap: 2px;
            max-width: 420px;
            padding: 3px;
            box-sizing: border-box;
            border: 1px solid #465267;
            border-radius: 4px;
            background: #101620;
            box-shadow: 0 7px 18px rgba(0, 0, 0, 0.34);
            white-space: nowrap;
        }
        .webui-bridge-prompt-chip.show-tools,
        .webui-bridge-prompt-chip:hover {
            z-index: 30;
        }
        .webui-bridge-prompt-chip.tools-up .webui-bridge-chip-tools {
            top: auto;
            bottom: calc(100% + 2px);
        }
        .webui-bridge-prompt-chip.tools-up::after {
            top: auto;
            bottom: 100%;
        }
        .webui-bridge-prompt-chip.show-tools .webui-bridge-chip-tools,
        .webui-bridge-prompt-chip:hover .webui-bridge-chip-tools {
            display: flex;
        }
        .webui-bridge-chip-tool {
            flex: 0 0 auto;
            min-width: 21px;
            height: 21px;
            padding: 0 4px;
            border: 1px solid #3a4658;
            border-radius: 3px;
            background: #202837;
            color: #d9e4f5;
            font: 11px/18px Arial, sans-serif;
            cursor: pointer;
        }
        .webui-bridge-chip-tool:hover {
            border-color: #74a9ff;
            background: #2b3850;
        }
        .webui-bridge-chip-tool.favorite.active {
            color: #ffd26f;
            border-color: #8c6b28;
        }
        .webui-bridge-chip-tool.danger {
            color: #ffb6b6;
        }
        .webui-bridge-chip-weight {
            flex: 0 0 46px;
            width: 46px;
            height: 21px;
            box-sizing: border-box;
            border: 1px solid #3a4658;
            border-radius: 3px;
            background: #111821;
            color: #f3f6fb;
            font-size: 11px;
            text-align: center;
        }
        .webui-bridge-chip-edit {
            width: 180px;
            min-height: 40px;
            padding: 5px 6px;
            box-sizing: border-box;
            border: 0;
            outline: 1px solid #6aa3ff;
            border-radius: 4px;
            resize: both;
            background: #10141d;
            color: #f4f7fb;
            font: 12px/1.35 Consolas, Monaco, monospace;
        }
        .webui-bridge-aio {
            border: 1px solid #263243;
            border-radius: 4px;
            background: #0d121b;
            overflow: hidden;
            min-height: 0;
            flex: 0 0 auto;
            display: flex;
            flex-direction: column;
        }
        .webui-bridge-aio-positive {
            min-height: 180px;
            height: 220px;
        }
        .webui-bridge-aio-negative {
            min-height: 220px;
            height: 240px;
        }
        .webui-bridge-aio-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 5px 8px;
            background: #111722;
            border-bottom: 1px solid #263243;
        }
        .webui-bridge-aio-title {
            color: #f0f4fb;
            font-size: 13px;
            font-weight: 700;
            white-space: nowrap;
        }
        .webui-bridge-aio-actions {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 5px;
            min-width: 0;
            flex-wrap: wrap;
        }
        .webui-bridge-aio-append {
            position: relative;
            display: grid;
            grid-template-columns: minmax(0, 1fr) 28px;
            gap: 5px;
            padding: 5px 7px;
            border-bottom: 1px solid #263243;
            background: #101927;
            box-shadow: inset 0 0 0 1px rgba(106, 163, 255, .12);
        }
        .webui-bridge-append-menu {
            position: absolute;
            z-index: 20;
            top: calc(100% + 2px);
            left: 8px;
            min-width: 240px;
            display: none;
            flex-direction: column;
            padding: 5px;
            border: 1px solid #2e4a87;
            border-radius: 5px;
            background: #171b25;
            box-shadow: 0 12px 28px rgba(0, 0, 0, .4);
        }
        .webui-bridge-append-menu.visible {
            display: flex;
        }
        .webui-bridge-append-menu button {
            min-height: 32px;
            padding: 5px 10px;
            border: 0;
            border-radius: 4px;
            background: transparent;
            color: #edf3ff;
            text-align: left;
            cursor: pointer;
            font-size: 13px;
        }
        .webui-bridge-append-menu button:hover {
            background: #243149;
        }
        .webui-bridge-append-menu button.disabled {
            opacity: .48;
            cursor: default;
        }
        .webui-bridge-aio-prompt-tools {
            display: flex;
            align-items: center;
            gap: 3px;
            min-width: 0;
        }
        .webui-bridge-aio-mini {
            width: 24px;
            height: 24px;
            border: 1px solid #39475c;
            border-radius: 4px;
            background: #242b38;
            color: #e8edf6;
            cursor: pointer;
            font-size: 12px;
            line-height: 1;
        }
        .webui-bridge-aio-mini:hover,
        .webui-bridge-aio-add:hover {
            border-color: #6aa3ff;
            background: #30394a;
        }
        .webui-bridge-aio-toggles {
            display: flex;
            align-items: center;
            gap: 2px;
        }
        .webui-bridge-aio-toggles input {
            width: 13px;
            height: 13px;
            margin: 0;
            accent-color: #2f73d9;
        }
        .webui-bridge-aio-new {
            width: 100%;
            min-width: 0;
            height: 28px;
            box-sizing: border-box;
            padding: 4px 9px;
            border: 1px solid #57739c;
            border-radius: 5px;
            background: #07101d;
            color: #f2f4f8;
            font-size: 12px;
            outline: none;
        }
        .webui-bridge-aio-new::placeholder {
            color: #9fb4d0;
        }
        .webui-bridge-aio-new:focus {
            border-color: #8bb9ff;
            box-shadow: 0 0 0 2px rgba(106, 163, 255, .24);
        }
        .webui-bridge-aio-add {
            width: 28px;
            height: 28px;
            border: 1px solid #39475c;
            border-radius: 4px;
            background: #242b38;
            color: #e8edf6;
            cursor: pointer;
        }
        .webui-bridge-aio-tabs,
        .webui-bridge-aio-subtabs {
            display: flex;
            align-items: center;
            overflow-x: auto;
            scrollbar-width: thin;
            background: #202631;
            min-height: 26px;
            border-bottom: 1px solid #2d3542;
        }
        .webui-bridge-aio-subtabs {
            background: #141a24;
            min-height: 24px;
        }
        .webui-bridge-aio-tabs button,
        .webui-bridge-aio-subtabs button {
            flex: 0 0 auto;
            min-height: 24px;
            padding: 3px 8px;
            border: 0;
            border-right: 1px solid #2d3542;
            background: transparent;
            color: #d6deec;
            cursor: pointer;
            font-size: 11px;
            white-space: nowrap;
        }
        .webui-bridge-aio-tabs button.active,
        .webui-bridge-aio-subtabs button.active {
            background: #3c72b8;
            color: #fff;
            font-weight: 700;
        }
        .webui-bridge-aio-tabs button:hover,
        .webui-bridge-aio-subtabs button:hover {
            background: #30394a;
        }
        .webui-bridge-aio-body {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(clamp(92px, 12%, 132px), 1fr));
            align-content: start;
            gap: 5px;
            flex: 1 1 auto;
            min-height: 72px;
            padding: 6px;
            overflow: auto;
        }
        .webui-bridge-aio-positive .webui-bridge-aio-body {
            min-height: 72px;
        }
        .webui-bridge-aio-negative .webui-bridge-aio-body {
            min-height: 72px;
        }
        .webui-bridge-aio-empty {
            grid-column: 1 / -1;
            min-height: 52px;
            display: grid;
            place-items: center;
            border: 1px dashed #2f4057;
            border-radius: 5px;
            color: #9fb4d0;
            background: rgba(15, 23, 36, .72);
            font-size: 12px;
        }
        .webui-bridge-aio-tag {
            position: relative;
            min-height: var(--webui-bridge-aio-tag-height, 38px);
            height: auto;
            padding: 0;
            border: 1px solid #202838;
            border-radius: 4px;
            background: #272d3a;
            color: #f3f5fa;
            overflow: hidden;
            cursor: pointer;
        }
        .webui-bridge-aio-tag.selected {
            filter: grayscale(1);
            opacity: .62;
        }
        .webui-bridge-aio-tag:hover {
            border-color: #6aa3ff;
        }
        .webui-bridge-aio-fav-remove {
            position: absolute;
            right: 4px;
            top: 3px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 15px;
            height: 15px;
            border-radius: 3px;
            background: rgba(18, 22, 30, 0.72);
            color: #ffc1c1;
            font-size: 12px;
            line-height: 15px;
            opacity: 0;
        }
        .webui-bridge-aio-tag:hover .webui-bridge-aio-fav-remove {
            opacity: 1;
        }
        .webui-bridge-aio-local,
        .webui-bridge-aio-en {
            display: block;
            height: var(--webui-bridge-aio-row-height, 19px);
            line-height: var(--webui-bridge-aio-line-height, 17px);
            padding: 0 6px;
            box-sizing: border-box;
            text-align: center;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .webui-bridge-aio-local {
            background: #5d5b3d;
            color: #fffbd0;
            font-size: var(--webui-bridge-aio-main-size, 12px);
        }
        .webui-bridge-aio-en {
            color: #cbd3df;
            font-size: var(--webui-bridge-aio-sub-size, 11px);
        }
        .webui-bridge-aio-color {
            display: none;
            align-items: center;
            gap: 5px;
            padding: 5px 8px;
            border-top: 1px solid #263243;
            color: #d6deec;
            font-size: 12px;
        }
        .webui-bridge-aio-hint {
            min-height: 18px;
            padding: 0 8px 4px;
            color: #9fb1c7;
            font-size: 11px;
            line-height: 1.35;
        }
        .webui-bridge-aio-swatch {
            width: 18px;
            height: 18px;
            border-radius: 2px;
            border: 1px solid #667184;
            background:
                linear-gradient(45deg, #fff 25%, transparent 25%),
                linear-gradient(-45deg, #fff 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #fff 75%),
                linear-gradient(-45deg, transparent 75%, #fff 75%);
            background-size: 8px 8px;
            background-position: 0 0, 0 4px, 4px -4px, -4px 0;
        }
        .webui-bridge-aio-color button {
            width: 22px;
            height: 20px;
            border: 1px solid #39475c;
            border-radius: 3px;
            background: #242b38;
            color: #e8edf6;
        }
        .webui-bridge-token-counter {
            position: absolute;
            right: 8px;
            bottom: 7px;
            padding: 2px 5px;
            border-radius: 4px;
            color: #d8e1ef;
            background: rgba(42, 48, 58, 0.92);
            font: 11px Consolas, monospace;
            pointer-events: none;
        }
        .webui-bridge-token-counter.error {
            color: #fff;
            background: #9d3333;
        }
        .webui-bridge-action-column {
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-width: 0;
            min-height: 0;
            overflow: auto;
        }
        .webui-bridge-generate {
            height: clamp(42px, 7vh, 62px);
            border: 0;
            border-radius: 6px;
            background: #2f73d9;
            color: white;
            font-weight: 700;
            cursor: pointer;
        }
        .webui-bridge-generate:hover {
            filter: brightness(1.08);
        }
        .webui-bridge-tools {
            display: grid;
            grid-template-columns: repeat(5, 1fr);
            gap: 5px;
        }
        .webui-bridge-tool {
            height: 30px;
            border: 1px solid #4d5666;
            border-radius: 5px;
            background: #2b303a;
            color: #f2f4f8;
            cursor: pointer;
            font-size: 15px;
        }
        .webui-bridge-backend-settings {
            display: grid;
            grid-template-columns: minmax(0, 1fr);
            gap: 5px;
            padding: 6px;
            border: 1px solid #3e4654;
            border-radius: 5px;
            background: #171a20;
            color: #cbd4e1;
            font-size: 11px;
        }
        .webui-bridge-backend-settings label {
            display: flex;
            align-items: center;
            gap: 6px;
            min-width: 0;
        }
        .webui-bridge-backend-settings input[type="number"] {
            width: 72px;
            height: 24px;
            padding: 2px 5px;
            box-sizing: border-box;
            border: 1px solid #4d5666;
            border-radius: 4px;
            background: #111318;
            color: #f2f4f8;
        }
        .webui-bridge-backend-settings input[type="number"].error {
            border-color: #d95c68;
            background: #28161a;
            color: #ffd6d6;
        }
        .webui-bridge-backend-settings input[type="checkbox"] {
            width: 14px;
            height: 14px;
            margin: 0;
            accent-color: #2f73d9;
        }
        .webui-bridge-config-button {
            min-height: 30px;
            border: 1px solid #4f7db8;
            border-radius: 5px;
            background: #17355c;
            color: #eef6ff;
            cursor: pointer;
            font-size: 12px;
            font-weight: 700;
        }
        .webui-bridge-config-button:hover {
            filter: brightness(1.08);
        }
        .webui-bridge-tool:hover {
            border-color: #6aa3ff;
            background: #343c49;
        }
        .webui-bridge-style-row select {
            width: 100%;
            min-height: 76px;
            border: 1px solid #4d5666;
            border-radius: 5px;
            background: #111318;
            color: #f2f4f8;
            font-size: 12px;
        }
        .webui-bridge-style-edit {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 30px 30px;
            gap: 5px;
            margin-top: 5px;
        }
        .webui-bridge-style-name {
            min-width: 0;
            height: 30px;
            box-sizing: border-box;
            padding: 5px 8px;
            border: 1px solid #4d5666;
            border-radius: 5px;
            background: #111318;
            color: #f2f4f8;
            font-size: 12px;
        }
        .webui-bridge-status {
            min-height: 0;
            padding: 0;
            border: 1px solid transparent;
            border-radius: 5px;
            color: #9fb1c7;
            font-size: 11px;
            line-height: 1.35;
            opacity: 0;
            transition: opacity .16s ease;
            overflow-wrap: anywhere;
        }
        .webui-bridge-status.visible {
            opacity: 1;
            padding: 7px 8px;
            border-color: #3d495c;
            background: #111824;
        }
        .webui-bridge-status.error {
            color: #ffb3b3;
        }
        .webui-bridge-status.error.visible {
            border-color: #8d4049;
            background: #29181d;
        }
        .webui-bridge-status.success {
            color: #a8e6b1;
        }
        .webui-bridge-status.success.visible {
            border-color: #3b7250;
            background: #132319;
        }
        .webui-bridge-status.has-actions {
            min-height: 72px;
        }
        .webui-bridge-status-action {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-height: 24px;
            margin: 6px 6px 0 0;
            padding: 3px 9px;
            border: 1px solid #5b6678;
            border-radius: 4px;
            background: #252d3a;
            color: #f2f4f8;
            cursor: pointer;
            font-size: 11px;
            font-weight: 700;
        }
        .webui-bridge-status-action.primary {
            border-color: #5d9bff;
            background: #2f73d9;
            color: #fff;
        }
        .webui-bridge-status-action:hover {
            filter: brightness(1.08);
        }
        .webui-bridge-extra {
            min-height: ${EXTRA_NETWORKS_MIN_HEIGHT}px;
            flex: 1 1 auto;
            max-height: none;
            display: flex;
            flex-direction: column;
            border: 2px solid #46556c;
            border-radius: 4px;
            overflow: hidden;
            background: #171a20;
            box-shadow: inset 0 0 0 1px rgba(10, 16, 24, .65);
        }
        .webui-bridge-extra-compact {
            min-height: ${EXTRA_NETWORKS_MIN_HEIGHT}px;
        }
        .webui-bridge-extra-head {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr);
            align-items: center;
            gap: 8px;
            padding: 7px 8px;
            background: #252a34;
            border-bottom: 1px solid #3e4654;
            font-size: 12px;
            color: #cbd4e1;
        }
        .webui-bridge-network-controls {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 5px;
            min-width: 0;
        }
        .webui-bridge-search {
            min-width: 0;
            padding: 5px 8px;
            border: 1px solid #4d5666;
            border-radius: 5px;
            background: #111318;
            color: #f2f4f8;
            flex: 1 1 180px;
        }
        .webui-bridge-network-count {
            color: #8fa0b7;
            font-size: 11px;
            white-space: nowrap;
        }
        .webui-bridge-network-sort-label {
            color: #8fa0b7;
            font-size: 11px;
        }
        .webui-bridge-network-tool {
            min-width: 32px;
            height: 28px;
            padding: 0 8px;
            border: 1px solid #4d5666;
            border-radius: 5px;
            background: #202733;
            color: #e5edf9;
            cursor: pointer;
            font-size: 11px;
        }
        .webui-bridge-network-tool:disabled {
            opacity: .45;
            cursor: default;
        }
        .webui-bridge-page-size {
            height: 28px;
            min-width: 74px;
            border: 1px solid #4d5666;
            border-radius: 5px;
            background: #202733;
            color: #e5edf9;
            font-size: 11px;
        }
        .webui-bridge-page-info {
            min-width: 42px;
            text-align: center;
        }
        .webui-bridge-network-tool.webui-bridge-network-primary {
            min-width: 104px;
            border-color: #4d8f66;
            background: #163821;
            color: #eafff0;
            font-weight: 700;
        }
        .webui-bridge-network-tool.webui-bridge-network-primary:hover {
            border-color: #78d393;
            background: #1f5732;
        }
        .webui-bridge-network-tool:hover,
        .webui-bridge-network-tool.active {
            border-color: #6aa3ff;
            background: #24466f;
        }
        .webui-bridge-extra-body {
            display: grid;
            grid-template-columns: minmax(170px, 230px) minmax(0, 1fr);
            height: auto;
            min-height: 0;
            flex: 1 1 auto;
            overflow: hidden;
        }
        .webui-bridge-extra.collapsed {
            flex: 0 0 42px !important;
            min-height: 42px !important;
            height: 42px !important;
            max-height: 42px !important;
        }
        .webui-bridge-panel.lora-overlay .webui-bridge-extra {
            position: absolute;
            z-index: 40;
            left: 8px;
            right: 8px;
            top: 8px;
            bottom: 8px;
            min-height: 0 !important;
            height: auto !important;
            flex: 1 1 auto !important;
            border-color: #6b9cff;
            box-shadow: 0 16px 54px rgba(0, 0, 0, .62);
        }
        .webui-bridge-panel.lora-overlay .webui-bridge-extra-body {
            height: auto;
            flex: 1 1 auto;
        }
        .webui-bridge-panel.lora-overlay .webui-bridge-panel-splitter {
            visibility: hidden;
        }
        .webui-bridge-lora-overlay-close {
            display: none;
        }
        .webui-bridge-panel.lora-overlay .webui-bridge-lora-overlay-close {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 132px;
            height: 34px;
            border-color: #dd6b6b;
            background: #5a2020;
            color: #fff;
            font-size: 13px;
            font-weight: 800;
        }
        .webui-bridge-network-pane {
            min-width: 0;
            min-height: 0;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .webui-bridge-network-tree {
            min-width: 0;
            min-height: 0;
            padding: 6px 4px;
            overflow: auto;
            border-right: 1px solid #3e4654;
            background: #141922;
        }
        .webui-bridge-tree-row {
            width: 100%;
            min-height: 26px;
            display: grid;
            grid-template-columns: 14px 28px minmax(0, 1fr) auto;
            align-items: center;
            gap: 4px;
            padding: 3px 7px 3px calc(6px + var(--depth) * 13px);
            box-sizing: border-box;
            border: 0;
            border-radius: 4px;
            background: transparent;
            color: #d7e0ed;
            text-align: left;
            cursor: pointer;
            font-size: 11px;
        }
        .webui-bridge-tree-row:hover {
            background: #263244;
        }
        .webui-bridge-tree-row.selected {
            background: #2c5d9c;
            color: #fff;
        }
        .webui-bridge-tree-chevron {
            color: #9fb1c7;
            font-size: 15px;
            line-height: 1;
            transform: rotate(0deg);
        }
        .webui-bridge-tree-chevron.open {
            transform: rotate(90deg);
        }
        .webui-bridge-tree-icon {
            color: #90abd0;
            font-size: 10px;
            text-align: center;
        }
        .webui-bridge-tree-name {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .webui-bridge-tree-count {
            color: #9fb1c7;
            font-size: 10px;
        }
        .webui-bridge-card-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(132px, 1fr));
            grid-auto-rows: clamp(142px, 16vw, 178px);
            align-content: start;
            gap: 8px;
            padding: 8px;
            overflow: auto;
            min-height: 0;
            height: 100%;
            flex: 1 1 auto;
            scrollbar-width: thin;
        }
        .webui-bridge-card-grid.compact {
            grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
            grid-auto-rows: 128px;
            gap: 6px;
        }
        .webui-bridge-card-grid.large {
            grid-template-columns: repeat(auto-fill, minmax(178px, 1fr));
            grid-auto-rows: 220px;
        }
        .webui-bridge-card {
            position: relative;
            min-height: 0;
            padding: 0;
            border: 1px solid #3e4654;
            border-radius: 6px;
            background: #101722;
            color: #f2f4f8;
            text-align: left;
            cursor: pointer;
            overflow: hidden;
            box-shadow: 0 0 5px rgba(0, 0, 0, .2);
        }
        .webui-bridge-card:hover {
            box-shadow: 0 0 0 3px rgba(93, 155, 255, .28);
        }
        .webui-bridge-card.selected {
            border-color: #79b8ff;
            box-shadow: 0 0 0 3px rgba(93, 155, 255, .35);
        }
        .webui-bridge-card-select {
            position: absolute;
            z-index: 3;
            left: 10px;
            bottom: 13px;
            width: 24px;
            height: 24px;
            display: grid;
            place-items: center;
            border: 1px solid rgba(255, 255, 255, .48);
            border-radius: 5px;
            background: rgba(8, 13, 20, .86);
            cursor: pointer;
            box-shadow: 0 2px 7px rgba(0, 0, 0, .35);
        }
        .webui-bridge-card-select input {
            position: absolute;
            opacity: 0;
            pointer-events: none;
        }
        .webui-bridge-card-select span {
            width: 14px;
            height: 14px;
            border: 2px solid #dbe8ff;
            border-radius: 3px;
            box-sizing: border-box;
            background: rgba(255, 255, 255, .08);
        }
        .webui-bridge-card-select input:checked + span {
            border-color: #84d69c;
            background: #2fb35f;
            box-shadow: inset 0 0 0 3px #11351f;
        }
        .webui-bridge-card-preview {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
        }
        .webui-bridge-card-preview-empty {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #101722;
            color: #90abd0;
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 0;
            opacity: .72;
        }
        .webui-bridge-card-buttons {
            position: absolute;
            top: 7px;
            right: 7px;
            display: flex;
            gap: 6px;
            opacity: .92;
            z-index: 2;
        }
        .webui-bridge-card-buttons button {
            width: 26px;
            height: 26px;
            padding: 0;
            border: 1px solid rgba(255, 255, 255, .42);
            border-radius: 4px;
            background: rgba(18, 24, 33, .72);
            color: #fff;
            cursor: pointer;
            font: 700 14px/1 Arial, sans-serif;
            text-shadow: 0 1px 2px rgba(0, 0, 0, .8);
            box-shadow: 0 2px 7px rgba(0, 0, 0, .35);
        }
        .webui-bridge-card-buttons button:hover {
            border-color: #8bb9ff;
            background: rgba(38, 79, 126, .92);
        }
        .webui-bridge-card-actions {
            position: absolute;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            flex-direction: column;
            gap: 2px;
            padding: 8px 8px 8px 42px;
            background: linear-gradient(to top, rgba(0, 0, 0, .78), rgba(0, 0, 0, .44));
            color: #fff;
            text-shadow: 0 1px 2px rgba(0, 0, 0, .85);
        }
        .webui-bridge-empty {
            grid-column: 1 / -1;
            padding: 18px 10px;
            color: #8fa0b7;
            text-align: center;
            font-size: 12px;
        }
        .webui-bridge-autocomplete {
            position: fixed;
            z-index: 100000;
            display: none;
            max-height: 270px;
            overflow: auto;
            border: 1px solid #39475c;
            border-radius: 8px;
            background: #101722;
            box-shadow: 0 10px 32px rgba(0,0,0,.42);
            padding: 4px;
            box-sizing: border-box;
        }
        .webui-bridge-autocomplete.compact {
            max-height: 224px;
            border-radius: 6px;
            padding: 3px;
        }
        .webui-bridge-autocomplete.visible {
            display: flex;
            flex-direction: column;
        }
        .webui-bridge-autocomplete button {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 2px 12px;
            min-height: 38px;
            padding: 6px 10px;
            border: 0;
            border-radius: 5px;
            background: transparent;
            color: #d8ecff;
            text-align: left;
            cursor: pointer;
        }
        .webui-bridge-autocomplete.compact button {
            grid-template-rows: 17px 15px;
            gap: 0 8px;
            min-height: 40px;
            padding: 4px 8px 5px;
            border-radius: 4px;
        }
        .webui-bridge-autocomplete button.active,
        .webui-bridge-autocomplete button:hover {
            background: #1d2a3b;
        }
        .webui-bridge-ac-main {
            grid-column: 1;
            font: 14px/16px Consolas, Monaco, monospace;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .webui-bridge-autocomplete.compact .webui-bridge-ac-main {
            font: 12px/17px Consolas, Monaco, monospace;
        }
        .webui-bridge-ac-local {
            grid-column: 1;
            color: #91b2c9;
            font-size: 11px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .webui-bridge-autocomplete.compact .webui-bridge-ac-local {
            font-size: 10px;
            line-height: 15px;
        }
        .webui-bridge-ac-count {
            grid-column: 2;
            grid-row: 1 / span 2;
            align-self: center;
            color: #8c97a6;
            font-size: 13px;
            white-space: nowrap;
        }
        .webui-bridge-autocomplete.compact .webui-bridge-ac-count {
            font-size: 11px;
        }
        @container (max-width: 860px) {
            .webui-bridge-panel {
                min-width: 760px;
                width: max(100%, 760px);
            }
            .webui-bridge-toprow {
                grid-template-columns: 1fr;
            }
            .webui-bridge-action-column {
                display: grid;
                grid-template-columns: minmax(120px, 160px) 1fr;
                align-items: start;
            }
            .webui-bridge-style-row,
            .webui-bridge-status {
                grid-column: 1 / -1;
            }
        }
        @container (max-width: 620px) {
            .webui-bridge-panel {
                padding: 6px;
                gap: 6px;
            }
            .webui-bridge-aio-header {
                flex-wrap: wrap;
            }
            .webui-bridge-aio-actions {
                width: 100%;
                justify-content: flex-start;
                flex-wrap: wrap;
            }
            .webui-bridge-action-column {
                grid-template-columns: 1fr;
            }
            .webui-bridge-toprow {
                flex-basis: auto;
                max-height: none;
            }
            .webui-bridge-tools {
                grid-template-columns: repeat(5, minmax(28px, 1fr));
            }
            .webui-bridge-prompt-row textarea {
                min-height: 52px;
            }
            .webui-bridge-extra-head {
                grid-template-columns: 1fr;
                align-items: stretch;
            }
            .webui-bridge-network-controls {
                grid-template-columns: 1fr;
                align-items: stretch;
            }
            .webui-bridge-extra-body {
                grid-template-columns: 1fr;
            }
            .webui-bridge-network-tree {
                max-height: 140px;
                border-right: 0;
                border-bottom: 1px solid #3e4654;
            }
            .webui-bridge-card-grid {
                grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
            }
        }
        .webui-bridge-card-name {
            display: -webkit-box;
            color: #f4f7fb;
            font: 700 13px/1.22 Consolas, monospace;
            overflow: hidden;
            overflow-wrap: anywhere;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
        }
        .webui-bridge-card-folder {
            display: block;
            color: #d4e2f3;
            opacity: .86;
            font-size: 11px;
            line-height: 1.25;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .webui-bridge-card-category {
            display: inline-flex;
            align-self: flex-start;
            max-width: 100%;
            padding: 2px 6px;
            border-radius: 4px;
            background: rgba(47, 115, 217, .72);
            color: #f4f8ff;
            font-size: 11px;
            line-height: 1.2;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .webui-bridge-card-desc {
            display: none;
            max-height: 42px;
            color: #edf4ff;
            opacity: .86;
            font-size: 11px;
            line-height: 1.2;
            overflow: hidden;
            overflow-wrap: anywhere;
        }
        .webui-bridge-card:hover .webui-bridge-card-desc {
            display: block;
        }
        .webui-bridge-lora-mask {
            position: fixed;
            inset: 0;
            z-index: 100002;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            box-sizing: border-box;
            background: rgba(0, 0, 0, .58);
        }
        .webui-bridge-lora-edit {
            width: min(1260px, 96vw);
            max-height: 92vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            border: 1px solid #3f4c61;
            border-radius: 8px;
            background: #0e141e;
            color: #f3f6fb;
            box-shadow: 0 18px 60px rgba(0, 0, 0, .55);
        }
        .webui-bridge-lora-edit-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 14px 18px;
            border-bottom: 1px solid #313b4c;
            background: #151d29;
        }
        .webui-bridge-lora-edit-title {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font-size: 18px;
            font-weight: 700;
        }
        .webui-bridge-lora-edit-head button {
            width: 30px;
            height: 30px;
            border: 1px solid #58657a;
            border-radius: 5px;
            background: #202a38;
            color: #fff;
            cursor: pointer;
        }
        .webui-bridge-lora-edit-body {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(280px, 370px);
            gap: 28px;
            padding: 20px;
            overflow: auto;
        }
        .webui-bridge-lora-edit-main {
            display: flex;
            flex-direction: column;
            gap: 14px;
            min-width: 0;
        }
        .webui-bridge-lora-edit-main label {
            display: flex;
            flex-direction: column;
            gap: 7px;
            color: #dce6f5;
            font-weight: 700;
        }
        .webui-bridge-lora-edit-textarea,
        .webui-bridge-lora-edit-input,
        .webui-bridge-lora-edit-weight {
            width: 100%;
            box-sizing: border-box;
            border: 1px solid #40506a;
            border-radius: 8px;
            background: #202b3a;
            color: #f3f6fb;
            padding: 10px 12px;
            font: 14px/1.45 Arial, sans-serif;
        }
        .webui-bridge-lora-edit-textarea,
        .webui-bridge-lora-edit-input {
            resize: vertical;
        }
        .webui-bridge-lora-edit-table {
            width: min(520px, 100%);
            display: flex;
            flex-direction: column;
            border-top: 1px solid rgba(220, 230, 245, .62);
        }
        .webui-bridge-lora-edit-table-row {
            display: grid;
            grid-template-columns: minmax(120px, 190px) minmax(0, 1fr);
            gap: 12px;
            padding: 8px 0;
            border-bottom: 1px solid rgba(220, 230, 245, .62);
            color: #edf3fb;
            font-size: 14px;
        }
        .webui-bridge-lora-edit-table-row span {
            min-width: 0;
            overflow-wrap: anywhere;
        }
        .webui-bridge-lora-category-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: center;
            gap: 10px;
        }
        .webui-bridge-lora-auto-category {
            max-width: 210px;
            padding: 7px 10px;
            border: 1px solid #40506a;
            border-radius: 6px;
            background: #111824;
            color: #a9bdd8;
            font-size: 13px;
            font-weight: 400;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .webui-bridge-lora-edit-preview {
            position: sticky;
            top: 0;
            height: 520px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border: 1px solid #4c5667;
            border-radius: 6px;
            background: #aeb3b4;
            color: #707d94;
            font-size: 44px;
            font-weight: 800;
            text-align: center;
            overflow: hidden;
        }
        .webui-bridge-lora-edit-preview img {
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: #aeb3b4;
        }
        .webui-bridge-lora-tags {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            padding: 12px;
            border: 1px solid #40506a;
            border-radius: 8px;
            background: #111824;
        }
        .webui-bridge-lora-tags:empty::before {
            content: "No training tags in metadata";
            color: #8fa0b7;
            font-weight: 400;
        }
        .webui-bridge-lora-tags button {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            min-height: 30px;
            border: 0;
            border-radius: 4px;
            background: #e9f7ff;
            color: #0f1722;
            cursor: pointer;
            font-size: 14px;
        }
        .webui-bridge-lora-tags button b {
            min-width: 22px;
            padding: 2px 5px;
            border-radius: 4px;
            background: #2885d9;
            color: #fff;
            font-size: 12px;
            text-align: center;
        }
        .webui-bridge-lora-weight-row {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) 130px;
            align-items: end;
        }
        .webui-bridge-lora-random-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
        }
        .webui-bridge-lora-random-head button,
        .webui-bridge-lora-edit-actions button {
            border: 1px solid #58657a;
            border-radius: 8px;
            background: #4a5668;
            color: #fff;
            cursor: pointer;
            font-weight: 700;
        }
        .webui-bridge-lora-random-head button {
            padding: 7px 14px;
        }
        .webui-bridge-lora-edit-actions {
            display: grid;
            grid-template-columns: repeat(3, minmax(160px, 1fr));
            gap: 18px;
            padding: 16px 20px 20px;
            border-top: 1px solid #313b4c;
        }
        .webui-bridge-lora-edit-actions button {
            min-height: 46px;
            font-size: 16px;
        }
        .webui-bridge-lora-random-head button:hover,
        .webui-bridge-lora-edit-actions button:hover {
            filter: brightness(1.08);
        }
        .webui-bridge-lora-edit-actions button.primary {
            border-color: #ff6b1a;
            background: #f36a16;
        }
        .webui-bridge-lora-edit-status {
            min-height: 20px;
            padding: 0 20px 14px;
            color: #f4d38c;
            opacity: 0;
        }
        .webui-bridge-lora-edit-status.visible {
            opacity: 1;
        }
        .webui-bridge-config-mask {
            position: fixed;
            inset: 0;
            z-index: 100003;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            box-sizing: border-box;
            background: rgba(0, 0, 0, .58);
        }
        .webui-bridge-config-panel {
            width: min(560px, calc(100vw - 48px));
            overflow: hidden;
            border: 1px solid #40506a;
            border-radius: 8px;
            background: #111824;
            color: #f3f6fb;
            box-shadow: 0 18px 60px rgba(0, 0, 0, .55);
        }
        .webui-bridge-config-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 14px;
            border-bottom: 1px solid #313b4c;
            background: #182234;
            font-weight: 700;
        }
        .webui-bridge-config-head button {
            width: 28px;
            height: 28px;
            border: 1px solid #58657a;
            border-radius: 5px;
            background: #202a38;
            color: #fff;
            cursor: pointer;
        }
        .webui-bridge-config-body {
            display: grid;
            gap: 10px;
            padding: 14px;
        }
        .webui-bridge-config-body label {
            display: grid;
            gap: 7px;
            color: #dce6f5;
            font-weight: 700;
        }
        .webui-bridge-config-body label.webui-bridge-config-check {
            display: flex;
            grid-template-columns: none;
            align-items: center;
            gap: 9px;
        }
        .webui-bridge-config-note {
            padding: 10px 12px;
            border: 1px solid #33435a;
            border-radius: 6px;
            background: #0d121b;
            color: #b9c9dd;
            font-size: 12px;
            line-height: 1.55;
        }
        .webui-bridge-prompt-settings .webui-bridge-config-actions {
            grid-template-columns: 1fr;
        }
        .webui-bridge-settings-panel .webui-bridge-config-actions {
            grid-template-columns: repeat(3, 1fr);
        }
        .webui-bridge-prompt-editor-mask {
            align-items: stretch;
            justify-content: stretch;
            padding: 0;
        }
        .webui-bridge-prompt-editor-panel {
            display: grid;
            grid-template-rows: auto minmax(0, 1fr) auto;
            width: 100vw;
            height: 100vh;
            border: 0;
            border-radius: 0;
        }
        .webui-bridge-prompt-editor-panel .webui-bridge-config-head {
            padding: 18px 24px;
        }
        .webui-bridge-prompt-editor-panel .webui-bridge-config-head button {
            width: 40px;
            height: 40px;
        }
        .webui-bridge-prompt-editor-panel .webui-bridge-config-body {
            min-height: 0;
            overflow: hidden;
            padding: 20px 24px;
            grid-template-rows: auto auto auto auto auto minmax(0, 1fr);
        }
        .webui-bridge-prompt-editor-panel .webui-bridge-config-actions {
            padding: 14px 24px 20px;
        }
        .webui-bridge-prompt-editor-panel .webui-bridge-custom-tags {
            max-height: none;
            min-height: 0;
        }
        .webui-bridge-prompt-editor-panel .webui-bridge-custom-tag-row {
            min-height: 44px;
            padding: 8px 10px;
        }
        .webui-bridge-startup {
            width: min(640px, calc(100vw - 48px));
        }
        .webui-bridge-startup-actions {
            grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        }
        .webui-bridge-startup-actions button {
            display: grid;
            gap: 8px;
            min-height: 106px;
            padding: 14px;
            border: 1px solid #40506a;
            border-radius: 8px;
            background: #172132;
            color: #edf4ff;
            text-align: left;
            cursor: pointer;
        }
        .webui-bridge-startup-actions button b {
            font-size: 15px;
        }
        .webui-bridge-startup-actions button span {
            color: #a9bdd8;
            font-size: 12px;
            line-height: 1.35;
        }
        .webui-bridge-startup-actions button:hover {
            border-color: #5d9bff;
            background: #1d2a40;
        }
        .webui-bridge-config-input {
            width: 100%;
            min-height: 36px;
            box-sizing: border-box;
            padding: 7px 10px;
            border: 1px solid #40506a;
            border-radius: 6px;
            background: #0d121b;
            color: #f3f6fb;
            font: 13px/1.4 Consolas, monospace;
        }
        .webui-bridge-config-row-actions {
            display: grid;
            grid-template-columns: 110px minmax(0, 1fr);
            gap: 10px;
            align-items: center;
            color: #a9bdd8;
            font-size: 12px;
        }
        .webui-bridge-config-row-actions button,
        .webui-bridge-ai-model-list button {
            min-height: 30px;
            border: 1px solid #58657a;
            border-radius: 6px;
            background: #263244;
            color: #fff;
            cursor: pointer;
            font-weight: 700;
        }
        .webui-bridge-ai-model-list {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            max-height: 150px;
            overflow: auto;
            padding-right: 2px;
        }
        .webui-bridge-ai-model-list button {
            max-width: 100%;
            min-height: 28px;
            padding: 4px 8px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            font: 11px/1.35 Consolas, monospace;
        }
        .webui-bridge-custom-editor {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
        }
        .webui-bridge-custom-editor button {
            min-height: 32px;
        }
        .webui-bridge-custom-filters {
            display: grid;
            grid-template-columns: minmax(0, 1.4fr) minmax(100px, .65fr) minmax(130px, .8fr) minmax(120px, 1fr) minmax(120px, 1fr);
            gap: 8px;
        }
        .webui-bridge-custom-tags {
            display: grid;
            gap: 6px;
            max-height: 320px;
            overflow: auto;
            padding-right: 2px;
        }
        .webui-bridge-custom-tag-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1.4fr) auto auto;
            gap: 6px;
            align-items: center;
            padding: 6px;
            border: 1px solid #33435a;
            border-radius: 6px;
            background: #0d121b;
            font-size: 11px;
        }
        .webui-bridge-custom-tag-row span,
        .webui-bridge-custom-tag-row b,
        .webui-bridge-custom-tag-row code {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .webui-bridge-custom-tag-row button {
            min-width: 28px;
            min-height: 26px;
        }
        .webui-bridge-prompt-market-list {
            display: grid;
            gap: 8px;
            max-height: 390px;
            overflow: auto;
            padding-right: 2px;
        }
        .webui-bridge-prompt-market-source {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 12px;
            align-items: center;
            padding: 10px;
            border: 1px solid #33435a;
            border-radius: 6px;
            background: #0d121b;
        }
        .webui-bridge-prompt-market-main {
            display: grid;
            gap: 5px;
            min-width: 0;
        }
        .webui-bridge-prompt-market-main b,
        .webui-bridge-prompt-market-main span,
        .webui-bridge-prompt-market-main code {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .webui-bridge-prompt-market-main span {
            color: #b9c9dd;
            font-size: 12px;
        }
        .webui-bridge-prompt-market-main code {
            color: #91d7a3;
            font-size: 11px;
        }
        .webui-bridge-prompt-market-actions {
            display: grid;
            grid-template-columns: 76px 92px;
            gap: 8px;
        }
        .webui-bridge-prompt-market-actions button {
            min-height: 32px;
            border: 1px solid #58657a;
            border-radius: 6px;
            background: #263244;
            color: #fff;
            cursor: pointer;
            font-weight: 700;
        }
        .webui-bridge-prompt-market-actions button:disabled {
            opacity: .62;
            cursor: default;
        }
        .webui-bridge-config-status {
            min-height: 20px;
            color: #a9bdd8;
            font-size: 12px;
            line-height: 1.45;
            overflow-wrap: anywhere;
        }
        .webui-bridge-config-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            padding: 0 14px 14px;
        }
        .webui-bridge-config-actions button {
            min-height: 38px;
            border: 1px solid #58657a;
            border-radius: 6px;
            background: #263244;
            color: #fff;
            cursor: pointer;
            font-weight: 700;
        }
        .webui-bridge-config-actions button.primary {
            border-color: #5d9bff;
            background: #2f73d9;
        }
        .webui-bridge-config-actions button:hover {
            filter: brightness(1.08);
        }
        .webui-bridge-config-actions button:disabled {
            opacity: .62;
            cursor: default;
            filter: none;
        }
        .webui-bridge-panel button,
        .webui-bridge-panel input,
        .webui-bridge-panel select,
        .webui-bridge-panel textarea,
        .webui-bridge-panel .webui-bridge-prompt-label,
        .webui-bridge-panel .webui-bridge-model-title,
        .webui-bridge-panel .webui-bridge-aio-new,
        .webui-bridge-panel .webui-bridge-status,
        .webui-bridge-panel .webui-bridge-card-title,
        .webui-bridge-panel .webui-bridge-card-trigger,
        .webui-bridge-panel .webui-bridge-card-meta,
        .webui-bridge-panel .webui-bridge-card-actions,
        .webui-bridge-panel .webui-bridge-network-count,
        .webui-bridge-panel .webui-bridge-model-count,
        .webui-bridge-panel .webui-bridge-backend-settings,
        .webui-bridge-panel .webui-bridge-config-status {
            font-size: var(--webui-bridge-font-size, 12px) !important;
        }
        .webui-bridge-panel .webui-bridge-model-mode,
        .webui-bridge-panel .webui-bridge-card-badge,
        .webui-bridge-panel .webui-bridge-card-weight,
        .webui-bridge-panel .webui-bridge-card-folder,
        .webui-bridge-panel .webui-bridge-tree-item,
        .webui-bridge-panel .webui-bridge-aio-fav-remove,
        .webui-bridge-panel .webui-bridge-custom-tag-row {
            font-size: var(--webui-bridge-font-size-small, 11px) !important;
        }
        @media (max-width: 900px) {
            .webui-bridge-startup-actions,
            .webui-bridge-settings-panel .webui-bridge-config-actions {
                grid-template-columns: 1fr;
            }
            .webui-bridge-prompt-market-source,
            .webui-bridge-prompt-market-actions,
            .webui-bridge-custom-editor,
            .webui-bridge-custom-filters {
                grid-template-columns: 1fr;
            }
            .webui-bridge-lora-edit-body {
                grid-template-columns: 1fr;
            }
            .webui-bridge-lora-edit-preview {
                position: relative;
                height: 360px;
                order: -1;
            }
            .webui-bridge-lora-edit-actions {
                grid-template-columns: 1fr;
            }
        }
        .webui-bridge-mask {
            position: fixed;
            inset: 0;
            z-index: 10000;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,.68);
        }
        .webui-bridge-large {
            width: min(1080px, calc(100vw - 48px));
            max-height: calc(100vh - 48px);
            display: flex;
            flex-direction: column;
            gap: 10px;
            padding: 14px;
            border: 1px solid #555b68;
            border-radius: 8px;
            background: #20242d;
        }
        .webui-bridge-large .webui-bridge-prompt-row textarea {
            min-height: 250px;
        }
        .webui-bridge-large-title {
            color: #fff;
            font-weight: 700;
        }
        .webui-bridge-large-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
        }
        .webui-bridge-large-actions button {
            min-width: 88px;
            padding: 8px 12px;
            border: 1px solid #5d6472;
            border-radius: 6px;
            background: #2f3440;
            color: #fff;
        }
        .webui-bridge-large-actions button.primary {
            border-color: #3273dc;
            background: #3273dc;
        }
    `;
    document.head.append(style);
}

app.registerExtension({
    name: "WebUI.PromptBridge.Frontend",
    init() {
        addStyles();
    },
    beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== TARGET_NODE) return;
        chainCallback(nodeType.prototype, "onNodeCreated", function () {
            this.color = "#2f3a4a";
            this.bgcolor = "#1b222d";
            this.__webuiBridgeFreshNode = true;
            scheduleBridgePanelInstall(this);
        });
        chainCallback(nodeType.prototype, "onConfigure", function () {
            this.__webuiBridgeWasConfigured = true;
            repairShiftedBridgeWidgets(this);
            scheduleBridgePanelInstall(this);
        });
        chainCallback(nodeType.prototype, "onDrawForeground", function () {
            if (isBridgePanelUsable(this)) return;
            const now = performance.now();
            if (now - (this.__webuiBridgeLastHealthInstall || 0) < 1000) return;
            this.__webuiBridgeLastHealthInstall = now;
            scheduleBridgePanelInstall(this);
        });
    },
});
