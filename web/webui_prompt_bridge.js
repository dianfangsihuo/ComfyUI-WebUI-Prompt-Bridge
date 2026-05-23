import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

const TARGET_NODE = "WebUIPromptBridge";
const PROMPT_WIDGETS = new Set(["positive_prompt", "negative_prompt", "default_clip_strength", "fail_on_missing_lora"]);
const EXTRA_SEPARATOR = ", ";
const ATTENTION_STEP = 0.1;
const EXTRA_STEP = 0.05;
const WORD_DELIMITERS = ",;，；、\n\r\t";
const DEFAULT_QUALITY_TAGS = [
    "masterpiece",
    "best quality",
    "very aesthetic",
    "anime style",
];
const DEFAULT_NEGATIVE_PROMPT = "worst quality, low quality, lowres, blurry, bad anatomy, bad hands, extra fingers, extra legs, bad feet, malformed feet, text, watermark, artist name, jpeg artifacts, deformed, ugly face";
const ANIMA_FAST_LORAS = [
    { name: "anima_p3_rdbt_v0.29.b.122", weight: 0.8 },
    { name: "anima-highres-aesthetic-boost", weight: 0.55 },
];
const ANIMA_FAST_LORA_PATTERN = /<\s*(?:lora|lyco)\s*:\s*(?:[^>]*\/)?(?:anima_p3_rdbt_v0\.29\.b\.122|anima-highres-aesthetic-boost)(?:\.[a-z0-9]+)?(?:\s*:[^>]*)?>\s*,?\s*/gi;

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
    return node.widgets?.find((widget) => widget.name === name);
}

function hideWidget(widget) {
    if (!widget || widget.__webuiBridgeHidden) return;
    widget.__webuiBridgeHidden = true;
    widget.origComputeSize = widget.computeSize;
    widget.computeSize = () => [0, -4];
    widget.hidden = true;
    widget.type = `WEBUI_BRIDGE_HIDDEN_${widget.name}`;
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
                if (info.warning) {
                    chip.classList.add("warning");
                    localNode.textContent = `可能不兼容: ${info.family || "unknown"}`;
                    chip.title = `${tag.value}\n${info.warning}\nbase=${info.base_model || "unknown"}\nmodule=${info.network_module || "unknown"}`;
                } else if (info.family && info.family !== "unknown") {
                    localNode.textContent = `${info.family} LoRA${info.trigger_words?.length ? `: ${info.trigger_words.slice(0, 3).join(", ")}` : ""}`;
                    chip.title = `${tag.value}\nbase=${info.base_model || info.family}\ntrigger=${(info.trigger_words || []).join(", ")}`;
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
    const [lorasRes, stylesRes, promptAllInOneRes] = await Promise.allSettled([
        api.fetchApi("/webui_prompt_bridge/loras", { cache: "no-store" }).then((r) => r.json()),
        api.fetchApi("/webui_prompt_bridge/styles", { cache: "no-store" }).then((r) => r.json()),
        api.fetchApi("/webui_prompt_bridge/prompt_all_in_one?lang=zh_CN", { cache: "no-store" }).then((r) => r.json()),
    ]);
    return {
        loras: lorasRes.status === "fulfilled" ? lorasRes.value.loras || [] : [],
        styles: stylesRes.status === "fulfilled" ? stylesRes.value.styles || [] : [],
        promptAllInOne: promptAllInOneRes.status === "fulfilled" ? promptAllInOneRes.value : { group_tags: [], favorites: {} },
    };
}

function getGraphNodes() {
    return app.graph?._nodes || [];
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

function findFirstNode(types) {
    return getGraphNodes().find((graphNode) => types.includes(graphNode.type));
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

function promptContains(text, prompt) {
    if (!prompt) return false;
    return (text || "").toLowerCase().includes(prompt.toLowerCase());
}

function promptHasExactTag(text, prompt) {
    const target = String(prompt || "").trim().toLowerCase();
    if (!target) return false;
    return splitPromptTags(text).some((tag) => tag.value.trim().toLowerCase() === target);
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
        promptAllInOne: { group_tags: [], favorites: {} },
        selectedStyles: new Set(),
    };

    const sync = () => {
        setWidgetValue(node, "positive_prompt", positive.textarea.value);
        setWidgetValue(node, "negative_prompt", negative.textarea.value);
        updateCounters();
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
    const cards = el("div", { class: "webui-bridge-card-grid" });
    const status = el("div", { class: "webui-bridge-status" }, "");
    const clipStrengthInput = el("input", {
        type: "number",
        min: "-10",
        max: "10",
        step: "0.05",
        value: clipStrengthWidget?.value ?? 1,
        title: "Default LoRA CLIP strength when tag has no third value",
        oninput: (event) => setWidgetValue(node, "default_clip_strength", Number(event.currentTarget.value)),
    });
    const failOnMissingInput = el("input", {
        type: "checkbox",
        title: "Stop generation when a LoRA tag cannot be found",
        onchange: (event) => setWidgetValue(node, "fail_on_missing_lora", event.currentTarget.checked),
    });
    failOnMissingInput.checked = Boolean(failOnMissingWidget?.value ?? true);

    const setStatus = (message) => {
        status.textContent = message || "";
        status.classList.toggle("visible", Boolean(message));
        if (message) window.setTimeout(() => status.classList.remove("visible"), 5000);
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

    const renderCards = () => {
        const q = networkSearch.value.trim().toLowerCase();
        cards.innerHTML = "";
        for (const item of state.loras.filter((x) => !q || x.name.toLowerCase().includes(q) || x.alias.toLowerCase().includes(q)).slice(0, 80)) {
            const card = el("button", {
                class: "webui-bridge-card",
                title: item.name,
                onclick: async () => {
                    const target = state.activeTextarea || positive.textarea;
                    await updatePromptAreaWithLoraKeywords(target, item.prompt, target === negative.textarea, sync, setStatus);
                    renderCards();
                },
            }, [
                el("span", { class: "webui-bridge-card-kind" }, "LoRA"),
                el("span", { class: "webui-bridge-card-name" }, item.alias),
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
        if (typeof app.queuePrompt === "function") {
            await app.queuePrompt(0, 1);
            return;
        }
        document.querySelector("#queue-button, button.comfy-queue-button")?.click();
    };

    const setNodeSize = (width, height) => {
        const nextWidth = Math.max(760, Math.min(1500, Math.round(width)));
        const nextHeight = Math.max(500, Math.min(1100, Math.round(height)));
        node.__webuiBridgeDesiredSize = [nextWidth, nextHeight];
        node.setSize([nextWidth, nextHeight]);
        app.graph?.setDirtyCanvas(true, true);
    };

    const resizeNode = (deltaWidth, deltaHeight) => {
        setNodeSize((node.size?.[0] || 980) + deltaWidth, (node.size?.[1] || 720) + deltaHeight);
    };

    const installResizeDrag = (handle) => {
        handle.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            event.stopPropagation();
            handle.setPointerCapture?.(event.pointerId);
            const startX = event.clientX;
            const startY = event.clientY;
            const startWidth = node.size?.[0] || 980;
            const startHeight = node.size?.[1] || 720;
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

    const sizeControls = el("div", { class: "webui-bridge-size-controls" }, [
        el("button", { title: "Compact size", onclick: () => setNodeSize(840, 620) }, "S"),
        el("button", { title: "Smaller node", onclick: () => resizeNode(-120, -90) }, "-"),
        el("button", { title: "Larger node", onclick: () => resizeNode(120, 90) }, "+"),
        el("button", { title: "Fit default size", onclick: () => setNodeSize(1040, 980) }, "Fit"),
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
                animaModeControls,
                sizeControls,
                toolbar,
                el("div", { class: "webui-bridge-backend-settings" }, [
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
                status,
            ]),
        ]),
        el("div", { class: "webui-bridge-extra webui-bridge-extra-compact" }, [
            el("div", { class: "webui-bridge-extra-head" }, [
                el("span", {}, "Extra Networks"),
                networkSearch,
            ]),
            cards,
        ]),
        resizeGrip,
    ]);

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
    styleSelect.addEventListener("change", () => {
        styleName.value = styleSelect.selectedOptions[0]?.value || "";
    });

    loadBridgeData().then((data) => {
        state.loras = data.loras;
        state.styles = data.styles;
        state.promptAllInOne = data.promptAllInOne;
        renderStyles();
        renderCards();
        updateCounters();
        positiveTagPanel.__webuiBridgeRender?.();
        negativeTagPanel.__webuiBridgeRender?.();
    });

    updateCounters();
    return panel;
}

function installWebUIPanel(node) {
    if (node.__webuiBridgePanel) return;
    for (const widget of node.widgets || []) {
        if (PROMPT_WIDGETS.has(widget.name) || widget.name.endsWith("_status") || widget.name === "open_webui_prompt_editor") {
            hideWidget(widget);
        }
    }
    const panel = buildPanel(node);
    if (!node.__webuiBridgeDesiredSize) {
        node.__webuiBridgeDesiredSize = [
            Math.max(node.size?.[0] || 1040, 1040),
            Math.min(Math.max(node.size?.[1] || 980, 980), 1060),
        ];
    }
    const domWidget = node.addDOMWidget("webui_prompt_frontend", "webui_prompt_frontend", panel, {
        serialize: false,
        hideOnZoom: false,
        getMinHeight: () => 420,
        getMaxHeight: () => 1200,
    });
    domWidget.computeSize = (width) => {
        const desired = node.__webuiBridgeDesiredSize || node.size || [width || 1040, 820];
        const nodeWidth = desired[0] || width || 1040;
        const nodeHeight = desired[1] || 820;
        return [Math.max(720, nodeWidth - 20), Math.min(960, Math.max(620, nodeHeight - 120))];
    };
    node.__webuiBridgePanel = panel;
    node.resizable = true;
    if (!node.size || node.size[0] < 840 || node.size[1] < 620 || node.size[1] > 1120) {
        node.__webuiBridgeDesiredSize = [Math.max(node.size?.[0] || 1040, 1040), Math.min(Math.max(node.size?.[1] || 980, 980), 1060)];
        node.setSize(node.__webuiBridgeDesiredSize);
    }
    requestAnimationFrame(() => {
        if (node.size?.[1] > 1120) {
            node.__webuiBridgeDesiredSize = [Math.max(node.size[0], 1040), 920];
            node.setSize(node.__webuiBridgeDesiredSize);
        }
    });
}

function addStyles() {
    if (document.getElementById("webui-prompt-bridge-style")) return;
    const style = document.createElement("style");
    style.id = "webui-prompt-bridge-style";
    style.textContent = `
        .webui-bridge-panel {
            position: relative;
            width: max(100%, 1000px);
            min-width: 1000px;
            height: max(100%, 840px);
            min-height: 840px;
            min-height: 0;
            padding: 8px;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            gap: 8px;
            background: #20242d;
            color: #f2f4f8;
            font-family: Arial, sans-serif;
            overflow: auto;
            container-type: inline-size;
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
        .webui-bridge-toprow {
            display: grid;
            grid-template-columns: minmax(0, 1fr) clamp(220px, 24%, 280px);
            gap: 8px;
            flex: 0 0 auto;
            min-height: 0;
            overflow: visible;
        }
        .webui-bridge-prompts {
            display: flex;
            flex-direction: column;
            gap: 8px;
            min-width: 0;
            min-height: 0;
            overflow: visible;
        }
        .webui-bridge-prompt-row {
            position: relative;
            border: 1px solid #3e4654;
            border-radius: 6px;
            background: #171a20;
            overflow: hidden;
        }
        .webui-bridge-prompt-row.active {
            border-color: #6aa3ff;
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
            min-height: 48px;
            max-height: 82px;
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
            gap: 8px;
            padding: 8px 8px 38px;
            max-height: 136px;
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
            min-height: 210px;
            flex: 0 0 auto;
            display: flex;
            flex-direction: column;
        }
        .webui-bridge-aio-positive {
            min-height: 276px;
            height: 276px;
        }
        .webui-bridge-aio-negative {
            min-height: 230px;
            height: 230px;
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
            min-height: 110px;
            padding: 8px;
            overflow: auto;
        }
        .webui-bridge-aio-positive .webui-bridge-aio-body {
            min-height: 150px;
        }
        .webui-bridge-aio-negative .webui-bridge-aio-body {
            min-height: 104px;
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
            cursor: default;
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
        .webui-bridge-backend-settings input[type="checkbox"] {
            width: 14px;
            height: 14px;
            margin: 0;
            accent-color: #2f73d9;
        }
        .webui-bridge-tool:hover,
        .webui-bridge-card:hover {
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
            min-height: 18px;
            color: #9fb1c7;
            font-size: 11px;
            line-height: 1.35;
            opacity: 0;
            transition: opacity .16s ease;
            overflow-wrap: anywhere;
        }
        .webui-bridge-status.visible {
            opacity: 1;
        }
        .webui-bridge-extra {
            min-height: 0;
            flex: 0 0 155px;
            max-height: 190px;
            display: flex;
            flex-direction: column;
            border: 1px solid #3e4654;
            border-radius: 6px;
            overflow: hidden;
            background: #171a20;
        }
        .webui-bridge-extra-compact {
            min-height: 120px;
        }
        .webui-bridge-extra-head {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 7px 8px;
            background: #252a34;
            border-bottom: 1px solid #3e4654;
            font-size: 12px;
            color: #cbd4e1;
        }
        .webui-bridge-search {
            flex: 1;
            min-width: 0;
            padding: 5px 8px;
            border: 1px solid #4d5666;
            border-radius: 5px;
            background: #111318;
            color: #f2f4f8;
        }
        .webui-bridge-card-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(clamp(104px, 14%, 150px), 1fr));
            align-content: start;
            gap: 6px;
            padding: 8px;
            overflow: auto;
            min-height: 0;
            flex: 1 1 auto;
        }
        .webui-bridge-card {
            min-height: 44px;
            padding: 6px;
            border: 1px solid #3e4654;
            border-radius: 6px;
            background: #20242d;
            color: #f2f4f8;
            text-align: left;
            cursor: pointer;
            overflow: hidden;
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
            .webui-bridge-tools {
                grid-template-columns: repeat(5, minmax(28px, 1fr));
            }
            .webui-bridge-prompt-row textarea {
                min-height: 52px;
            }
        }
        .webui-bridge-card-kind {
            display: block;
            color: #8db7ff;
            font-size: 10px;
        }
        .webui-bridge-card-name {
            display: block;
            margin-top: 2px;
            font: 11px/1.25 Consolas, monospace;
            overflow-wrap: anywhere;
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
            requestAnimationFrame(() => installWebUIPanel(this));
        });
        chainCallback(nodeType.prototype, "onConfigure", function () {
            requestAnimationFrame(() => installWebUIPanel(this));
        });
    },
});
