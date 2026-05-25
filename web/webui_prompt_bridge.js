import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

const TARGET_NODE = "WebUIPromptBridge";
const PROMPT_WIDGETS = new Set(["positive_prompt", "negative_prompt", "default_clip_strength", "fail_on_missing_lora"]);
const EXTRA_SEPARATOR = ", ";
const ATTENTION_STEP = 0.1;
const EXTRA_STEP = 0.05;
const WORD_DELIMITERS = ",;，；、\n\r\t";
const DEFAULT_PANEL_WIDTH = 1180;
const DEFAULT_PANEL_HEIGHT = 1040;
const LEGACY_PANEL_WIDTH = 1280;
const LEGACY_PANEL_HEIGHT = 1120;
const PANEL_MIN_WIDTH = 760;
const PANEL_MAX_WIDTH = 1600;
const PANEL_MIN_HEIGHT = 620;
const DOM_WIDGET_LAYOUT_PAD = 58;
const SPLIT_ANIMA_MODEL_VALUE = "__webui_bridge_split_anima_qwen__";
const SPLIT_ANIMA_MODEL_LABEL = "分体 Anima/Qwen（Anima UNET + Text Encoder + VAE）";
const DEFAULT_QUALITY_TAGS = [
    "masterpiece",
    "best quality",
    "very aesthetic",
    "anime style",
];
const DEFAULT_NEGATIVE_PROMPT = "worst quality, low quality, lowres, blurry, bad anatomy, bad hands, extra fingers, extra legs, bad feet, malformed feet, text, watermark, artist name, jpeg artifacts, deformed, ugly face";
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

function getWidget(node, name) {
    return node?.widgets?.find((widget) => widget.name === name);
}

function clampPanelSize(width, height) {
    const nextHeight = Math.max(PANEL_MIN_HEIGHT, Math.round(height || DEFAULT_PANEL_HEIGHT));
    const ratioWidth = Math.ceil(nextHeight * 0.78);
    const nextWidth = Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, Math.round(width || DEFAULT_PANEL_WIDTH), ratioWidth));
    return [nextWidth, nextHeight];
}

function looksLikeLegacyDefaultSize(size) {
    return Array.isArray(size) &&
        Math.abs(Number(size[0] || 0) - LEGACY_PANEL_WIDTH) <= 8 &&
        Math.abs(Number(size[1] || 0) - LEGACY_PANEL_HEIGHT) <= 8;
}

function hideWidget(widget) {
    if (!widget || widget.__webuiBridgeHidden) return;
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

function resolveLora(state, requested) {
    const key = normalizeLoraName(requested);
    return (state.loras || []).find((item) => (
        normalizeLoraName(item.name) === key ||
        normalizeLoraName(item.alias) === key ||
        normalizeLoraName(item.name).endsWith(`/${key}`)
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
    if (item.thumbnail) return "有预览图";
    if (item.activation_text) return "有触发词";
    if (item.description || item.notes) return "有说明";
    return "待整理";
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

function normalizeAttentionValue(value) {
    const raw = String(value || "").trim();
    const weighted = raw.match(/^\((.*):(-?\d+(?:\.\d+)?)\)$/s);
    if (weighted) return { body: weighted[1].trim(), weight: Number(weighted[2]) };
    return { body: raw.replace(/^\(+|\)+$/g, "").replace(/^\[+|\]+$/g, "").trim(), weight: 1 };
}

function setTagNumericWeight(value, weight) {
    const parsed = normalizeAttentionValue(value);
    const rounded = Math.round(Number(weight || 1) * 100) / 100;
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
    while (text.startsWith(open) && text.endsWith(close)) text = text.slice(1, -1).trim();
    const count = Math.max(0, delta);
    return `${open.repeat(count)}${text}${close.repeat(count)}`;
}

function favoriteForPrompt(state, kind, prompt) {
    const target = String(prompt || "").trim();
    return (state.promptAllInOne?.favorites?.[kind] || []).find((item) => String(item.prompt || "").trim() === target);
}

async function refreshFavoritesFromResult(state, result) {
    if (result?.favorites) state.promptAllInOne.favorites = result.favorites;
}

function renderPromptChips(row, textarea, state, afterChange, kind = "positive") {
    const chips = row.chips;
    if (!chips) return;
    const localMap = buildLocalTagMap(state);
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
            local = resolved ? `LoRA已匹配: ${resolved.alias || resolved.name}` : "LoRA未找到";
            className += resolved ? " lora found" : " lora missing";
            title = resolved
                ? `${tag.value}\n生成时会由 WebUIPromptBridge 后端应用: ${resolved.name}`
                : `${tag.value}\n未在 ComfyUI loras 目录找到，fail_on_missing_lora 开启时会报错`;
        } else if (!local && /[\u3400-\u9fff]/.test(tag.value)) {
            local = "可点“英”翻译为 Anima tag";
        }
        if (tag.disabled) {
            className += " disabled";
            title = `${tag.value}\n已禁用，不会写入生成提示词`;
        }
        const favorite = favoriteForPrompt(state, kind, tag.value);
        const chip = el("div", {
            class: className,
            title,
            draggable: tag.disabled ? "false" : "true",
            onmouseenter: () => {
                window.clearTimeout(chip.__webuiBridgeHideToolsTimer);
                chip.classList.add("show-tools");
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
            },
            ondragstart: (event) => {
                if (tag.disabled || event.target.closest(".webui-bridge-chip-tools")) {
                    event.preventDefault();
                    return;
                }
                window.clearTimeout(row.__webuiBridgeClickTimer);
                row.__webuiBridgeDragging = { fromIndex: tag.index };
                chip.classList.add("dragging");
                chips.classList.add("drag-active");
                event.dataTransfer.effectAllowed = "move";
                event.dataTransfer.setData("text/plain", String(tag.index));
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
                if (movePromptTagAt(textarea, row.__webuiBridgeDragging.fromIndex, toIndex)) afterChange?.();
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
        const tools = el("div", { class: "webui-bridge-chip-tools" }, [
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
        if (lora && resolveLora(state, lora.name)) {
            fetchLoraInfo(lora.name).then((info) => {
                if (!info || !chip.isConnected) return;
                const localNode = chip.querySelector(".webui-bridge-chip-local");
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

async function loadBridgeData() {
    const [lorasRes, stylesRes, promptAllInOneRes, modelsRes, webuiRes] = await Promise.allSettled([
        api.fetchApi("/webui_prompt_bridge/loras", { cache: "no-store" }).then((r) => r.json()),
        api.fetchApi("/webui_prompt_bridge/styles", { cache: "no-store" }).then((r) => r.json()),
        api.fetchApi("/webui_prompt_bridge/prompt_all_in_one?lang=zh_CN", { cache: "no-store" }).then((r) => r.json()),
        api.fetchApi("/webui_prompt_bridge/models", { cache: "no-store" }).then((r) => r.json()),
        api.fetchApi("/webui_prompt_bridge/webui_integration", { cache: "no-store" }).then((r) => r.json()),
    ]);
    return {
        loras: lorasRes.status === "fulfilled" ? lorasRes.value.loras || [] : [],
        styles: stylesRes.status === "fulfilled" ? stylesRes.value.styles || [] : [],
        promptAllInOne: promptAllInOneRes.status === "fulfilled" ? promptAllInOneRes.value : { group_tags: [], favorites: {} },
        models: modelsRes.status === "fulfilled" ? modelsRes.value : { checkpoints: [], unets: [], clips: [], vaes: [] },
        webuiIntegration: webuiRes.status === "fulfilled" ? webuiRes.value : null,
    };
}

function getGraphNodes() {
    return app.graph?._nodes || [];
}

function getGraphNodeById(id) {
    return app.graph?.getNodeById?.(id) || getGraphNodes().find((graphNode) => String(graphNode.id) === String(id));
}

function getGraphLink(linkId) {
    const links = app.graph?.links || app.graph?._links;
    if (!links || linkId === undefined || linkId === null) return null;
    if (Array.isArray(links)) return links.find((link) => String(link?.id ?? link?.[0]) === String(linkId));
    return links[linkId] || links[String(linkId)] || null;
}

function linkOriginId(link) {
    return link?.origin_id ?? link?.originId ?? link?.[1];
}

function linkOriginSlot(link) {
    return link?.origin_slot ?? link?.originSlot ?? link?.[2] ?? 0;
}

function graphLinkId(link) {
    return link?.id ?? link?.[0];
}

function findInputSlot(node, name) {
    return node?.findInputSlot?.(name) ?? (node?.inputs || []).findIndex((input) => input.name === name);
}

function findOutputSlot(node, name, fallback = 0) {
    const slot = node?.findOutputSlot?.(name) ?? (node?.outputs || []).findIndex((output) => output.name === name || output.type === name);
    return slot >= 0 ? slot : fallback;
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
    app.graph.links = app.graph.links || {};
    app.graph.links[id] = link;
    if (app.graph._links) app.graph._links[id] = link;
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
    if (linkId === undefined || linkId === null || getGraphLink(linkId)) return false;
    const reference = findOutputReferenceToLink(linkId);
    if (!reference) return false;
    return writeGraphLink(linkId, reference.source, reference.outputSlot, node, inputSlot, input.type || reference.output?.type);
}

function isWidgetBackedInput(input) {
    return Boolean(input?.widget?.name || input?.widget || input?.type === "INT" || input?.type === "FLOAT" || input?.type === "BOOLEAN" || input?.type === "STRING");
}

function repairStaleInputLinks() {
    let repaired = 0;
    for (const graphNode of getGraphNodes()) {
        for (let slot = 0; slot < (graphNode.inputs || []).length; slot += 1) {
            const input = graphNode.inputs[slot];
            if (input.link === undefined || input.link === null) continue;
            const link = getGraphLink(input.link);
            if (link && String(link?.target_id ?? link?.targetId ?? link?.[3]) === String(graphNode.id)) continue;
            if (restoreMissingInputLink(graphNode, slot)) {
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
        graphNode.type === "ImpactBoolean" &&
        /模型模式|模型来源|分体|anima|model mode|model source|checkpoint/i.test(`${graphNode.title || ""} ${graphNode.properties?.["Node name for S&R"] || ""}`)
    ));
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
    return {
        changed: changed > 0,
        message: changed ? "已切回分体 Anima/Qwen 模式" : "当前工作流没有可恢复的分体模型接线",
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
        popup.style.left = `${Math.round(rect.left)}px`;
        popup.style.top = `${Math.round(rect.bottom + 4)}px`;
        popup.style.minWidth = `${Math.max(260, Math.round(rect.width))}px`;
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

function createPromptRow(label, value, placeholder, onFocus, onInput) {
    const textarea = el("textarea", {
        spellcheck: "false",
        placeholder,
        onfocus: (event) => onFocus(event.currentTarget),
        oninput: (event) => onInput(event.currentTarget),
    });
    textarea.value = value || "";
    const counter = el("div", { class: "webui-bridge-token-counter" }, "0/75");
    const row = el("div", { class: "webui-bridge-prompt-row" }, [
        el("div", { class: "webui-bridge-prompt-label" }, label),
        textarea,
        el("div", { class: "webui-bridge-prompt-chips empty" }),
        counter,
    ]);
    row.chips = row.querySelector(".webui-bridge-prompt-chips");
    return { row, textarea, counter };
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
    const children = [
        el("span", { class: "webui-bridge-aio-local" }, label || prompt),
        el("span", { class: "webui-bridge-aio-en" }, prompt),
    ];
    if (tag.favoriteItem && tag.id && state) {
        children.push(el("span", {
            class: "webui-bridge-aio-fav-remove",
            title: "从收藏中移除",
            onclick: async (event) => {
                event.stopPropagation();
                const kind = isNegative ? "negative" : "positive";
                const result = await updatePromptAllInOneStorage("delete_favorite", kind, prompt, "", tag.id);
                await refreshFavoritesFromResult(state, result);
                rerender?.();
            },
        }, "×"));
    }
    const button = el("button", {
        class: "webui-bridge-aio-tag",
        title: label && label !== prompt ? `${label}\n${prompt}` : prompt,
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
    const query = el("input", { class: "webui-bridge-aio-new", placeholder: "请输入新关键词" });
    const autoLoad = el("input", { type: "checkbox", checked: "checked", title: "自动加载提示词" });
    const autoTranslate = el("input", { type: "checkbox", checked: "checked", title: "自动翻译为 Anima 英文 tag" });
    const showInput = el("input", { type: "checkbox", title: "显示默认输入框" });
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
        const tags = await resolveKeywordInput(value, autoTranslate.checked);
        for (const tag of tags) {
            if (!tag.prompt || tag.prompt === "\n") continue;
            await updatePromptAreaWithLoraKeywords(textarea, tag.prompt, isNegative, sync, (message) => {
                hint.textContent = message;
            }, { toggle: false });
        }
        hint.textContent = tags.length
            ? `已加入: ${tags.map((tag) => tag.prompt).join(", ")}`
            : "";
        query.value = "";
        closeAppendMenu();
        sync();
        render();
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
    const translateAll = async () => {
        const value = textarea.value.trim();
        if (!value) return;
        try {
            const translated = await translatePromptAllInOne(value, "english");
            setTextareaValue(textarea, translated.prompt || value);
            hint.textContent = translated.matched
                ? `已翻译 ${translated.matched} 个关键词`
                : "未匹配本地关键词组，保留原文";
            sync();
            render();
        } catch (error) {
            hint.textContent = "整段翻译失败";
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
    root.append(header, tabs, subTabs, appendRow, body, hint, colorRow);

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
        const extraGroup = {
            name: "扩展模型",
            type: "extraNetworks",
            groups: [{
                name: "Lora",
                tags: state.loras.map((item) => ({ prompt: item.prompt, local: item.alias })),
            }],
        };
        const sourceGroups = (state.promptAllInOne?.group_tags || []).filter((group) => {
            if (kind === "negative") return group.name === "反向提示词";
            return group.name !== "反向提示词";
        });
        groups = [...sourceGroups, favoriteGroup, extraGroup];
        if (kind === "negative") {
            const negIndex = groups.findIndex((group) => group.name === "反向提示词");
            if (negIndex >= 0) activeGroup = negIndex;
        }
        activeGroup = Math.min(activeGroup, Math.max(groups.length - 1, 0));
        activeSubGroup = Math.min(activeSubGroup, Math.max((groups[activeGroup]?.groups || []).filter((g) => g.type !== "wrap").length - 1, 0));
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
    const state = {
        activeTextarea: null,
        loras: [],
        styles: [],
        models: { checkpoints: [], unets: [], clips: [], vaes: [] },
        webuiIntegration: null,
        promptAllInOne: { group_tags: [], favorites: {} },
        selectedStyles: new Set(),
        loraFolder: "__all",
        loraSort: "path",
        loraSortDescending: false,
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
        if (!/[\u3400-\u9fff]/.test(textarea.value || "")) return;
        window.clearTimeout(textarea.__webuiBridgeAutoTranslateTimer);
        textarea.__webuiBridgeAutoTranslateTimer = window.setTimeout(async () => {
            if (textarea.__webuiBridgeComposing || !/[\u3400-\u9fff]/.test(textarea.value || "")) return;
            const before = textarea.value;
            try {
                textarea.__webuiBridgeAutoTranslating = true;
                const translated = await translatePromptAllInOne(before, "english");
                const next = translated.prompt || before;
                if (translated.matched && next && next !== before) {
                    setTextareaValue(textarea, next);
                    setStatus(`已自动翻译 ${translated.matched} 个关键词`);
                    sync();
                    positiveTagPanel.__webuiBridgeRender?.();
                    negativeTagPanel.__webuiBridgeRender?.();
                }
            } catch {
                setStatus("自动翻译失败");
            } finally {
                textarea.__webuiBridgeAutoTranslating = false;
            }
        }, 520);
    };

    const onInput = (textarea) => {
        clearPromptPlacementWarning();
        if (textarea.__webuiBridgeAutoTranslating) {
            sync();
            return;
        }
        sync();
        scheduleAutoTranslateInput(textarea);
    };

    const positive = createPromptRow(
        "Prompt",
        positiveWidget?.value,
        "Prompt\nCtrl+Up/Down edits attention, Alt+Left/Right moves comma tags",
        onFocus,
        onInput,
    );
    const negative = createPromptRow(
        "Negative prompt",
        negativeWidget?.value,
        "Negative prompt",
        onFocus,
        onInput,
    );
    state.activeTextarea = positive.textarea;
    positive.row.classList.add("active");
    for (const textarea of [positive.textarea, negative.textarea]) {
        textarea.addEventListener("compositionstart", () => {
            textarea.__webuiBridgeComposing = true;
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
        value: clipStrengthWidget?.value ?? 1,
        title: "Default LoRA CLIP strength when tag has no third value",
        oninput: (event) => {
            event.currentTarget.classList.remove("error");
            const value = event.currentTarget.value;
            setWidgetValue(node, "default_clip_strength", value.trim() === "" ? "" : Number(value));
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

    const refreshBridgeData = async () => {
        const data = await loadBridgeData();
        state.loras = data.loras;
        state.styles = data.styles;
        state.models = data.models;
        state.webuiIntegration = data.webuiIntegration;
        state.promptAllInOne = data.promptAllInOne;
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
        return info?.webui_root ? `WebUI: ${info.webui_root} (${ok}/${total})` : "WebUI: 未接入";
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
        const close = () => mask.remove();
        const renderInfo = (info) => {
            state.webuiIntegration = info;
            rootInput.value = info?.webui_root || rootInput.value || info?.guesses?.[0] || "";
            guessSelect.innerHTML = "";
            guessSelect.append(el("option", { value: "" }, "自动检测到的 WebUI 目录"));
            for (const guess of info?.guesses || []) guessSelect.append(el("option", { value: guess }, guess));
            statusLine.textContent = webuiStatusText(info);
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
                await refreshBridgeData();
                setStatus(`已接入 WebUI：${info.webui_root}`, { kind: "success" });
                statusLine.textContent = `${webuiStatusText(info)}；已刷新提示词、样式、LoRA 和模型列表`;
            } catch (error) {
                statusLine.textContent = `接入失败: ${error?.message || error}`;
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

    const renderCards = () => {
        const q = networkSearch.value.trim().toLowerCase();
        const filter = state.loraFolder || "__all";
        const filtered = sortLoras(state.loras.filter((item) => (
            loraMatchesFilter(item, filter) &&
            loraMatchesQuery(item, q)
        )), state.loraSort, state.loraSortDescending);
        const visible = filtered.slice(0, 160);
        cards.innerHTML = "";
        networkCount.textContent = `${filtered.length}${filtered.length > visible.length ? ` / showing ${visible.length}` : ""}`;
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
                class: "webui-bridge-card",
                title: item.name,
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
                item.thumbnail
                    ? el("img", { class: "webui-bridge-card-preview", src: item.thumbnail, alt: "", loading: "lazy" })
                    : el("span", { class: "webui-bridge-card-preview webui-bridge-card-preview-empty" }, [
                        el("span", {}, "NO"),
                        el("span", {}, "PREVIEW"),
                    ]),
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
                    el("span", { class: "webui-bridge-card-folder" }, folderLabel),
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
        el("button", { title: "Fit default size", onclick: () => setNodeSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT) }, "Fit"),
    ]);
    const makeNetworkSortButton = (key, label, title) => el("button", {
        class: `webui-bridge-network-tool${state.loraSort === key ? " active" : ""}`,
        title,
        onclick: (event) => {
            state.loraSort = key;
            for (const button of event.currentTarget.parentElement.querySelectorAll(".webui-bridge-network-tool[data-sort]")) {
                button.classList.toggle("active", button.dataset.sort === key);
            }
            renderCards();
        },
        "data-sort": key,
    }, label);
    const networkControls = el("div", { class: "webui-bridge-network-controls" }, [
        networkSearch,
        el("span", { class: "webui-bridge-network-sort-label" }, "Sort"),
        makeNetworkSortButton("path", "Path", "Sort by folder path"),
        makeNetworkSortButton("name", "Name", "Sort by LoRA name"),
        makeNetworkSortButton("modified", "Date", "Sort by modified time"),
        el("button", {
            class: "webui-bridge-network-tool",
            title: "Reverse sort direction",
            onclick: (event) => {
                state.loraSortDescending = !state.loraSortDescending;
                event.currentTarget.classList.toggle("active", state.loraSortDescending);
                renderCards();
            },
        }, "↓"),
        networkCount,
    ]);
    const resizeGrip = el("div", { class: "webui-bridge-resize-grip", title: "Drag to resize this node" }, "↘");
    installResizeDrag(resizeGrip);

    const panel = el("div", { class: "webui-bridge-panel" }, [
        el("div", { class: "webui-bridge-toprow" }, [
            el("div", { class: "webui-bridge-prompts" }, [
                positive.row,
                positiveTagPanel,
                negative.row,
                negativeTagPanel,
            ]),
            el("div", { class: "webui-bridge-action-column" }, [
                el("button", { class: "webui-bridge-generate", title: "Queue Prompt", onclick: queuePrompt }, "Generate"),
                status,
                modelSwitchControls,
                animaModeControls,
                sizeControls,
                toolbar,
                el("div", { class: "webui-bridge-backend-settings" }, [
                    el("button", {
                        class: "webui-bridge-config-button",
                        type: "button",
                        title: "只填写 WebUI 根目录，自动接入 Prompt All in One、TagComplete、styles、LoRA 和模型目录",
                        onclick: showWebUIIntegrationDialog,
                    }, "一键接入 WebUI"),
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
        ]),
        el("div", { class: "webui-bridge-extra webui-bridge-extra-compact" }, [
            el("div", { class: "webui-bridge-extra-head" }, [
                el("span", {}, "Extra Networks"),
                networkControls,
            ]),
            el("div", { class: "webui-bridge-extra-body" }, [
                networkTree,
                networkPane,
            ]),
        ]),
        resizeGrip,
    ]);
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
    networkSearch.addEventListener("input", renderCards);
    modelSelect.addEventListener("change", applySelectedModel);
    styleSelect.addEventListener("change", () => {
        styleName.value = styleSelect.selectedOptions[0]?.value || "";
    });

    loadBridgeData().then((data) => {
        state.loras = data.loras;
        state.styles = data.styles;
        state.models = data.models;
        state.promptAllInOne = data.promptAllInOne;
        renderStyles();
        renderModelSwitch();
        renderTree();
        renderCards();
        importUpstreamLoras();
        updateCounters();
        positiveTagPanel.__webuiBridgeRender?.();
        negativeTagPanel.__webuiBridgeRender?.();
    });

    renderModelSwitch();
    importUpstreamLoras();
    updateCounters();
    panel.__webuiBridgeImportUpstreamLoras = () => {
        const added = importUpstreamLoras();
        if (added) updateCounters();
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
    if (!node.__webuiBridgeDesiredSize) {
        node.__webuiBridgeDesiredSize = node.__webuiBridgeFreshNode && !node.__webuiBridgeWasConfigured
            ? clampPanelSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT)
            : looksLikeLegacyDefaultSize(node.size)
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
        getMinHeight: () => 420,
        getMaxHeight: () => 100000,
    });
    if (Array.isArray(node.widgets)) {
        const index = node.widgets.indexOf(domWidget);
        if (index > 0) {
            node.widgets.splice(index, 1);
            node.widgets.unshift(domWidget);
        }
    }
    domWidget.y = 0;
    domWidget.last_y = 0;
    const applyDomWidgetSize = (nodeWidth, nodeHeight) => {
        const widgetWidth = Math.max(720, nodeWidth - 20);
        const widgetTop = Number.isFinite(domWidget.y) && domWidget.y > 0 ? domWidget.y : 92;
        const widgetHeight = Math.max(420, nodeHeight - widgetTop - DOM_WIDGET_LAYOUT_PAD);
        panel.style.width = `${widgetWidth}px`;
        panel.style.height = `${widgetHeight}px`;
        return [widgetWidth, widgetHeight];
    };
    domWidget.computeSize = (width) => {
        const desired = node.__webuiBridgeDesiredSize || node.size || [width || 1040, 820];
        const nodeWidth = desired[0] || width || 1040;
        const nodeHeight = desired[1] || 820;
        return applyDomWidgetSize(nodeWidth, nodeHeight);
    };
    applyDomWidgetSize(node.__webuiBridgeDesiredSize[0], node.__webuiBridgeDesiredSize[1]);
    node.__webuiBridgePanel = panel;
    node.resizable = true;
    if (node.__webuiBridgeFreshNode && !node.__webuiBridgeWasConfigured && !node.__webuiBridgeFreshSizeApplied) {
        node.__webuiBridgeDesiredSize = clampPanelSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT);
        node.__webuiBridgeFreshSizeApplied = true;
        node.setSize(node.__webuiBridgeDesiredSize);
    } else if (looksLikeLegacyDefaultSize(node.size)) {
        node.__webuiBridgeDesiredSize = clampPanelSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT);
        node.setSize(node.__webuiBridgeDesiredSize);
    } else if (!node.size || node.size[0] < 840 || node.size[1] < 620) {
        node.__webuiBridgeDesiredSize = clampPanelSize(Math.max(node.size?.[0] || DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_WIDTH), Math.max(node.size?.[1] || DEFAULT_PANEL_HEIGHT, DEFAULT_PANEL_HEIGHT));
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
            min-height: 620px;
            padding: 8px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 8px;
            background: #20242d;
            color: #f2f4f8;
            font-family: Arial, sans-serif;
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
            flex: 0 1 54%;
            min-height: 0;
            max-height: none;
            overflow: hidden;
        }
        .webui-bridge-prompts {
            display: grid;
            grid-template-rows: auto minmax(150px, 1.15fr) auto minmax(120px, .85fr);
            gap: 8px;
            min-width: 0;
            min-height: 0;
            overflow: hidden auto;
        }
        .webui-bridge-prompt-row {
            position: relative;
            display: flex;
            flex-direction: column;
            border: 1px solid #3e4654;
            border-radius: 6px;
            background: #171a20;
            overflow: hidden;
        }
        .webui-bridge-prompt-row.has-chips {
            min-height: 132px;
        }
        .webui-bridge-prompt-row.active {
            border-color: #6aa3ff;
        }
        .webui-bridge-prompt-row.prompt-placement-error {
            border-color: #d84a4a;
            box-shadow: 0 0 0 1px rgba(216, 74, 74, .35);
        }
        .webui-bridge-prompt-label {
            padding: 5px 8px;
            color: #cbd4e1;
            font-size: 12px;
            background: #252a34;
            border-bottom: 1px solid #3e4654;
        }
        .webui-bridge-prompt-row textarea {
            width: 100%;
            flex: 0 0 auto;
            min-height: 48px;
            max-height: 118px;
            padding: 9px 56px 9px 9px;
            box-sizing: border-box;
            border: 0;
            resize: vertical;
            background: #111318;
            color: #f2f4f8;
            font: 12px/1.45 Consolas, Monaco, monospace;
            outline: none;
        }
        .webui-bridge-prompt-row textarea.error {
            box-shadow: inset 0 0 0 1px #d84a4a;
        }
        .webui-bridge-prompt-chips {
            display: flex;
            flex: 0 0 auto;
            gap: 8px;
            padding: 8px 8px 38px;
            min-height: 56px;
            max-height: 126px;
            overflow: auto;
            flex-wrap: wrap;
            border-top: 1px solid #2d3542;
            background: #151922;
        }
        .webui-bridge-prompt-chips.empty {
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
            z-index: 20;
            left: -1px;
            top: calc(100% + 2px);
            display: none;
            align-items: center;
            gap: 2px;
            padding: 3px;
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
        .webui-bridge-prompt-chip.show-tools .webui-bridge-chip-tools,
        .webui-bridge-prompt-chip:hover .webui-bridge-chip-tools {
            display: flex;
        }
        .webui-bridge-chip-tool {
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
            flex: 1 1 auto;
            display: flex;
            flex-direction: column;
        }
        .webui-bridge-aio-positive {
            min-height: 150px;
            height: auto;
        }
        .webui-bridge-aio-negative {
            min-height: 120px;
            height: auto;
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
        }
        .webui-bridge-aio-append {
            position: relative;
            display: grid;
            grid-template-columns: minmax(0, 1fr) 28px;
            gap: 6px;
            padding: 6px 8px;
            border-bottom: 1px solid #263243;
            background: #0b1018;
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
            border: 1px solid #39475c;
            border-radius: 4px;
            background: #090d14;
            color: #f2f4f8;
            font-size: 12px;
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
            min-height: 30px;
            border-bottom: 1px solid #2d3542;
        }
        .webui-bridge-aio-subtabs {
            background: #141a24;
            min-height: 28px;
        }
        .webui-bridge-aio-tabs button,
        .webui-bridge-aio-subtabs button {
            flex: 0 0 auto;
            min-height: 28px;
            padding: 4px 10px;
            border: 0;
            border-right: 1px solid #2d3542;
            background: transparent;
            color: #d6deec;
            cursor: pointer;
            font-size: 12px;
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
            gap: 6px;
            flex: 1 1 auto;
            min-height: 0;
            padding: 8px;
            overflow: auto;
        }
        .webui-bridge-aio-positive .webui-bridge-aio-body {
            min-height: 0;
        }
        .webui-bridge-aio-negative .webui-bridge-aio-body {
            min-height: 0;
        }
        .webui-bridge-aio-tag {
            position: relative;
            height: 38px;
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
            height: 20px;
            padding: 2px 6px;
            box-sizing: border-box;
            text-align: center;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .webui-bridge-aio-local {
            background: #5d5b3d;
            color: #fffbd0;
            font-size: 12px;
        }
        .webui-bridge-aio-en {
            color: #cbd3df;
            font-size: 11px;
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
            min-height: 220px;
            flex: 1 1 46%;
            max-height: none;
            display: flex;
            flex-direction: column;
            border: 1px solid #3e4654;
            border-radius: 6px;
            overflow: hidden;
            background: #171a20;
        }
        .webui-bridge-extra-compact {
            min-height: 220px;
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
            display: grid;
            grid-template-columns: minmax(180px, 1fr) auto repeat(4, minmax(34px, auto)) auto;
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
        .webui-bridge-network-tool:hover,
        .webui-bridge-network-tool.active {
            border-color: #6aa3ff;
            background: #24466f;
        }
        .webui-bridge-extra-body {
            display: grid;
            grid-template-columns: minmax(170px, 230px) minmax(0, 1fr);
            min-height: 0;
            flex: 1 1 auto;
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
            flex: 1 1 auto;
            scrollbar-width: thin;
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
            padding: 8px;
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
        .webui-bridge-ac-local {
            grid-column: 1;
            color: #91b2c9;
            font-size: 11px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .webui-bridge-ac-count {
            grid-column: 2;
            grid-row: 1 / span 2;
            align-self: center;
            color: #8c97a6;
            font-size: 13px;
            white-space: nowrap;
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
            .webui-bridge-prompts {
                grid-template-rows: auto minmax(190px, 1fr) auto minmax(160px, .85fr);
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
        @media (max-width: 900px) {
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
