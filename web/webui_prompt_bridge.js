import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";

const BRIDGE_DEBUG = {};

const TARGET_NODE = "WebUIPromptBridge";
const IMAGE_INPUT_NODE = "WebUIPromptBridgeImageInput";
const BRIDGE_WIDGET_DEFINITIONS = [
    ["positive_prompt", "string", "masterpiece, best quality, anime style, 1girl, <lora:anima-highres-aesthetic-boost:0.65>"],
    ["negative_prompt", "string", "worst quality, low quality, blurry, bad anatomy, extra fingers"],
    ["default_clip_strength", "number", 1],
    ["fail_on_missing_lora", "boolean", true],
    ["regional_enabled", "boolean", false],
    ["regional_mode", "enum", "matrix", ["matrix"]],
    ["regional_split", "enum", "vertical", ["vertical", "horizontal", "grid"]],
    ["regional_ratios", "string", "1,1"],
    ["regional_base_enabled", "boolean", false],
    ["regional_common_enabled", "boolean", false],
    ["regional_base_ratio", "number", 0.2],
    ["regional_strength", "number", 1],
    ["regional_canvas_auto", "boolean", true],
    ["regional_canvas_width", "integer", 1024],
    ["regional_canvas_height", "integer", 1024],
    ["module_table_enabled", "boolean", false],
    ["module_mask_enabled", "boolean", false],
    ["module_mask_strength", "number", 1],
    ["module_mask_set_area_to_bounds", "boolean", false],
    ["module_negative_common_enabled", "boolean", false],
    ["module_negative_common_prompt", "string", ""],
    ["module_flip_enabled", "boolean", false],
    ["module_flip_axis", "enum", "auto", ["auto", "horizontal", "vertical"]],
    ["module_presets_enabled", "boolean", false],
    ["module_adetailer_enabled", "boolean", false],
    ["module_adetailer_model", "enum", "face_yolov8m.pt", ["face_yolov8m.pt", "face_yolov8n.pt", "face_yolov8s.pt", "hand_yolov8s.pt", "hand_yolov8n.pt", "person_yolov8m-seg.pt", "person_yolov8n-seg.pt", "mediapipe_face_full", "custom"]],
    ["module_adetailer_prompt", "string", "detailed face, detailed eyes, detailed hands"],
    ["module_adetailer_negative_prompt", "string", "bad anatomy, deformed, blurry, extra fingers"],
    ["module_adetailer_confidence", "number", 0.3],
    ["module_adetailer_mask_blur", "integer", 4],
    ["module_adetailer_denoise", "number", 0.4],
    ["module_adetailer_inpaint_only_masked", "boolean", true],
    ["module_adetailer_cycles", "integer", 1],
    ["module_controlnet_enabled", "boolean", false],
    ["module_controlnet_preprocessor", "enum", "canny", ["none", "canny", "depth", "openpose", "lineart", "softedge", "normal", "tile", "reference", "ip-adapter"]],
    ["module_controlnet_model", "string", ""],
    ["module_controlnet_weight", "number", 1],
    ["module_controlnet_start", "number", 0],
    ["module_controlnet_end", "number", 1],
    ["module_controlnet_resize_mode", "enum", "just_resize", ["just_resize", "crop_and_resize", "resize_and_fill"]],
    ["module_controlnet_control_mode", "enum", "balanced", ["balanced", "prompt", "control"]],
    ["module_controlnet_pixel_perfect", "boolean", true],
    ["module_sam_enabled", "boolean", false],
    ["module_sam_model", "enum", "sam_vit_b", ["sam_vit_b", "sam_vit_l", "sam_vit_h", "sam_hq_vit_h", "mobile_sam", "custom"]],
    ["module_sam_prompt_mode", "enum", "auto", ["auto", "point", "box", "mask"]],
    ["module_sam_confidence", "number", 0.5],
    ["module_sam_mask_blur", "integer", 4],
    ["module_sam_dilate", "integer", 0],
    ["module_sam_inpaint_denoise", "number", 0.45],
    ["module_sam_inpaint_area", "enum", "only_masked", ["whole_picture", "only_masked"]],
    ["module_sam_padding", "integer", 32],
    ["module_upscale_enabled", "boolean", false],
    ["module_upscale_mode", "enum", "hires_fix", ["hires_fix", "ultimate_sd_upscale", "latent_upscale", "tile"]],
    ["module_upscale_by", "number", 2],
    ["module_upscale_upscaler", "string", "nearest-exact"],
    ["module_upscale_steps", "integer", 18],
    ["module_upscale_denoise", "number", 0.48],
    ["module_upscale_tile_width", "integer", 768],
    ["module_upscale_tile_height", "integer", 768],
    ["module_upscale_overlap", "integer", 64],
    ["module_regional_lora_enabled", "boolean", false],
    ["module_img2img_image", "string", ""],
    ["module_img2img_mask", "string", ""],
    ["module_img2img_mode", "enum", "img2img", ["img2img", "inpaint"]],
    ["module_img2img_denoise", "number", 0.55],
    ["module_img2img_enabled", "boolean", false],
];
const PROMPT_WIDGET_NAMES = BRIDGE_WIDGET_DEFINITIONS.map(([name]) => name);
const PROMPT_WIDGETS = new Set(PROMPT_WIDGET_NAMES);
const BRIDGE_WIDGET_DEFAULTS = Object.fromEntries(BRIDGE_WIDGET_DEFINITIONS.map(([name, , fallback]) => [name, fallback]));
const BRIDGE_WIDGET_DEFINITION_BY_NAME = Object.fromEntries(BRIDGE_WIDGET_DEFINITIONS.map((definition) => [definition[0], definition]));
const EXTRA_SEPARATOR = ", ";
const ATTENTION_STEP = 0.1;
const EXTRA_STEP = 0.05;
const DEFAULT_CLIP_STRENGTH = 1;
const DEFAULT_FONT_SIZE = 12;
const MIN_FONT_SIZE = 10;
const MAX_FONT_SIZE = 22;
const WORD_DELIMITERS = ",;，；、\n\r\t";
const DEFAULT_PANEL_WIDTH = 1180;
const DEFAULT_PANEL_HEIGHT = 1180;
const ACTION_SIDEBAR_DEFAULT_WIDTH = 400;
const ACTION_SIDEBAR_MIN_WIDTH = 300;
const ACTION_SIDEBAR_MAX_WIDTH = 560;
const ACTION_SIDEBAR_PROMPT_MIN_WIDTH = 420;
const LEGACY_PANEL_WIDTH = 1280;
const LEGACY_PANEL_HEIGHT = 1120;
const PANEL_MIN_WIDTH = 320;
const PANEL_MAX_WIDTH = 100000;
const PANEL_MIN_HEIGHT = 220;
const PANEL_MAX_HEIGHT = 3200;
const PANEL_BROKEN_MIN_WIDTH = 240;
const PANEL_BROKEN_MIN_HEIGHT = 160;
const DOM_WIDGET_LAYOUT_PAD = 128;
const DOM_WIDGET_PANEL_PAD = 14;
const WORKFLOW_LAYOUT_REPAIR_DELAYS = [0, 32, 120, 360, 900, 1600, 3200, 6500];
const WORKFLOW_CONFIGURED_SIZE_LOCK_MS = 6000;
const WEBUI_STATUS_TIMEOUT_MS = 12000;
const WEBUI_CONNECT_TIMEOUT_MS = 45000;
const WEBUI_REFRESH_TIMEOUT_MS = 12000;
const PROMPT_CHIPS_MIN_HEIGHT = 104;
const EXTRA_NETWORKS_MIN_HEIGHT = 96;
const EXTRA_NETWORKS_CARD_ROW_MIN_HEIGHT = 72;
const PANEL_SPLIT_GRIP_HEIGHT = 22;
const COLLAPSED_NEGATIVE_SPLIT_GRIP_HEIGHT = 22;
const EXTRA_NETWORKS_MAX_HEIGHT = PANEL_MAX_HEIGHT;
const DEFAULT_REGIONAL_CANVAS_WIDTH = 1024;
const DEFAULT_REGIONAL_CANVAS_HEIGHT = 1024;
const REGIONAL_WIDTH_ALIASES = [
    "width",
    "image_width",
    "image width",
    "latent_width",
    "target_width",
    "resize_width",
    "crop_width",
];
const REGIONAL_HEIGHT_ALIASES = [
    "height",
    "image_height",
    "image height",
    "latent_height",
    "target_height",
    "resize_height",
    "crop_height",
];
const LAYOUT_STORAGE_VERSION = "2026-06-20-dom-widget-top-v2";
const AIO_POSITIVE_MIN_HEIGHT = 180;
const AIO_NEGATIVE_MIN_HEIGHT = 220;
const NODE_TUTORIAL_SEEN_KEY = "webui-bridge-node-tutorial-seen-v2";
const DEFAULT_BRIDGE_SETTINGS = {
    data_source: "auto",
    translation_source: "auto",
    tag_translation_source: "auto",
    show_startup_wizard: true,
    layout_preset: "default",
    tag_display: "local_first",
    lora_card_size: "normal",
    node_tutorial_popup: "first_time",
    ui_visibility: {},
};
const UI_VISIBILITY_DEFAULTS = {
    top_tutorial: false,
    top_webui: true,
    top_lora: false,
    top_clip: false,
    top_fail_on_missing: false,
    model_switch: true,
    regional_control: false,
    size_controls: true,
    layout_presets: true,
    prompt_tools: true,
    styles: false,
    lora_browser: true,
    module_img2img: false,
    module_mask: false,
    module_table: false,
    module_negative_common: false,
    module_flip: false,
    module_presets: false,
    module_controlnet: false,
    module_adetailer: false,
    module_sam: false,
    module_upscale: false,
    module_regional_lora: false,
};
const UI_VISIBILITY_PRESETS = {
    minimal: {
        ...UI_VISIBILITY_DEFAULTS,
    },
    recommended: {
        ...UI_VISIBILITY_DEFAULTS,
        top_tutorial: true,
        top_lora: true,
        top_clip: true,
        top_fail_on_missing: true,
        regional_control: true,
        layout_presets: true,
        styles: true,
        lora_browser: true,
        module_table: true,
        module_negative_common: true,
        module_flip: true,
        module_presets: true,
    },
    all: Object.fromEntries(Object.keys(UI_VISIBILITY_DEFAULTS).map((key) => [key, true])),
};
const SIDEBAR_VISIBILITY_OPTIONS = [
    ["top_tutorial", "顶部教程"],
    ["top_webui", "顶部接入 WebUI"],
    ["top_lora", "顶部添加 LoRA"],
    ["top_clip", "CLIP 强度"],
    ["top_fail_on_missing", "缺 LoRA 停止"],
    ["model_switch", "模型切换"],
    ["regional_control", "区域控制"],
    ["size_controls", "尺寸快捷"],
    ["layout_presets", "布局预设"],
    ["prompt_tools", "Prompt 工具"],
    ["styles", "Styles 起手式"],
    ["lora_browser", "LoRA 浏览区"],
];
const MAIN_MODULE_VISIBILITY_OPTIONS = [
    ["module_table", "区域表格"],
    ["module_negative_common", "负向 Common"],
    ["module_flip", "区域翻转"],
    ["module_presets", "区域 Preset"],
];
const ADVANCED_MODULE_VISIBILITY_OPTIONS = [
    ["module_img2img", "图生图 / 局部重绘"],
    ["module_mask", "Mask 区域"],
    ["module_controlnet", "ControlNet"],
    ["module_adetailer", "ADetailer"],
    ["module_sam", "SAM/Inpaint"],
    ["module_upscale", "放大修复"],
    ["module_regional_lora", "区域 LoRA"],
];
const MODULE_VISIBILITY_OPTIONS = [
    ...MAIN_MODULE_VISIBILITY_OPTIONS,
    ...ADVANCED_MODULE_VISIBILITY_OPTIONS,
];
const UI_VISIBILITY_LEGACY_KEYS = {
    assistant_mask: "module_mask",
    assistant_table: "module_table",
    assistant_negative_common: "module_negative_common",
    assistant_flip: "module_flip",
    assistant_presets: "module_presets",
    assistant_controlnet: "module_controlnet",
    assistant_adetailer: "module_adetailer",
    assistant_sam: "module_sam",
    assistant_upscale: "module_upscale",
    assistant_regional_lora: "module_regional_lora",
    assistant_img2img: "module_img2img",
};
const SETTING_CHOICES = {
    data_source: ["auto", "webui", "builtin"],
    translation_source: ["auto", "webui", "online", "ai", "builtin"],
    tag_translation_source: ["auto", "local", "online", "off"],
    layout_preset: ["default", "compact", "roomy", "positive_focus", "minimal_lora"],
    tag_display: ["local_first", "prompt_first", "compact"],
    lora_card_size: ["compact", "normal", "large"],
    node_tutorial_popup: ["first_time", "always", "off"],
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
    "身体/细节",
    "材质/质感",
    "光照/色彩",
    "工具/控制",
    "训练/实验",
    "未分类",
];
const LORA_CATEGORY_RULES = [
    {
        label: "角色/人物",
        strong: ["character", "chara", "char_", "char-", "role", "person", "people", "girl", "boy", "woman", "man", "female", "male", "likeness", "vtuber", "idol", "cosplay", "oc", "face", "head", "portrait", "genshin", "honkai", "star rail", "arknights", "blue archive", "bluearchive", "wuthering waves", "azur lane", "fate", "fgo", "kamisato", "furina", "castorice", "columbina", "shenli", "人物", "角色", "女孩", "男孩", "少女", "正太", "萝莉", "脸", "头像", "虚拟主播", "原神", "崩坏", "星穹铁道", "明日方舟", "碧蓝档案", "鸣潮", "凡人修仙", "哥伦比娅"],
        weak: ["1girl", "1boy", "2girls", "2boys", "solo", "hair", "eyes", "耳", "发型", "头发", "眼睛"],
    },
    {
        label: "画风/风格",
        strong: ["style", "artstyle", "artist", "art by", "drawn by", "anime", "manga", "toon", "illustration", "painting", "sketch", "lineart", "render", "realistic", "photoreal", "pixel", "watercolor", "oil painting", "comic", "novelai", "pony", "noob", "画风", "风格", "画师", "绘柄", "写实", "水彩", "油画", "像素", "漫画", "插画"],
        weak: ["aesthetic", "illust", "cg", "2d", "3d"],
    },
    {
        label: "服装/装扮",
        strong: ["cloth", "clothes", "clothing", "dress", "outfit", "uniform", "shirt", "skirt", "jacket", "coat", "armor", "kimono", "maid", "suit", "school uniform", "swimsuit", "bikini", "lingerie", "cosplay", "slingshot", "mask", "eye mask", "blindfold", "服装", "衣服", "装扮", "制服", "裙", "外套", "盔甲", "和服", "女仆", "泳装", "眼罩"],
        weak: ["wearing", "boots", "shoes", "hat", "gloves", "stocking", "thighhigh", "袜", "鞋", "帽"],
    },
    {
        label: "姿势/动作",
        strong: ["pose", "posing", "action", "gesture", "dance", "standing", "sitting", "walking", "running", "jump", "hand", "hands", "arms", "legs", "动作", "姿势", "手势", "站立", "坐姿", "走路", "跑步", "跳舞"],
        weak: ["holding", "looking", "view", "motion"],
    },
    {
        label: "场景/环境",
        strong: ["background", "scene", "environment", "landscape", "room", "city", "street", "forest", "building", "interior", "exterior", "sky", "beach", "school", "cafe", "bedroom", "背景", "场景", "环境", "风景", "房间", "城市", "街道", "森林", "建筑", "室内", "天空", "海边", "学校"],
        weak: ["place", "location", "world"],
    },
    {
        label: "物品/道具",
        strong: ["prop", "object", "item", "weapon", "sword", "gun", "vehicle", "car", "bike", "mecha", "robot", "animal", "pet", "food", "glasses", "machine", "道具", "物品", "武器", "剑", "枪", "车辆", "机甲", "机器人", "动物", "食物", "眼镜", "机器"],
        weak: ["holding", "accessory", "bag"],
    },
    {
        label: "质量/增强",
        strong: ["quality", "detail", "detailed", "aesthetic", "highres", "hires", "upscale", "enhance", "enhancer", "boost", "booster", "detailer", "sharp", "hd", "4k", "8k", "masterpiece", "质量", "细节", "增强", "高清", "修复", "放大", "锐化"],
        weak: ["best", "score_9", "score_8", "clean"],
    },
    {
        label: "构图/镜头",
        strong: ["composition", "camera", "lens", "shot", "closeup", "close-up", "wide shot", "cowboy shot", "upper body", "full body", "angle", "view", "perspective", "构图", "镜头", "视角", "特写", "全景", "半身", "全身", "透视"],
        weak: ["portrait", "framing", "crop"],
    },
    {
        label: "表情/情绪",
        strong: ["expression", "emotion", "mood", "smile", "happy", "sad", "angry", "cry", "tears", "blush", "表情", "情绪", "微笑", "开心", "悲伤", "生气", "哭", "脸红"],
        weak: ["laugh", "serious", "shy"],
    },
    {
        label: "身体/细节",
        strong: ["body", "anatomy", "breast", "nipples", "areola", "skin detail", "hands", "feet", "foot", "muscle", "body detail", "lactation", "身体", "人体", "胸", "乳", "皮肤细节", "手部", "脚部", "肌肉"],
        weak: ["real skin", "skin", "detail"],
    },
    {
        label: "材质/质感",
        strong: ["texture", "material", "fabric", "skin", "leather", "metal", "glass", "wet", "gloss", "matte", "质感", "材质", "皮肤", "皮革", "金属", "玻璃", "湿润", "光泽"],
        weak: ["surface", "cloth texture"],
    },
    {
        label: "光照/色彩",
        strong: ["light", "lighting", "shadow", "color", "colour", "tone", "palette", "neon", "cinematic lighting", "rim light", "光照", "灯光", "阴影", "色彩", "配色", "霓虹", "色调"],
        weak: ["bright", "dark", "warm", "cool"],
    },
    {
        label: "工具/控制",
        strong: ["controlnet", "control", "depth", "canny", "openpose", "ipadapter", "adapter", "slider", "concept slider", "工具", "控制", "姿态控制", "深度", "边缘"],
        weak: ["helper", "utility"],
    },
    {
        label: "训练/实验",
        strong: ["checkpoint", "epoch", "step", "e18", "e30", "s162", "训练", "实验", "测试"],
        weak: [],
    },
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
    const normalized = {
        ...DEFAULT_BRIDGE_SETTINGS,
        ui_visibility: { ...UI_VISIBILITY_DEFAULTS },
    };
    for (const [key, value] of Object.entries(settings || {})) {
        if (key === "show_startup_wizard") {
            normalized[key] = Boolean(value);
        } else if (key === "ui_visibility" && value && typeof value === "object") {
            for (const visibilityKey of Object.keys(UI_VISIBILITY_DEFAULTS)) {
                if (Object.prototype.hasOwnProperty.call(value, visibilityKey)) {
                    normalized.ui_visibility[visibilityKey] = Boolean(value[visibilityKey]);
                }
            }
            for (const [legacyKey, visibilityKey] of Object.entries(UI_VISIBILITY_LEGACY_KEYS)) {
                if (Object.prototype.hasOwnProperty.call(value, legacyKey)) {
                    normalized.ui_visibility[visibilityKey] = Boolean(value[legacyKey]);
                }
            }
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
        const nextValue = String(Math.round(value));
        if (localStorage.getItem(key) === nextValue) return;
        localStorage.setItem(key, nextValue);
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

async function readBridgeResponse(response, fallback = "请求失败") {
    const text = await response.text().catch(() => "");
    let data = {};
    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = {};
        }
    }
    const message = data?.error || data?.message || (text && text !== "Error" ? text : "") || fallback;
    return { data, message, text };
}

async function bridgeJson(response, fallback = "请求失败") {
    const { data, message } = await readBridgeResponse(response, fallback);
    if (!response.ok) throw new Error(message);
    return data;
}

function clampNumber(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || min));
}

function applyStoredHeight(target, storageKey, { min = 48, max = 640 } = {}) {
    const value = readLocalNumber(storageKey, null);
    if (value === null) return;
    const height = clampNumber(value, min, max);
    if (Math.abs((resizeTargetLayoutHeight(target) || 0) - height) < 1 &&
        target.style.flex === "0 0 auto") {
        return;
    }
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

function resizeTargetLayoutWidth(target) {
    if (!target) return 0;
    return target.offsetWidth || target.getBoundingClientRect?.().width || 0;
}

function resizeTargetViewportScale(target) {
    const layoutHeight = target?.offsetHeight || 0;
    const viewportHeight = target?.getBoundingClientRect?.().height || 0;
    if (!layoutHeight || !viewportHeight) return 1;
    return viewportHeight / layoutHeight || 1;
}

function resizeTargetViewportXScale(target) {
    const layoutWidth = target?.offsetWidth || 0;
    const viewportWidth = target?.getBoundingClientRect?.().width || 0;
    if (!layoutWidth || !viewportWidth) return 1;
    return viewportWidth / layoutWidth || 1;
}

function gridColumnGap(target) {
    const value = Number.parseFloat(getComputedStyle(target).columnGap);
    return Number.isFinite(value) ? value : 0;
}

function setResizeTargetHeight(target, storageKey, height, { min = 48, max = 640 } = {}) {
    if (!target) return;
    const nextHeight = clampNumber(height, min, max);
    const key = resizeTargetKey(target, storageKey);
    if (Math.abs((resizeTargetLayoutHeight(target) || 0) - nextHeight) < 1 &&
        target.style.flex === "0 0 auto") {
        if (key) writeLocalNumber(key, nextHeight);
        return;
    }
    target.style.height = `${nextHeight}px`;
    target.style.flex = "0 0 auto";
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
        role: "separator",
        "aria-orientation": "horizontal",
        "aria-label": title,
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
            grip.classList.add("dragging");
            const onMove = (moveEvent) => {
                const delta = (moveEvent.clientY - startY) / viewportScale;
                setResizeTargetHeight(target, storageKey, startHeight + delta, { min, max });
            };
            const onUp = () => {
                grip.classList.remove("dragging");
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
    const label = String(options.label || "").trim();
    const grip = el("div", {
        class: `webui-bridge-section-resizer webui-bridge-split-resizer${label ? " has-label" : ""}${options.className ? ` ${options.className}` : ""}`,
        role: "separator",
        "aria-orientation": "horizontal",
        "aria-label": options.title || label || "上下拖动调整两侧高度",
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
            options.onDragStart?.(event);
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
            grip.classList.add("dragging");
            const onMove = (moveEvent) => {
                const delta = (moveEvent.clientY - startY) / viewportScale;
                if (!moved && Math.abs(delta) < 4) return;
                moved = true;
                options.onDragMove?.(moveEvent, {
                    delta,
                    startBefore,
                    startAfter,
                    before,
                    after,
                    afterVisible,
                    total,
                });
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
                grip.classList.remove("dragging");
                options.onDragEnd?.();
                document.removeEventListener("pointermove", onMove, true);
                document.removeEventListener("pointerup", onUp, true);
                document.removeEventListener("pointercancel", onUp, true);
            };
            document.addEventListener("pointermove", onMove, true);
            document.addEventListener("pointerup", onUp, true);
            document.addEventListener("pointercancel", onUp, true);
        },
    }, label ? [el("span", { class: "webui-bridge-resizer-label" }, label)] : []);
    return grip;
}

function sidebarWidthMax(topRow, { min = ACTION_SIDEBAR_MIN_WIDTH, max = ACTION_SIDEBAR_MAX_WIDTH, promptMin = ACTION_SIDEBAR_PROMPT_MIN_WIDTH } = {}) {
    const rowWidth = resizeTargetLayoutWidth(topRow);
    const gripWidth = topRow?.__webuiBridgeSidebarGrip?.offsetWidth || 10;
    const gaps = gridColumnGap(topRow) * 2;
    const available = rowWidth ? rowWidth - gripWidth - gaps - promptMin : max;
    return Math.max(min, Math.min(max, available));
}

function setSidebarWidth(topRow, storageKey, width, options = {}) {
    if (!topRow) return;
    const min = options.min ?? ACTION_SIDEBAR_MIN_WIDTH;
    const max = sidebarWidthMax(topRow, options);
    const nextWidth = clampNumber(width, min, max);
    topRow.style.setProperty("--webui-bridge-sidebar-width", `${nextWidth}px`);
    if (storageKey) writeLocalNumber(storageKey, nextWidth);
}

function applyStoredSidebarWidth(topRow, storageKey, options = {}) {
    const width = readLocalNumber(storageKey, options.defaultWidth ?? ACTION_SIDEBAR_DEFAULT_WIDTH);
    setSidebarWidth(topRow, storageKey, width, options);
}

function resetSidebarWidth(topRow, storageKey, options = {}) {
    if (!topRow) return;
    if (storageKey) clearLocalValue(storageKey);
    setSidebarWidth(topRow, "", options.defaultWidth ?? ACTION_SIDEBAR_DEFAULT_WIDTH, options);
}

function startSidebarWidthDrag(handle, topRowRef, storageKey, options, event) {
    event.preventDefault();
    event.stopPropagation();
    const topRow = resolveResizeValue(topRowRef);
    if (!topRow || topRow.classList?.contains("action-collapsed")) return;
    const startX = event.clientX;
    const startWidth = readLocalNumber(storageKey, Number.parseFloat(getComputedStyle(topRow).getPropertyValue("--webui-bridge-sidebar-width")) || options.defaultWidth || ACTION_SIDEBAR_DEFAULT_WIDTH);
    const viewportScale = resizeTargetViewportXScale(topRow);
    let moved = false;
    handle.classList.add("dragging");
    document.body?.classList?.add("webui-bridge-resizing-sidebar");
    handle.setPointerCapture?.(event.pointerId);
    const onMove = (moveEvent) => {
        const delta = (moveEvent.clientX - startX) / viewportScale;
        if (!moved && Math.abs(delta) < 3) return;
        moved = true;
        setSidebarWidth(topRow, storageKey, startWidth - delta, options);
    };
    const onUp = () => {
        handle.classList.remove("dragging");
        document.body?.classList?.remove("webui-bridge-resizing-sidebar");
        document.removeEventListener("pointermove", onMove, true);
        document.removeEventListener("pointerup", onUp, true);
        document.removeEventListener("pointercancel", onUp, true);
    };
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onUp, true);
}

function createSidebarWidthGrip(topRowRef, storageKey, options = {}) {
    const grip = el("div", {
        class: "webui-bridge-side-resizer",
        role: "separator",
        "aria-orientation": "vertical",
        "aria-label": "拖动调整侧边栏宽度",
        title: options.title || "左右拖动调整侧边栏宽度，双击恢复默认宽度",
        ondblclick: (event) => {
            event.preventDefault();
            event.stopPropagation();
            resetSidebarWidth(resolveResizeValue(topRowRef), storageKey, options);
        },
        onpointerdown: (event) => startSidebarWidthDrag(grip, topRowRef, storageKey, options, event),
    }, [
        el("span", { class: "webui-bridge-side-resizer-handle" }, [
            el("span", { class: "webui-bridge-side-resizer-icon" }, "↔"),
            el("span", { class: "webui-bridge-side-resizer-text" }, "拖动调宽"),
        ]),
    ]);
    return grip;
}

function createSidebarWidthButton(topRowRef, storageKey, options = {}) {
    const button = el("button", {
        class: "webui-bridge-sidebar-width-button",
        type: "button",
        title: options.title || "拖动调整侧边栏宽度，双击恢复默认宽度",
        ondblclick: (event) => {
            event.preventDefault();
            event.stopPropagation();
            resetSidebarWidth(resolveResizeValue(topRowRef), storageKey, options);
        },
        onpointerdown: (event) => startSidebarWidthDrag(button, topRowRef, storageKey, options, event),
    }, [
        el("span", { class: "webui-bridge-sidebar-width-icon" }, "↔"),
        el("span", { class: "webui-bridge-sidebar-width-text" }, "拖动调宽侧栏"),
    ]);
    return button;
}

function clampPanelSize(width, height) {
    const nextHeight = Math.min(PANEL_MAX_HEIGHT, Math.max(PANEL_MIN_HEIGHT, Math.round(height || DEFAULT_PANEL_HEIGHT)));
    const nextWidth = Math.min(PANEL_MAX_WIDTH, Math.max(PANEL_MIN_WIDTH, Math.round(width || DEFAULT_PANEL_WIDTH)));
    return [nextWidth, nextHeight];
}

function migrateLayoutStorage(keys = []) {
    const versionKey = "webui-bridge-layout-storage-version";
    if (readLocalString(versionKey, "") === LAYOUT_STORAGE_VERSION) return;
    for (const key of keys) clearLocalValue(key);
    writeLocalString(versionKey, LAYOUT_STORAGE_VERSION);
}

function bridgePanelSizeValues(size) {
    if (!size || typeof size !== "object") return null;
    const width = Number(size[0]);
    const height = Number(size[1]);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    return [width, height];
}

function looksLikeLegacyDefaultSize(size) {
    const values = bridgePanelSizeValues(size);
    return Boolean(values) &&
        Math.abs(values[0] - LEGACY_PANEL_WIDTH) <= 8 &&
        Math.abs(values[1] - LEGACY_PANEL_HEIGHT) <= 8;
}

function looksLikeBrokenBridgePanelSize(size) {
    const values = bridgePanelSizeValues(size);
    if (!values) return true;
    const [width, height] = values;
    return width < PANEL_BROKEN_MIN_WIDTH || height < PANEL_BROKEN_MIN_HEIGHT || width > PANEL_MAX_WIDTH || height > PANEL_MAX_HEIGHT;
}

function shouldRepairBridgePanelSize(size) {
    return looksLikeBrokenBridgePanelSize(size);
}

function looksLikeSavedUserBridgePanelSize(size) {
    return Boolean(bridgePanelSizeValues(size)) &&
        !looksLikeLegacyDefaultSize(size) &&
        !looksLikeBrokenBridgePanelSize(size);
}

function nodeHasSavedUserBridgePanelSize(node) {
    if (node?.__webuiBridgeFreshNode &&
        !node.__webuiBridgeWasConfigured &&
        !node.__webuiBridgeUserSized &&
        !looksLikeSavedUserBridgePanelSize(node.__webuiBridgeSavedPanelSize)) {
        return false;
    }
    return looksLikeSavedUserBridgePanelSize(node?.__webuiBridgeSavedPanelSize) ||
        (Boolean(node?.__webuiBridgeUserSized || node?.__webuiBridgeWasConfigured) && looksLikeSavedUserBridgePanelSize(node?.size));
}

function bridgeConfiguredSizeLockActive(node) {
    return Boolean(
        node &&
        looksLikeSavedUserBridgePanelSize(node.__webuiBridgeSavedPanelSize) &&
        (performance?.now?.() || Date.now()) < (node.__webuiBridgePreferConfiguredPanelSizeUntil || 0)
    );
}

function bridgePanelSizesMatch(first, second, tolerance = 2) {
    const firstValues = bridgePanelSizeValues(first);
    const secondValues = bridgePanelSizeValues(second);
    if (!firstValues || !secondValues) return false;
    return Math.abs(firstValues[0] - secondValues[0]) <= tolerance &&
        Math.abs(firstValues[1] - secondValues[1]) <= tolerance;
}

function looksLikeCurrentDefaultBridgePanelSize(size) {
    const values = bridgePanelSizeValues(size);
    if (!values) return false;
    return Math.abs(values[0] - DEFAULT_PANEL_WIDTH) <= 8 &&
        Math.abs(values[1] - DEFAULT_PANEL_HEIGHT) <= 8;
}

function shouldUseLiveBridgePanelSize(node, liveSize, savedSize) {
    if (!looksLikeSavedUserBridgePanelSize(liveSize)) return false;
    const liveLooksDefault = looksLikeCurrentDefaultBridgePanelSize(liveSize) || looksLikeLegacyDefaultSize(liveSize);
    const savedLooksDefault = looksLikeCurrentDefaultBridgePanelSize(savedSize) || looksLikeLegacyDefaultSize(savedSize);
    if (looksLikeSavedUserBridgePanelSize(savedSize) &&
        !bridgePanelSizesMatch(liveSize, savedSize) &&
        liveLooksDefault &&
        !savedLooksDefault) {
        return false;
    }
    if (!bridgeConfiguredSizeLockActive(node)) return true;
    if (!looksLikeSavedUserBridgePanelSize(savedSize)) return true;
    if (bridgePanelSizesMatch(liveSize, savedSize)) return true;
    return savedLooksDefault && !liveLooksDefault;
}

function rememberBridgePanelSize(node, size, options = {}) {
    const desired = normalizeBridgePanelSize(size);
    node.__webuiBridgeDesiredSize = [...desired];
    if (looksLikeSavedUserBridgePanelSize(desired)) {
        node.__webuiBridgeSavedPanelSize = [...desired];
        if (options.clearConfiguredLock) {
            node.__webuiBridgePreferConfiguredPanelSizeUntil = 0;
        }
    }
    return desired;
}

function resolveBridgePanelSize(node) {
    if (bridgeConfiguredSizeLockActive(node)) {
        return normalizeBridgePanelSize(node.__webuiBridgeSavedPanelSize);
    }
    if (looksLikeSavedUserBridgePanelSize(node?.size)) {
        return normalizeBridgePanelSize(node.size);
    }
    if (looksLikeSavedUserBridgePanelSize(node?.__webuiBridgeSavedPanelSize)) {
        return normalizeBridgePanelSize(node.__webuiBridgeSavedPanelSize);
    }
    return normalizeBridgePanelSize(node?.__webuiBridgeDesiredSize || node?.size);
}

function resolveBridgePanelSizeForLiveState(node, options = {}) {
    if (node?.__webuiBridgeFreshNode &&
        !node.__webuiBridgeWasConfigured &&
        !node.__webuiBridgeUserSized &&
        !looksLikeSavedUserBridgePanelSize(node.__webuiBridgeSavedPanelSize)) {
        const desired = normalizeBridgePanelSize(node.__webuiBridgeDesiredSize || node.size);
        node.__webuiBridgeDesiredSize = [...desired];
        return desired;
    }
    const liveSize = looksLikeSavedUserBridgePanelSize(node?.size)
        ? normalizeBridgePanelSize(node.size)
        : null;
    const savedSize = looksLikeSavedUserBridgePanelSize(node?.__webuiBridgeSavedPanelSize)
        ? normalizeBridgePanelSize(node.__webuiBridgeSavedPanelSize)
        : null;
    if (liveSize && shouldUseLiveBridgePanelSize(node, liveSize, savedSize)) {
        const liveDiffersFromSaved = savedSize && !bridgePanelSizesMatch(liveSize, savedSize);
        return rememberBridgePanelSize(node, liveSize, {
            clearConfiguredLock: Boolean(options.clearConfiguredLock && liveDiffersFromSaved),
        });
    }
    const desired = resolveBridgePanelSize(node);
    node.__webuiBridgeDesiredSize = [...desired];
    return desired;
}

function normalizeBridgePanelSize(size, fallback = [DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT]) {
    if (shouldRepairBridgePanelSize(size)) {
        return clampPanelSize(fallback[0], fallback[1]);
    }
    const values = bridgePanelSizeValues(size) || fallback;
    return clampPanelSize(values[0], values[1]);
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

function moveWidgetToFront(node, widget) {
    if (!Array.isArray(node?.widgets) || !widget) return;
    const index = node.widgets.indexOf(widget);
    if (index <= 0) return;
    node.widgets.splice(index, 1);
    node.widgets.unshift(widget);
}

function pinBridgeDomWidgetToTop(node, widget) {
    if (!widget) return;
    if (node) node.widgets_start_y = 0;
    moveWidgetToFront(node, widget);
    widget.y = 0;
    widget.last_y = 0;
}

function syncBridgeDomWidgetWrapper(panel, width, height) {
    if (!panel?.parentElement) return;
    const setImportant = (target, property, value) => target?.style?.setProperty?.(property, value, "important");
    const clearImportant = (target, property) => target?.style?.removeProperty?.(property);
    const clearGlobalShell = (root) => {
        if (!root ||
            root.classList?.contains("dom-widget") ||
            root.classList?.contains("lg-node-widget") ||
            root.classList?.contains("lg-node-widgets")) return;
        root.classList?.remove?.("webui-bridge-dom-widget-shell");
        for (const property of ["width", "max-width", "min-width", "height", "min-height", "box-sizing", "overflow"]) {
            clearImportant(root, property);
        }
    };
    document.querySelectorAll?.([
        "main.webui-bridge-dom-widget-shell",
        ".comfyui-body.webui-bridge-dom-widget-shell",
        ".graph-canvas-container.webui-bridge-dom-widget-shell",
        ".isolate.webui-bridge-dom-widget-shell",
    ].join(","))?.forEach(clearGlobalShell);
    const roots = [];
    let current = panel.parentElement;
    for (let depth = 0; current && depth < 5; depth += 1) {
        if (current === document.body || current.classList?.contains("lg-node")) break;
        roots.push(current);
        if (current.classList?.contains("dom-widget") ||
            current.classList?.contains("lg-node-widget") ||
            current.classList?.contains("lg-node-widgets")) break;
        current = current.parentElement;
    }
    for (const root of roots) {
        root.classList?.add?.("webui-bridge-dom-widget-shell");
        setImportant(root, "width", "100%");
        setImportant(root, "max-width", "none");
        setImportant(root, "min-width", "0");
        setImportant(root, "height", "100%");
        setImportant(root, "min-height", "0");
        setImportant(root, "box-sizing", "border-box");
        setImportant(root, "overflow", "hidden");
    }
    const host = roots.find((root) => root.classList?.contains("lg-node-widgets"));
    if (host) {
        setImportant(host, "left", "8px");
        setImportant(host, "right", "12px");
        setImportant(host, "top", "34px");
        setImportant(host, "bottom", "10px");
        setImportant(host, "width", "auto");
        setImportant(host, "height", "auto");
        setImportant(host, "position", "absolute");
    }
    const wrapperWidth = Math.max(PANEL_MIN_WIDTH, Number(width) || panel.offsetWidth || DEFAULT_PANEL_WIDTH);
    const wrapperHeight = Math.max(280, Number(height) || panel.offsetHeight || DEFAULT_PANEL_HEIGHT);
    if (!host && roots[0]) {
        setImportant(roots[0], "width", `${wrapperWidth}px`);
        setImportant(roots[0], "height", `${wrapperHeight}px`);
    }
    const widgetHost = roots.find((root) => root.classList?.contains("lg-node-widget"));
    if (widgetHost) {
        setImportant(widgetHost, "display", "grid");
        setImportant(widgetHost, "grid-template-rows", "minmax(0, 1fr)");
    }
    setImportant(panel, "width", "100%");
    setImportant(panel, "max-width", "100%");
    setImportant(panel, "height", "100%");
    setImportant(panel, "max-height", "100%");
}

function bridgeScrollableWheelTarget(target, deltaY = 0) {
    let current = target instanceof Element ? target : target?.parentElement;
    while (current && current !== document.body) {
        if (current.classList?.contains("webui-bridge-panel")) return null;
        const style = getComputedStyle(current);
        const overflowY = `${style.overflowY} ${style.overflow}`.toLowerCase();
        const canScrollY = /(auto|scroll|overlay)/.test(overflowY) && current.scrollHeight > current.clientHeight + 2;
        if (canScrollY) {
            const canScrollDown = current.scrollTop + current.clientHeight < current.scrollHeight - 1;
            const canScrollUp = current.scrollTop > 0;
            if ((deltaY > 0 && canScrollDown) || (deltaY < 0 && canScrollUp)) return current;
        }
        current = current.parentElement;
    }
    return null;
}

function bridgeCanvasHasPendingNodePlacement() {
    const canvas = app?.canvas;
    if (!canvas) return false;
    return canvas.state?.ghostNodeId !== undefined && canvas.state.ghostNodeId !== null;
}

function bridgeCanvasPointerIsActive(canvas = app?.canvas) {
    if (!canvas) return false;
    return Boolean(canvas.pointer?.isDown || canvas.dragging_canvas || canvas.isDragging || canvas._dragZoomStart);
}

function bridgeCanvasEventPathIncludes(event, element) {
    if (!event || !element) return false;
    if (event.target === element || element.contains?.(event.target)) return true;
    return Boolean(event.composedPath?.().includes(element));
}

function recoverBridgeStaleCanvasPointer(event) {
    const canvas = app?.canvas;
    if (!canvas?.pointer?.isDown) return false;
    if (event?.buttons) return false;
    try {
        if (typeof canvas.processMouseCancel === "function") {
            canvas.processMouseCancel(event);
        } else {
            canvas.pointer?.reset?.();
        }
        canvas.dragging_canvas = false;
        canvas.isDragging = false;
        return true;
    } catch (error) {
        console.warn("[WebUI Prompt Bridge] Failed to recover stale ComfyUI canvas pointer", error);
        return false;
    }
}

function installBridgeCanvasPointerRecovery() {
    if (document.__webuiBridgeCanvasPointerRecoveryInstalled) return;
    document.__webuiBridgeCanvasPointerRecoveryInstalled = true;
    const recover = (event) => {
        if ((event.type === "pointerup" || event.type === "mouseup" || event.type === "pointercancel") &&
            document.__webuiBridgeCanvasPointerRelay) {
            return;
        }
        recoverBridgeStaleCanvasPointer(event);
    };
    document.addEventListener("pointermove", recover, true);
    document.addEventListener("mousemove", recover, true);
    document.addEventListener("mouseup", recover, true);
    document.addEventListener("pointerup", recover, true);
    document.addEventListener("pointercancel", recover, true);
    document.addEventListener("keyup", (event) => {
        if (event.key === "Escape") recoverBridgeStaleCanvasPointer();
    }, true);
}

function bridgePanelTargetOwnsPointer(target, handleSelector) {
    if (!(target instanceof Element)) return false;
    const panel = target.closest?.(".webui-bridge-panel");
    const localSelector = [
        handleSelector,
        "button",
        "input",
        "textarea",
        "select",
        "option",
        "label",
        "summary",
        "a[href]",
        "[contenteditable='true']",
        "[role='button']",
        "[role='checkbox']",
        "[role='menuitem']",
        "[role='radio']",
        "[role='switch']",
        "[tabindex]:not(.webui-bridge-panel):not(.webui-bridge-toprow):not(.webui-bridge-extra)",
        ".webui-bridge-card",
        ".webui-bridge-card-trigger",
        ".webui-bridge-tree-item",
        ".webui-bridge-custom-tag-row",
        ".webui-bridge-tag-chip",
        ".webui-bridge-prompt-chip",
        ".webui-bridge-prompt-label",
        ".webui-bridge-extra-head",
        ".webui-bridge-network-controls",
        ".webui-bridge-model-controls",
    ].filter(Boolean).join(",");
    const pointerOwner = target.closest?.(localSelector);
    if (!pointerOwner) return false;
    return !panel || panel.contains(pointerOwner);
}

function forwardBridgeCanvasPointer(event, methodName) {
    const canvas = app?.canvas;
    if (typeof canvas?.[methodName] !== "function") return false;
    try {
        canvas[methodName](event);
        if (methodName === "processMouseDown") {
            try {
                Object.defineProperty(event, "__webuiBridgeCanvasPointerForwarded", { value: true, configurable: true });
            } catch {
                event.__webuiBridgeCanvasPointerForwarded = true;
            }
        }
        return true;
    } catch (error) {
        console.warn(`[WebUI Prompt Bridge] Failed to forward ${event.type} to ComfyUI canvas`, error);
        return false;
    }
}

function cloneBridgeCanvasPointerEvent(event, type = event?.type) {
    const Ctor = type?.startsWith?.("pointer") && typeof PointerEvent !== "undefined" ? PointerEvent : MouseEvent;
    return new Ctor(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        clientX: event.clientX,
        clientY: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY,
        button: event.button,
        buttons: event.buttons,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        pointerId: event.pointerId,
        pointerType: event.pointerType,
        isPrimary: event.isPrimary,
    });
}

function dispatchBridgeCanvasPointerFallback(event) {
    const canvasElement = app?.canvas?.canvas;
    if (!canvasElement) return false;
    try {
        const forwarded = cloneBridgeCanvasPointerEvent(event);
        Object.defineProperty(forwarded, "__webuiBridgeCanvasPointerForwarded", { value: true, configurable: true });
        return canvasElement.dispatchEvent(forwarded);
    } catch (error) {
        console.warn(`[WebUI Prompt Bridge] Failed to dispatch ${event.type} to ComfyUI canvas`, error);
        return false;
    }
}

function forwardBridgePendingNodePlacementPointer(event) {
    if (event.__webuiBridgeCanvasPointerForwarded) return false;
    if (!bridgeCanvasHasPendingNodePlacement()) return false;
    const forwarded = forwardBridgeCanvasPointer(event, "processMouseDown");
    if (forwarded) event.preventDefault?.();
    return forwarded;
}

function installBridgeCanvasPointerRelay(startEvent) {
    const canvas = app?.canvas;
    const canvasElement = canvas?.canvas;
    if (!canvas || !canvasElement) return;
    const previousRelay = document.__webuiBridgeCanvasPointerRelay;
    previousRelay?.cleanup?.();
    const pointerId = startEvent.pointerId;
    const isPointerRelay = startEvent.type.startsWith("pointer");
    const matchesActivePointer = (event) => {
        if (isPointerRelay && event.pointerId !== pointerId) return false;
        return true;
    };
    const shouldForward = (event) => {
        if (!matchesActivePointer(event)) return false;
        if (bridgeCanvasEventPathIncludes(event, canvasElement)) return false;
        return bridgeCanvasPointerIsActive(canvas);
    };
    const relayMove = (event) => {
        if (!shouldForward(event)) return;
        forwardBridgeCanvasPointer(event, "processMouseMove");
    };
    const relayUp = (event) => {
        if (matchesActivePointer(event) && !bridgeCanvasEventPathIncludes(event, canvasElement) && bridgeCanvasPointerIsActive(canvas)) {
            forwardBridgeCanvasPointer(event, "processMouseUp");
        }
        cleanup();
    };
    const relayCancel = (event) => {
        if (matchesActivePointer(event) && bridgeCanvasPointerIsActive(canvas)) {
            forwardBridgeCanvasPointer(event, "processMouseCancel");
        }
        cleanup();
    };
    const cleanup = () => {
        document.removeEventListener("pointermove", relayMove, true);
        document.removeEventListener("pointerup", relayUp, true);
        document.removeEventListener("pointercancel", relayCancel, true);
        document.removeEventListener("mousemove", relayMove, true);
        document.removeEventListener("mouseup", relayUp, true);
        window.removeEventListener("blur", relayCancel, true);
        if (document.__webuiBridgeCanvasPointerRelay?.cleanup === cleanup) {
            document.__webuiBridgeCanvasPointerRelay = null;
        }
    };
    document.__webuiBridgeCanvasPointerRelay = { cleanup };
    if (isPointerRelay) {
        document.addEventListener("pointermove", relayMove, true);
        document.addEventListener("pointerup", relayUp, true);
        document.addEventListener("pointercancel", relayCancel, true);
    } else {
        document.addEventListener("mousemove", relayMove, true);
        document.addEventListener("mouseup", relayUp, true);
    }
    window.addEventListener("blur", relayCancel, true);
}

function bridgePanelPointerRequestsCanvasPan(event) {
    return event.button === 1 ||
        event.buttons === 4;
}

function forwardBridgePanelPointerDown(event, handleSelector) {
    const canvas = app?.canvas;
    const wantsCanvasPan = bridgePanelPointerRequestsCanvasPan(event);
    if (event.__webuiBridgeCanvasPointerForwarded) return false;
    if (!canvas || typeof canvas.processMouseDown !== "function") return false;
    if (event.defaultPrevented && !wantsCanvasPan) return false;
    if (!wantsCanvasPan && bridgePanelTargetOwnsPointer(event.target, handleSelector)) return false;
    if (bridgeCanvasPointerIsActive(canvas)) return false;
    const forwarded = forwardBridgeCanvasPointer(event, "processMouseDown");
    if (forwarded && wantsCanvasPan && !bridgeCanvasPointerIsActive(canvas)) {
        dispatchBridgeCanvasPointerFallback(event);
    }
    if (forwarded) event.preventDefault?.();
    return forwarded;
}

function stopBridgeCanvasOwnedPointer(event) {
    event.stopPropagation();
    event.stopImmediatePropagation?.();
}

function cloneBridgeCanvasWheelEvent(event) {
    return new WheelEvent(event.type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        deltaX: event.deltaX,
        deltaY: event.deltaY,
        deltaZ: event.deltaZ,
        deltaMode: event.deltaMode,
        clientX: event.clientX,
        clientY: event.clientY,
        screenX: event.screenX,
        screenY: event.screenY,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        metaKey: event.metaKey,
        button: event.button,
        buttons: event.buttons,
    });
}

function forwardBridgeCanvasWheel(event) {
    const canvas = app?.canvas;
    const canvasElement = canvas?.canvas || document.querySelector("canvas");
    if (!canvasElement || event.__webuiBridgeForwardedWheel) return false;
    const forwarded = cloneBridgeCanvasWheelEvent(event);
    Object.defineProperty(forwarded, "__webuiBridgeForwardedWheel", { value: true });
    if (typeof canvas?.processMouseWheel === "function") {
        try {
            canvas.processMouseWheel(forwarded);
            return true;
        } catch (error) {
            console.warn("[WebUI Prompt Bridge] Failed to forward wheel to ComfyUI canvas", error);
        }
    }
    return canvasElement.dispatchEvent(forwarded);
}

function installBridgeDocumentCanvasPointerCapture(handleSelector) {
    if (document.__webuiBridgeDocumentCanvasPointerCaptureInstalled) return;
    document.__webuiBridgeDocumentCanvasPointerCaptureInstalled = true;
    const captureCanvasPointer = (event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const panel = target.closest?.(".webui-bridge-panel");
        if (!panel || target.closest?.(handleSelector)) return;
        const isPointerStart = event.type === "pointerdown" || (!window.PointerEvent && event.type === "mousedown");
        if (!isPointerStart) return;
        const wantsCanvas = bridgeCanvasHasPendingNodePlacement() || event.button === 1 || event.buttons === 4;
        if (!wantsCanvas) return;
        installBridgeCanvasPointerRelay(event);
        if (forwardBridgePendingNodePlacementPointer(event) ||
            forwardBridgePanelPointerDown(event, handleSelector)) {
            stopBridgeCanvasOwnedPointer(event);
        }
    };
    document.addEventListener("pointerdown", captureCanvasPointer, true);
    document.addEventListener("mousedown", captureCanvasPointer, true);
}

function installBridgePanelCanvasEventGuards(panel) {
    if (!panel || panel.__webuiBridgeCanvasEventGuardsInstalled) return;
    panel.__webuiBridgeCanvasEventGuardsInstalled = true;
    installBridgeCanvasPointerRecovery();
    const handleSelector = [
        ".webui-bridge-resize-grip",
        ".webui-bridge-section-resizer",
        ".webui-bridge-panel-splitter",
        ".webui-bridge-side-resizer",
        ".webui-bridge-node-width-resizer",
        ".webui-bridge-sidebar-width-button",
    ].join(",");
    installBridgeDocumentCanvasPointerCapture(handleSelector);
    const captureCanvasPointer = (event) => {
        if (event.target?.closest?.(handleSelector)) return;
        const isPointerStart = event.type === "pointerdown" || (!window.PointerEvent && event.type === "mousedown");
        if (!isPointerStart) return;
        const wantsCanvas = bridgeCanvasHasPendingNodePlacement() || event.button === 1 || event.buttons === 4;
        if (!wantsCanvas) return;
        installBridgeCanvasPointerRelay(event);
        if (forwardBridgePendingNodePlacementPointer(event) ||
            forwardBridgePanelPointerDown(event, handleSelector)) {
            stopBridgeCanvasOwnedPointer(event);
        }
    };
    const stopCanvasPointer = (event) => {
        if (event.target?.closest?.(handleSelector)) return;
        if (event.type === "pointerdown" || (!window.PointerEvent && event.type === "mousedown")) {
            installBridgeCanvasPointerRelay(event);
        }
        if (event.type === "pointerdown" || (!window.PointerEvent && event.type === "mousedown")) {
            if (forwardBridgePendingNodePlacementPointer(event)) {
                event.stopPropagation();
                return;
            }
            if (forwardBridgePanelPointerDown(event, handleSelector)) {
                event.stopPropagation();
                return;
            }
        }
        event.stopPropagation();
    };
    panel.addEventListener("pointerdown", captureCanvasPointer, true);
    panel.addEventListener("mousedown", captureCanvasPointer, true);
    panel.addEventListener("pointerdown", stopCanvasPointer);
    panel.addEventListener("mousedown", stopCanvasPointer);
    panel.addEventListener("dblclick", stopCanvasPointer);
    panel.addEventListener("contextmenu", stopCanvasPointer);
    panel.addEventListener("wheel", (event) => {
        if (event.defaultPrevented || bridgeScrollableWheelTarget(event.target, event.deltaY)) {
            event.stopPropagation();
            return;
        }
        if (!forwardBridgeCanvasWheel(event)) return;
        event.preventDefault();
        event.stopPropagation();
    }, { passive: false });
}

function scheduleBridgeDomWidgetPin(node, widget, panel) {
    const pin = () => {
        pinBridgeDomWidgetToTop(node, widget);
        const desired = resolveBridgePanelSizeForLiveState(node, { clearConfiguredLock: true });
        node.__webuiBridgeApplyDomWidgetSize?.(desired[0], desired[1]);
        panel?.__webuiBridgeScheduleAdaptiveLayout?.();
    };
    pin();
    requestAnimationFrame(pin);
    window.setTimeout(pin, 0);
    window.setTimeout(pin, 120);
    window.setTimeout(pin, 500);
}

function repairBridgePanelLayoutAfterWorkflow(node, reason = "workflow") {
    if (!node || node.type !== TARGET_NODE) return;
    const run = () => {
        if (!isBridgePanelUsable(node)) {
            scheduleBridgePanelInstall(node);
            return;
        }
        const widget = node.widgets?.find((item) => item?.name === "webui_prompt_frontend" && item.element === node.__webuiBridgePanel);
        const panel = node.__webuiBridgePanel;
        const desired = resolveBridgePanelSizeForLiveState(node, { clearConfiguredLock: true });
        pinBridgeDomWidgetToTop(node, widget);
        if (Math.round(Number(node.size?.[0] || 0)) !== desired[0] ||
            Math.round(Number(node.size?.[1] || 0)) !== desired[1]) {
            node.__webuiBridgeApplyingConfiguredSize = bridgeConfiguredSizeLockActive(node);
            try {
                node.setSize?.([...desired]);
            } finally {
                node.__webuiBridgeApplyingConfiguredSize = false;
            }
        }
        node.__webuiBridgeApplyDomWidgetSize?.(desired[0], desired[1]);
        panel?.__webuiBridgeScheduleAdaptiveLayout?.();
        window.requestAnimationFrame?.(() => panel?.__webuiBridgeScheduleAdaptiveLayout?.());
    };
    run();
    for (const delay of WORKFLOW_LAYOUT_REPAIR_DELAYS) {
        window.setTimeout?.(run, delay);
    }
}

function scheduleBridgePanelLayoutRepairForGraph(reason = "workflow") {
    const repair = () => {
        visitBridgeNodes(getAppGraphSafe(), (node) => repairBridgePanelLayoutAfterWorkflow(node, reason));
    };
    repair();
    for (const delay of WORKFLOW_LAYOUT_REPAIR_DELAYS) {
        window.setTimeout?.(repair, delay);
    }
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

function bridgeInputViewUrl(name) {
    if (!name) return "";
    const normalized = String(name || "").replace(/\\/g, "/");
    const parts = normalized.split("/").filter(Boolean);
    const filename = parts.pop() || "";
    const params = new URLSearchParams({
        filename,
        type: "input",
        rand: String(Date.now()),
    });
    if (parts.length) params.set("subfolder", parts.join("/"));
    const path = `/view?${params.toString()}`;
    return typeof api.apiURL === "function" ? api.apiURL(path) : path;
}

function normalizeBridgeImageRef(value) {
    const name = String(value || "").trim();
    return /\.(png|jpe?g|webp)$/i.test(name) ? name : "";
}

async function uploadBridgeImageInput(file, kind = "image") {
    const form = new FormData();
    form.append("kind", kind);
    form.append("image", file, file.name || `${kind}.png`);
    const response = await api.fetchApi("/webui_prompt_bridge/image_input_upload", {
        method: "POST",
        body: form,
    });
    return bridgeJson(response, "图片上传失败");
}

function canvasBlob(canvas, filename = "mask.png") {
    return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (!blob) {
                reject(new Error("画布导出失败"));
                return;
            }
            resolve(new File([blob], filename, { type: "image/png" }));
        }, "image/png");
    });
}

function showBridgeMaskEditor(node, imageName, maskName, onSaved, widgetNames = {}) {
    const maskWidgetName = widgetNames.mask || "mask";
    const modeWidgetName = widgetNames.mode || "mode";
    if (!imageName) {
        onSaved?.("", "请先上传图片");
        return;
    }
    const overlay = el("div", { class: "webui-bridge-config-mask webui-bridge-image-editor-mask" });
    const status = el("div", { class: "webui-bridge-image-input-status" }, "载入图片...");
    const brushSize = el("input", { type: "range", min: "4", max: "160", step: "2", value: "40" });
    const eraseToggle = el("input", { type: "checkbox" });
    const stage = el("div", { class: "webui-bridge-image-editor-stage" });
    const baseCanvas = el("canvas", {});
    const maskCanvas = el("canvas", {});
    const cursor = el("div", { class: "webui-bridge-image-editor-cursor" });
    stage.append(baseCanvas, maskCanvas, cursor);
    const close = () => overlay.remove();
    const panel = el("div", { class: "webui-bridge-config-panel webui-bridge-image-editor-panel" }, [
        el("div", { class: "webui-bridge-config-head" }, [
            el("div", { class: "webui-bridge-settings-title" }, [
                el("span", {}, "局部涂抹编辑"),
                el("small", {}, "亮色区域会作为 inpaint mask 输出"),
            ]),
            el("button", { type: "button", onclick: close }, "×"),
        ]),
        el("div", { class: "webui-bridge-image-editor-toolbar" }, [
            el("label", {}, [el("span", {}, "画笔"), brushSize]),
            el("label", { class: "webui-bridge-config-check" }, [eraseToggle, el("span", {}, "橡皮")]),
            el("button", { type: "button", onclick: () => {
                maskCanvas.getContext("2d").clearRect(0, 0, maskCanvas.width, maskCanvas.height);
                status.textContent = "Mask 已清空";
            } }, "清空"),
        ]),
        stage,
        status,
        el("div", { class: "webui-bridge-config-actions" }, [
            el("button", { type: "button", onclick: close }, "取消"),
            el("button", {
                type: "button",
                class: "primary",
                onclick: async () => {
                    try {
                        status.textContent = "保存 mask...";
                        const file = await canvasBlob(maskCanvas, "bridge-mask.png");
                        const result = await uploadBridgeImageInput(file, "mask");
                        setWidgetValue(node, maskWidgetName, result.name || "");
                        setWidgetValue(node, modeWidgetName, "inpaint");
                        onSaved?.(result.name || "", "Mask 已保存，模式已切到 Inpaint");
                        close();
                    } catch (error) {
                        status.textContent = error?.message || "Mask 保存失败";
                    }
                },
            }, "保存 Mask"),
        ]),
    ]);

    const paintAt = (event) => {
        const rect = maskCanvas.getBoundingClientRect();
        const scaleX = maskCanvas.width / rect.width;
        const scaleY = maskCanvas.height / rect.height;
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;
        const radius = Number(brushSize.value || 40) * scaleX / 2;
        const ctx = maskCanvas.getContext("2d");
        ctx.save();
        ctx.globalCompositeOperation = eraseToggle.checked ? "destination-out" : "source-over";
        ctx.fillStyle = "rgba(255,255,255,1)";
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    };
    let drawing = false;
    maskCanvas.addEventListener("pointerdown", (event) => {
        drawing = true;
        maskCanvas.setPointerCapture?.(event.pointerId);
        paintAt(event);
    });
    maskCanvas.addEventListener("pointermove", (event) => {
        const rect = maskCanvas.getBoundingClientRect();
        cursor.style.left = `${event.clientX - rect.left}px`;
        cursor.style.top = `${event.clientY - rect.top}px`;
        cursor.style.width = `${brushSize.value}px`;
        cursor.style.height = `${brushSize.value}px`;
        cursor.classList.add("visible");
        if (drawing) paintAt(event);
    });
    maskCanvas.addEventListener("pointerup", () => { drawing = false; });
    maskCanvas.addEventListener("pointerleave", () => {
        drawing = false;
        cursor.classList.remove("visible");
    });
    overlay.addEventListener("mousedown", (event) => {
        if (event.target === overlay) close();
    });
    overlay.append(panel);
    document.body.append(overlay);

    const baseImage = new Image();
    baseImage.onload = () => {
        const maxWidth = Math.min(960, Math.max(420, window.innerWidth - 120));
        const maxHeight = Math.min(680, Math.max(360, window.innerHeight - 260));
        const ratio = Math.min(1, maxWidth / baseImage.naturalWidth, maxHeight / baseImage.naturalHeight);
        const cssWidth = Math.max(240, Math.round(baseImage.naturalWidth * ratio));
        const cssHeight = Math.max(180, Math.round(baseImage.naturalHeight * ratio));
        for (const canvas of [baseCanvas, maskCanvas]) {
            canvas.width = baseImage.naturalWidth;
            canvas.height = baseImage.naturalHeight;
            canvas.style.width = `${cssWidth}px`;
            canvas.style.height = `${cssHeight}px`;
        }
        baseCanvas.getContext("2d").drawImage(baseImage, 0, 0);
        stage.style.width = `${cssWidth}px`;
        stage.style.height = `${cssHeight}px`;
        status.textContent = "按住拖动涂抹需要重绘的区域";
        if (maskName) {
            const maskImage = new Image();
            maskImage.onload = () => {
                maskCanvas.getContext("2d").drawImage(maskImage, 0, 0, maskCanvas.width, maskCanvas.height);
            };
            maskImage.src = bridgeInputViewUrl(maskName);
        }
    };
    baseImage.onerror = () => { status.textContent = "图片载入失败"; };
    baseImage.src = bridgeInputViewUrl(imageName);
}

function buildBridgeImageInputPanel(node, options = {}) {
    const widgetNames = {
        image: options.imageWidget || "image",
        mask: options.maskWidget || "mask",
        mode: options.modeWidget || "mode",
        denoise: options.denoiseWidget || "denoise",
        enabled: options.enabledWidget || "enabled",
    };
    const imageWidget = getWidget(node, widgetNames.image);
    const maskWidget = getWidget(node, widgetNames.mask);
    const modeWidget = getWidget(node, widgetNames.mode);
    const denoiseWidget = getWidget(node, widgetNames.denoise);
    const enabledWidget = getWidget(node, widgetNames.enabled);
    const fileInput = el("input", { type: "file", accept: "image/png,image/jpeg,image/webp", style: { display: "none" } });
    const preview = el("div", { class: "webui-bridge-image-input-preview" });
    const status = el("div", { class: "webui-bridge-image-input-status" });
    const enabledInput = el("input", { type: "checkbox" });
    const modeSelect = el("select", { class: "webui-bridge-config-input" }, [
        el("option", { value: "img2img" }, "Img2Img"),
        el("option", { value: "inpaint" }, "Inpaint"),
    ]);
    const denoise = el("input", { type: "range", min: "0", max: "1", step: "0.01", value: String(denoiseWidget?.value ?? 0.55) });
    const denoiseText = el("span", {}, "");
    const render = () => {
        const imageName = normalizeBridgeImageRef(imageWidget?.value);
        const maskName = normalizeBridgeImageRef(maskWidget?.value);
        modeSelect.value = String(modeWidget?.value || "img2img");
        denoise.value = String(denoiseWidget?.value ?? 0.55);
        enabledInput.checked = enabledWidget ? Boolean(enabledWidget.value) : true;
        preview.classList.toggle("disabled", !enabledInput.checked);
        denoiseText.textContent = Number(denoise.value || 0).toFixed(2);
        preview.innerHTML = "";
        if (imageName) {
            preview.append(el("img", { src: bridgeInputViewUrl(imageName), alt: "" }));
            preview.append(el("span", {}, maskName ? "已上传图片和局部 mask" : "已上传图片"));
        } else {
            preview.append(el("span", {}, "拖入或上传图片"));
        }
        status.textContent = imageName
            ? (enabledInput.checked ? imageName : `${imageName}（未启用）`)
            : "未选择图片";
    };
    enabledInput.addEventListener("change", () => {
        if (enabledWidget) setWidgetValue(node, widgetNames.enabled, enabledInput.checked);
        render();
    });
    modeSelect.addEventListener("change", () => setWidgetValue(node, widgetNames.mode, modeSelect.value));
    denoise.addEventListener("input", () => {
        denoiseText.textContent = Number(denoise.value || 0).toFixed(2);
        setWidgetValue(node, widgetNames.denoise, Number(denoise.value || 0));
    });
    fileInput.addEventListener("change", async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        try {
            status.textContent = "上传图片...";
            const result = await uploadBridgeImageInput(file, "image");
            setWidgetValue(node, widgetNames.image, result.name || "");
            setWidgetValue(node, widgetNames.mask, "");
            if (enabledWidget) setWidgetValue(node, widgetNames.enabled, true);
            render();
        } catch (error) {
            status.textContent = error?.message || "上传失败";
        } finally {
            fileInput.value = "";
        }
    });
    preview.addEventListener("dragover", (event) => {
        event.preventDefault();
        preview.classList.add("dragging");
    });
    preview.addEventListener("dragleave", () => preview.classList.remove("dragging"));
    preview.addEventListener("drop", async (event) => {
        event.preventDefault();
        preview.classList.remove("dragging");
        const file = event.dataTransfer?.files?.[0];
        if (!file) return;
        try {
            status.textContent = "上传图片...";
            const result = await uploadBridgeImageInput(file, "image");
            setWidgetValue(node, widgetNames.image, result.name || "");
            setWidgetValue(node, widgetNames.mask, "");
            if (enabledWidget) setWidgetValue(node, widgetNames.enabled, true);
            render();
        } catch (error) {
            status.textContent = error?.message || "上传失败";
        }
    });
    const panel = el("div", { class: "webui-bridge-image-input-panel" }, [
        el("div", { class: "webui-bridge-image-input-head" }, [
            el("strong", {}, options.title || "WebUI Bridge 图生图"),
            el("small", {}, options.subtitle || "上传原图，必要时打开涂抹编辑局部 mask"),
        ]),
        el("label", { class: "webui-bridge-config-check webui-bridge-image-input-enable" }, [
            enabledInput,
            el("span", {}, "启用图生图输入"),
        ]),
        preview,
        el("div", { class: "webui-bridge-image-input-controls" }, [
            el("button", { type: "button", onclick: () => fileInput.click() }, "上传图片"),
            el("button", {
                type: "button",
                onclick: () => showBridgeMaskEditor(node, normalizeBridgeImageRef(imageWidget?.value), normalizeBridgeImageRef(maskWidget?.value), (_mask, message) => {
                    status.textContent = message || "";
                    render();
                }, widgetNames),
            }, "涂抹局部"),
        ]),
        el("label", {}, [el("span", {}, "模式"), modeSelect]),
        el("label", { class: "webui-bridge-image-input-denoise" }, [
            el("span", {}, "Denoise"),
            denoise,
            denoiseText,
        ]),
        status,
        fileInput,
    ]);
    panel.__webuiBridgeRender = render;
    render();
    return panel;
}

function installBridgeImageInputPanel(node) {
    if (node.__webuiBridgeImageInputInstalled) {
        const desired = [420, 520];
        node.__webuiBridgeImageInputSize = [...desired];
        node.setSize?.([...desired]);
        node.__webuiBridgeImageInputPanel?.__webuiBridgeRender?.();
        return;
    }
    node.__webuiBridgeImageInputInstalled = true;
    for (const widget of node.widgets || []) {
        if (["image", "mask", "mode", "denoise"].includes(widget?.name)) hideWidget(widget);
    }
    const panel = buildBridgeImageInputPanel(node);
    node.__webuiBridgeImageInputPanel = panel;
    const desired = [420, 520];
    node.size = [...desired];
    node.setSize?.([...desired]);
    if (typeof node.computeSize === "function" && !node.__webuiBridgeImageInputComputeWrapped) {
        const originalComputeSize = node.computeSize.bind(node);
        node.computeSize = function (...args) {
            if (node.__webuiBridgeImageInputSize) return [...node.__webuiBridgeImageInputSize];
            return originalComputeSize(...args);
        };
        node.__webuiBridgeImageInputComputeWrapped = true;
    }
    node.__webuiBridgeImageInputSize = [...desired];
    const domWidget = node.addDOMWidget("webui_bridge_image_input", "webui_bridge_image_input", panel, {
        serialize: false,
        hideOnZoom: false,
        getMinHeight: () => 420,
        getMaxHeight: () => 520,
    });
    installWidgetSerializationFallback(domWidget, () => null);
    domWidget.computeSize = () => {
        panel.style.width = "400px";
        panel.style.height = "460px";
        return [400, 460];
    };
    node.color = "#31404f";
    node.bgcolor = "#18212c";
}

function getAppGraphSafe() {
    if (app.rootGraphInternal) return app.rootGraphInternal;
    if (app.canvas?.graph) return app.canvas.graph;
    if (!app.canvas) return null;
    const graphReady = typeof app.isGraphReady === "function" ? app.isGraphReady() : app.isGraphReady;
    if (graphReady === false || (!graphReady && !app.rootGraphInternal)) return null;
    try {
        if (app.rootGraph) return app.rootGraph;
        return app.graph || null;
    } catch {
        return null;
    }
}

function scheduleBridgePanelInstall(node) {
    if (node.__webuiBridgeInstallScheduled) return;
    if (node.__webuiBridgeFreshNode && !node.__webuiBridgeWasConfigured) {
        node.__webuiBridgeInstallScheduled = true;
        try {
            installWebUIPanel(node);
        } finally {
            node.__webuiBridgeInstallScheduled = false;
        }
        return;
    }
    node.__webuiBridgeInstallScheduled = true;
    requestAnimationFrame(() => {
        node.__webuiBridgeInstallScheduled = false;
        installWebUIPanel(node);
    });
}

function markGraphChanged(targetNode = null) {
    const graph = getAppGraphSafe();
    targetNode?.setDirtyCanvas?.(true, true);
    graph?.setDirtyCanvas?.(true, true);
    graph?.change?.();
    app.canvas?.setDirty?.(true, true);
    app.canvas?.setDirtyCanvas?.(true, true);

    const workflowCandidates = [
        app.extensionManager?.workflow?.activeWorkflow,
        app.workflowManager?.activeWorkflow,
        app.ui?.workflowManager?.activeWorkflow,
        window.comfyAPI?.workflow?.activeWorkflow,
    ].filter(Boolean);
    for (const workflow of [...new Set(workflowCandidates)]) {
        if (workflow.changeTracker?.captureCanvasState) {
            workflow.changeTracker.captureCanvasState();
        } else {
            workflow.changeTracker?.checkState?.();
        }
    }
    window.dispatchEvent(new CustomEvent("webui-prompt-bridge-graph-changed", {
        detail: { nodeId: targetNode?.id ?? null },
    }));
}

function setWidgetValue(node, name, value) {
    const widget = getWidget(node, name);
    if (!widget) return;
    widget.value = value;
    widget.callback?.(value);
    markGraphChanged(node);
}

function sanitizeBridgeWidgetValue(name, value) {
    const definition = BRIDGE_WIDGET_DEFINITION_BY_NAME[name];
    if (!definition) return value;
    const [, kind, fallback, choices = []] = definition;
    if (value === undefined || value === null) return fallback;
    if (kind !== "string" && typeof value === "string" && value.trim() === "") return fallback;
    if (kind === "boolean") {
        if (typeof value === "boolean") return value;
        if (typeof value === "number") return value !== 0;
        if (typeof value === "string") return !/^(false|0|off|no)$/i.test(value.trim());
        return Boolean(value);
    }
    if (kind === "number" || kind === "integer") {
        const numeric = Number(value);
        if (!Number.isFinite(numeric)) return fallback;
        return kind === "integer" ? Math.round(numeric) : numeric;
    }
    if (kind === "enum") {
        const text = String(value);
        return choices.includes(text) ? text : fallback;
    }
    if (kind === "string") {
        return value === undefined || value === null ? fallback : String(value);
    }
    return value;
}

function sameBridgeWidgetValue(a, b) {
    return a === b || (Number.isNaN(a) && Number.isNaN(b));
}

function repairBridgeNodeWidgetDefaults(node) {
    if (!node || !Array.isArray(node.widgets)) return 0;
    let changed = 0;
    for (const name of PROMPT_WIDGET_NAMES) {
        const widget = getWidget(node, name);
        if (!widget) continue;
        const repaired = sanitizeBridgeWidgetValue(name, widget.value);
        if (!sameBridgeWidgetValue(widget.value, repaired)) {
            widget.value = repaired;
            changed += 1;
        }
    }
    return changed;
}

function bridgePromptWidgetValuesFromNode(node) {
    repairBridgeNodeWidgetDefaults(node);
    const knownValues = PROMPT_WIDGET_NAMES.map((name) => {
        const widget = getWidget(node, name);
        return sanitizeBridgeWidgetValue(name, widget?.value);
    });
    const unknownTail = Array.isArray(node?.__webuiBridgeUnknownWidgetValues)
        ? node.__webuiBridgeUnknownWidgetValues
        : [];
    if (unknownTail.length) {
        return [...knownValues, ...unknownTail];
    }
    return knownValues;
}

function sanitizeBridgeWidgetsValues(values) {
    if (!Array.isArray(values)) return { values, changed: 0 };
    const next = [...values];
    let changed = values.length < PROMPT_WIDGET_NAMES.length;
    for (let index = 0; index < PROMPT_WIDGET_NAMES.length; index += 1) {
        const name = PROMPT_WIDGET_NAMES[index];
        const repaired = sanitizeBridgeWidgetValue(name, values[index]);
        next[index] = repaired;
        if (!sameBridgeWidgetValue(values[index], repaired)) changed = true;
    }
    return { values: next, changed: changed ? 1 : 0 };
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

function bridgeWidgetValue(node, name, fallback) {
    const value = getWidget(node, name)?.value;
    return sanitizeBridgeWidgetValue(name, value === undefined ? fallback : value);
}

function bridgeBooleanWidgetValue(node, name, fallback = false) {
    const value = getWidget(node, name)?.value;
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "string") return !/^(false|0|off|no)$/i.test(value.trim());
    return Boolean(value);
}

function parseRegionalPromptParts(text = "") {
    return String(text || "")
        .split(/\b(?:BREAK|ADDCOL|ADDROW|ADDBASE|ADDCOMM)\b/i)
        .map((part) => part.trim())
        .filter(Boolean);
}

function parseRegionalRatioRows(ratios = "1,1", split = "vertical") {
    const text = String(ratios || "").trim();
    const rowTexts = split === "grid" || /[;；]/.test(text) ? text.split(/[;；]+/) : [text];
    const rows = rowTexts
        .map((row) => row.split(/[,，\s]+/).map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0))
        .filter((row) => row.length);
    return rows.length ? rows : [[1, 1]];
}

function countRegionalCells(ratios = "1,1", split = "vertical") {
    const rows = parseRegionalRatioRows(ratios, split);
    if (split === "grid" || /[;；]/.test(String(ratios || ""))) return rows.reduce((total, row) => total + row.length, 0);
    return rows[0]?.length || 1;
}

function regionalPromptRegionCount(text = "", baseEnabled = false, commonEnabled = false) {
    const source = String(text || "");
    const parts = parseRegionalPromptParts(source);
    let offset = 0;
    if (commonEnabled || /\bADDCOMM\b/i.test(source)) offset += 1;
    if (baseEnabled || /\bADDBASE\b/i.test(source)) offset += 1;
    return Math.max(0, parts.length - offset);
}

function normalizeRegionalCanvasDimension(value, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.min(16384, Math.max(64, Math.round(numeric)));
}

function normalizeRegionalCanvasSize(width, height, fallbackWidth = DEFAULT_REGIONAL_CANVAS_WIDTH, fallbackHeight = DEFAULT_REGIONAL_CANVAS_HEIGHT) {
    return {
        width: normalizeRegionalCanvasDimension(width, fallbackWidth),
        height: normalizeRegionalCanvasDimension(height, fallbackHeight),
    };
}

function compactKey(value) {
    return String(value || "").replace(/[\s_\-]+/g, "").toLowerCase();
}

function widgetValueByAliases(graphNode, aliases) {
    const wanted = new Set(aliases.map(compactKey));
    for (const widget of graphNode?.widgets || []) {
        const keys = [widget?.name, widget?.label, widget?.displayName, widget?.options?.name].map(compactKey);
        if (keys.some((key) => wanted.has(key))) return widget.value;
    }
    return undefined;
}

function widgetByAliases(graphNode, aliases) {
    const wanted = new Set(aliases.map(compactKey));
    for (const widget of graphNode?.widgets || []) {
        const keys = [widget?.name, widget?.label, widget?.displayName, widget?.options?.name].map(compactKey);
        if (keys.some((key) => wanted.has(key))) return widget;
    }
    return null;
}

function parseSizeText(value) {
    const match = String(value ?? "").match(/\b(\d{2,5})\s*[xX×*]\s*(\d{2,5})\b/);
    if (!match) return null;
    const width = Number(match[1]);
    const height = Number(match[2]);
    if (!Number.isFinite(width) || !Number.isFinite(height)) return null;
    if (width < 64 || height < 64 || width > 16384 || height > 16384) return null;
    return { width: Math.round(width), height: Math.round(height) };
}

function regionalNodeLabel(graphNode) {
    return String(graphNode?.title || graphNode?.type || `Node ${graphNode?.id ?? ""}`).trim();
}

function regionalCanvasSizeFromWidgets(graphNode) {
    const width = widgetValueByAliases(graphNode, REGIONAL_WIDTH_ALIASES);
    const height = widgetValueByAliases(graphNode, REGIONAL_HEIGHT_ALIASES);
    if (width !== undefined && height !== undefined) {
        const size = normalizeRegionalCanvasSize(width, height, null, null);
        if (size.width && size.height) return { ...size, source: regionalNodeLabel(graphNode) };
    }
    for (const text of [
        graphNode?.title,
        graphNode?.type,
        graphNode?.properties?.["Node name for S&R"],
        ...(graphNode?.widgets || []).map((widget) => widget?.value),
    ]) {
        const parsed = parseSizeText(text);
        if (parsed) return { ...parsed, source: regionalNodeLabel(graphNode) };
    }
    return null;
}

function regionalCanvasWritableTarget(graphNode) {
    const widthWidget = widgetByAliases(graphNode, REGIONAL_WIDTH_ALIASES);
    const heightWidget = widgetByAliases(graphNode, REGIONAL_HEIGHT_ALIASES);
    if (!widthWidget || !heightWidget) return null;
    return {
        node: graphNode,
        widthWidget,
        heightWidget,
        source: regionalNodeLabel(graphNode),
    };
}

function regionalCanvasSizeFromImagePreview(graphNode) {
    const images = [
        ...(Array.isArray(graphNode?.imgs) ? graphNode.imgs : []),
        graphNode?.img,
        graphNode?.image,
        graphNode?.preview,
    ].filter(Boolean);
    for (const image of images) {
        const width = image.naturalWidth || image.videoWidth || image.width;
        const height = image.naturalHeight || image.videoHeight || image.height;
        if (Number.isFinite(width) && Number.isFinite(height) && width >= 64 && height >= 64) {
            return { width: Math.round(width), height: Math.round(height), source: regionalNodeLabel(graphNode) };
        }
    }
    return null;
}

function linkedSourceNode(targetNode, inputSlot) {
    const link = getGraphLink(targetNode?.inputs?.[inputSlot]?.link);
    return getGraphNodeById(linkOriginId(link));
}

function sortedRegionalSizeInputs(graphNode) {
    return [...(graphNode?.inputs || [])]
        .map((input, slot) => ({ input, slot }))
        .filter(({ input }) => input?.link !== undefined && input?.link !== null)
        .sort((a, b) => {
            const score = (entry) => {
                const name = `${entry.input?.name || ""} ${entry.input?.label || ""}`.toLowerCase();
                const type = String(entry.input?.type || "").toUpperCase();
                if (name.includes("latent") || name.includes("samples") || type === "LATENT") return 0;
                if (name.includes("image") || type === "IMAGE") return 1;
                return 2;
            };
            return score(a) - score(b);
        });
}

function resolveRegionalCanvasSizeFromNode(graphNode, depth = 5, visited = new Set()) {
    if (!graphNode || depth < 0 || visited.has(graphNode.id)) return null;
    visited.add(graphNode.id);
    const direct = regionalCanvasSizeFromWidgets(graphNode) || regionalCanvasSizeFromImagePreview(graphNode);
    if (direct) return direct;
    for (const { slot } of sortedRegionalSizeInputs(graphNode)) {
        const found = resolveRegionalCanvasSizeFromNode(linkedSourceNode(graphNode, slot), depth - 1, visited);
        if (found) return found;
    }
    return null;
}

function resolveRegionalCanvasTargetFromNode(graphNode, depth = 5, visited = new Set()) {
    if (!graphNode || depth < 0 || visited.has(graphNode.id)) return null;
    visited.add(graphNode.id);
    const direct = regionalCanvasWritableTarget(graphNode);
    if (direct) return direct;
    for (const { slot } of sortedRegionalSizeInputs(graphNode)) {
        const found = resolveRegionalCanvasTargetFromNode(linkedSourceNode(graphNode, slot), depth - 1, visited);
        if (found) return found;
    }
    return null;
}

function collectRegionalDownstreamNodes(sourceNode, maxDepth = 5) {
    const found = [];
    const queue = [{ node: sourceNode, depth: 0 }];
    const seen = new Set([sourceNode?.id]);
    while (queue.length) {
        const { node: current, depth } = queue.shift();
        if (!current || depth >= maxDepth) continue;
        for (const output of current.outputs || []) {
            for (const linkId of output.links || []) {
                const link = getGraphLink(linkId);
                const target = getGraphNodeById(linkTargetId(link));
                if (!target || seen.has(target.id)) continue;
                seen.add(target.id);
                found.push(target);
                queue.push({ node: target, depth: depth + 1 });
            }
        }
    }
    return found;
}

function looksLikeSamplerNode(graphNode) {
    const text = `${graphNode?.type || ""} ${graphNode?.title || ""}`.toLowerCase();
    const hasLatentInput = (graphNode?.inputs || []).some((input) => {
        const name = String(input?.name || input?.label || "").toLowerCase();
        const type = String(input?.type || "").toUpperCase();
        return type === "LATENT" && /latent|sample/.test(name);
    });
    return hasLatentInput && (/sampler|sample|ksampler/.test(text) || (graphNode?.inputs || []).some((input) => /positive|negative/i.test(input?.name || "")));
}

function regionalSamplerLatentInputSlot(graphNode) {
    const preferred = ["latent_image", "latent", "samples"];
    for (const name of preferred) {
        const slot = findInputSlot(graphNode, name);
        if (slot >= 0) return slot;
    }
    return (graphNode?.inputs || []).findIndex((input) => String(input?.type || "").toUpperCase() === "LATENT");
}

function detectRegionalCanvasSizeFromGraph(bridgeNode) {
    const downstream = collectRegionalDownstreamNodes(bridgeNode, 6);
    for (const sampler of downstream.filter(looksLikeSamplerNode)) {
        const slot = regionalSamplerLatentInputSlot(sampler);
        const size = resolveRegionalCanvasSizeFromNode(linkedSourceNode(sampler, slot), 6);
        if (size) return { ...size, source: `${size.source} -> ${regionalNodeLabel(sampler)}` };
    }
    for (const candidate of downstream) {
        const size = resolveRegionalCanvasSizeFromNode(candidate, 2);
        if (size) return size;
    }
    for (const candidate of getGraphNodes()) {
        const text = `${candidate?.type || ""} ${candidate?.title || ""}`.toLowerCase();
        if (!/latent|image|resize|scale|load/.test(text)) continue;
        const size = resolveRegionalCanvasSizeFromNode(candidate, 1);
        if (size) return size;
    }
    return null;
}

function detectRegionalCanvasTargetFromGraph(bridgeNode) {
    const downstream = collectRegionalDownstreamNodes(bridgeNode, 6);
    for (const sampler of downstream.filter(looksLikeSamplerNode)) {
        const slot = regionalSamplerLatentInputSlot(sampler);
        const target = resolveRegionalCanvasTargetFromNode(linkedSourceNode(sampler, slot), 6);
        if (target) return { ...target, source: `${target.source} -> ${regionalNodeLabel(sampler)}` };
    }
    for (const candidate of downstream) {
        const target = resolveRegionalCanvasTargetFromNode(candidate, 2);
        if (target) return target;
    }
    for (const candidate of getGraphNodes()) {
        const text = `${candidate?.type || ""} ${candidate?.title || ""}`.toLowerCase();
        if (!/latent|image|resize|scale|load/.test(text)) continue;
        const target = resolveRegionalCanvasTargetFromNode(candidate, 1);
        if (target) return target;
    }
    return null;
}

function setGraphNodeWidgetObjectValue(graphNode, widget, value) {
    if (!graphNode || !widget || value === undefined || value === null || value === "") return false;
    let nextValue = value;
    if (typeof widget.value === "number") {
        nextValue = Number(value);
        if (!Number.isFinite(nextValue)) return false;
        if (Number.isInteger(widget.value)) nextValue = Math.round(nextValue);
    }
    widget.value = nextValue;
    widget.callback?.(nextValue);
    graphNode.setDirtyCanvas?.(true, true);
    markGraphChanged(graphNode);
    return true;
}

function applyRegionalCanvasSizeToGraph(bridgeNode, width, height) {
    const size = normalizeRegionalCanvasSize(width, height);
    const target = detectRegionalCanvasTargetFromGraph(bridgeNode);
    if (!target) {
        return {
            ok: false,
            width: size.width,
            height: size.height,
            message: "未找到可写入宽高的 Image Size / Resize 节点",
        };
    }
    const widthOk = setGraphNodeWidgetObjectValue(target.node, target.widthWidget, size.width);
    const heightOk = setGraphNodeWidgetObjectValue(target.node, target.heightWidget, size.height);
    return {
        ok: widthOk && heightOk,
        width: size.width,
        height: size.height,
        source: target.source,
        message: widthOk && heightOk
            ? `已同步尺寸到 ${target.source}`
            : `找到 ${target.source}，但宽高写入失败`,
    };
}

function regionalPreviewLayoutRows(rows, split) {
    const grid = split === "grid";
    if (grid) return rows.map((row) => ({ values: row, weight: row.reduce((sum, value) => sum + value, 0) || 1 }));
    const row = rows[0] || [1, 1];
    if (split === "horizontal") return row.map((value) => ({ values: [1], weight: value }));
    return [{ values: row, weight: 1 }];
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
        const rawStart = start;
        const rawEnd = end;
        const raw = source.slice(rawStart, rawEnd);
        const value = raw.trim();
        if (value) {
            const leading = raw.match(/^\s*/)?.[0]?.length || 0;
            const trailing = raw.match(/\s*$/)?.[0]?.length || 0;
            tags.push({
                value,
                start: rawStart + leading,
                end: rawEnd - trailing,
                rawStart,
                rawEnd,
            });
        }
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
    for (let index = 0; index < tags.length; index += 1) {
        const next = tags[index + 1];
        tags[index].separatorAfter = source.slice(tags[index].end, next ? next.start : source.length);
        tags[index].separatorIsTrailing = !next;
    }
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

function loraCategoryText(item) {
    return [
        loraPrimaryCategoryText(item),
        loraTrainingTagText(item),
    ].join("\n");
}

function loraPrimaryCategoryText(item) {
    return [
        item?.folder,
        item?.name,
        item?.alias,
        item?.file_name,
        item?.base_name,
        ...(item?.aliases || []),
        item?.metadata_title,
        item?.metadata_output_name,
        item?.description,
        item?.activation_text,
        item?.notes,
    ].map((value) => String(value || "").toLowerCase()).join("\n");
}

function loraTrainingTagText(item) {
    const trainingTags = Array.isArray(item?.training_tags)
        ? item.training_tags.map((tag) => Array.isArray(tag) ? tag[0] : (tag?.tag || tag))
        : [];
    return trainingTags.slice(0, 24).map((value) => String(value || "").toLowerCase()).join("\n");
}

function loraTopTrainingTags(item, limit = 5) {
    return Array.isArray(item?.training_tags)
        ? item.training_tags.slice(0, limit).map((tag) => String(Array.isArray(tag) ? tag[0] : (tag?.tag || tag) || "").toLowerCase())
        : [];
}

function loraCategoryKeywordScore(text, keyword, weight) {
    const needle = String(keyword || "").trim().toLowerCase();
    if (!needle) return 0;
    if (!text.includes(needle)) return 0;
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const boundary = /^[a-z0-9_ -]+$/i.test(needle)
        ? new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i")
        : null;
    return !boundary || boundary.test(text) ? weight : (weight >= 5 ? weight - 2 : Math.max(1, Math.floor(weight / 2)));
}

function loraAutoCategoryForItem(item) {
    const primaryText = loraPrimaryCategoryText(item);
    const tagText = loraTrainingTagText(item);
    const topTags = loraTopTrainingTags(item);
    let best = { label: "未分类", score: 0 };
    for (const rule of LORA_CATEGORY_RULES) {
        let score = 0;
        for (const keyword of rule.strong || []) {
            score += loraCategoryKeywordScore(primaryText, keyword, 6);
            score += loraCategoryKeywordScore(tagText, keyword, 1);
        }
        for (const keyword of rule.weak || []) {
            score += loraCategoryKeywordScore(primaryText, keyword, 3);
            score += loraCategoryKeywordScore(tagText, keyword, 1);
        }
        if (score > best.score) best = { label: rule.label, score };
    }
    if (topTags.some((tag) => /\bstyle\b|style$|画风|风格|artist|artstyle/.test(tag))) {
        const styleScore = best.label === "画风/风格" ? best.score + 6 : 10;
        if (styleScore > best.score) best = { label: "画风/风格", score: styleScore };
    }
    if (/(^|[^a-z0-9])artist([^a-z0-9]|$)|artstyle|style|画风|风格/.test(primaryText)) {
        const styleScore = best.label === "画风/风格" ? best.score + 4 : 9;
        if (styleScore > best.score) best = { label: "画风/风格", score: styleScore };
    }
    if (/手部修复|手部优化|detail|细节|修复/.test(primaryText)) {
        const qualityScore = best.label === "质量/增强" ? best.score + 4 : 9;
        if (qualityScore > best.score) best = { label: "质量/增强", score: qualityScore };
    }
    if (best.score < 4 && /\b(1girl|1boy|2girls|2boys|solo)\b/.test(tagText)) {
        best = { label: "角色/人物", score: 4 };
    }
    return best.score >= 4 ? best.label : "未分类";
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
    if (filter.startsWith("folder:")) {
        const selectedFolder = filter.slice("folder:".length);
        const itemFolder = item.folder || "Root";
        return itemFolder === selectedFolder || (selectedFolder !== "Root" && itemFolder.startsWith(`${selectedFolder}/`));
    }
    if (filter.startsWith("smart:")) return (item.category_label || loraCategoryForItem(item)) === filter.slice("smart:".length);
    if (filter.startsWith("sd:")) return loraSdVersionLabel(item) === filter.slice("sd:".length);
    if (filter.startsWith("status:")) return loraMetadataStatusLabel(item) === filter.slice("status:".length);
    return item.folder === filter;
}

function loraTreeNodeTitle(node, isRoot = false) {
    if (isRoot) return "全部 LoRA";
    if (node?.path?.startsWith?.("folder:")) {
        const folder = node.path.slice("folder:".length);
        return folder === "Root" ? "Root" : folder;
    }
    if (node?.path?.startsWith?.("smart:")) return `分类: ${node.name}`;
    if (node?.path?.startsWith?.("sd:")) return `模型版本: ${node.name}`;
    if (node?.path?.startsWith?.("status:")) return `整理状态: ${node.name}`;
    return node?.name || "";
}

function setPromptTags(textarea, tags) {
    const items = (tags || [])
        .map((item) => (typeof item === "string" ? { value: item } : item))
        .filter((item) => String(item?.value || "").trim());
    const text = items.map((item, index) => {
        const value = String(item.value || "").trim();
        const separator = String(item.separatorAfter || "");
        if (index === items.length - 1) return value + (item.separatorIsTrailing ? separator : "");
        return value + (/[,，、\n]/.test(separator) ? separator : EXTRA_SEPARATOR);
    }).join("");
    setTextareaValue(textarea, text);
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

function promptSeparatorMarker(separator) {
    const newlines = (String(separator || "").match(/\n/g) || []).length;
    if (!newlines) return null;
    const text = "↵".repeat(Math.min(newlines, 3)) + (newlines > 3 ? "+" : "");
    return {
        text,
        title: newlines > 1 ? `${newlines} 个换行符（包含空行）` : "换行符",
    };
}

function setPromptTagSeparatorAt(textarea, index, separator) {
    const tags = splitPromptTags(textarea.value);
    if (!tags[index]) return false;
    tags[index].separatorAfter = separator;
    tags[index].separatorIsTrailing = index >= tags.length - 1;
    setPromptTags(textarea, tags);
    return true;
}

function removePromptTagSeparatorAt(textarea, index) {
    const tags = splitPromptTags(textarea.value);
    if (!tags[index]) return false;
    tags[index].separatorAfter = index >= tags.length - 1 ? "" : EXTRA_SEPARATOR;
    tags[index].separatorIsTrailing = index >= tags.length - 1;
    setPromptTags(textarea, tags);
    return true;
}

function positionChipTools(chips, chip, tools) {
    if (!chips || !chip || !tools) return;
    const chipsRect = chips.getBoundingClientRect();
    const chipRect = chip.getBoundingClientRect();
    if (!chipsRect.width || !chipRect.width) return;
    const scrollbarWidth = Math.max(0, chips.offsetWidth - chips.clientWidth);
    const viewportLeft = chipsRect.left + 6;
    const viewportRight = chipsRect.right - scrollbarWidth - 6;
    const maxWidth = Math.max(220, Math.min(520, viewportRight - viewportLeft));
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
                window.clearTimeout(chip.__webuiBridgeShowToolsTimer);
                chip.__webuiBridgeShowToolsTimer = window.setTimeout(() => {
                    if (!chip.isConnected) return;
                    chip.classList.add("show-tools");
                    requestAnimationFrame(() => positionChipTools(chips, chip, tools));
                }, 180);
            },
            onmouseleave: () => {
                window.clearTimeout(chip.__webuiBridgeShowToolsTimer);
                window.clearTimeout(chip.__webuiBridgeHideToolsTimer);
                chip.__webuiBridgeHideToolsTimer = window.setTimeout(() => {
                    chip.classList.remove("show-tools");
                }, 420);
            },
            onclick: (event) => {
                if (event.target.closest(".webui-bridge-chip-tools, .webui-bridge-chip-tools-toggle")) return;
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
                if (tag.disabled || event.target.closest(".webui-bridge-chip-tools, .webui-bridge-chip-tools-toggle")) {
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
        const toolsToggle = el("button", {
            class: "webui-bridge-chip-tools-toggle",
            type: "button",
            title: "显示关键词工具",
            onclick: (event) => {
                event.preventDefault();
                event.stopPropagation();
                window.clearTimeout(row.__webuiBridgeClickTimer);
                chip.classList.toggle("show-tools");
                if (chip.classList.contains("show-tools")) {
                    requestAnimationFrame(() => positionChipTools(chips, chip, tools));
                }
            },
        }, "⋯");
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
                if (!tag.disabled) setPromptTagSeparatorAt(textarea, tag.index, ",\n");
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
        chip.append(toolsToggle);
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
        const separatorMarker = !tag.disabled ? promptSeparatorMarker(tag.separatorAfter) : null;
        if (separatorMarker) {
            chips.append(el("div", {
                class: "webui-bridge-prompt-chip webui-bridge-prompt-separator-chip",
                title: `${separatorMarker.title}\n点击删除换行符`,
                draggable: "false",
                onclick: (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    if (removePromptTagSeparatorAt(textarea, tag.index)) afterChange?.();
                },
            }, [
                el("span", { class: "webui-bridge-separator-main" }, separatorMarker.text),
                el("span", { class: "webui-bridge-separator-label" }, "换行符"),
            ]));
        }
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

function extractStyleTextFromPrompt(styleText = "", prompt = "") {
    const strippedPrompt = String(prompt || "").trim();
    const strippedStyleText = String(styleText || "").trim();
    if (strippedStyleText.includes("{prompt}")) {
        const index = strippedStyleText.indexOf("{prompt}");
        const left = strippedStyleText.slice(0, index);
        const right = strippedStyleText.slice(index + "{prompt}".length);
        if (strippedPrompt.startsWith(left) && strippedPrompt.endsWith(right)) {
            return [true, strippedPrompt.slice(left.length, strippedPrompt.length - right.length)];
        }
    } else if (strippedPrompt.endsWith(strippedStyleText)) {
        let extracted = strippedPrompt.slice(0, strippedPrompt.length - strippedStyleText.length);
        if (extracted.endsWith(", ")) extracted = extracted.slice(0, -2);
        return [true, extracted];
    }
    return [false, prompt];
}

function extractOriginalPromptsFromStyle(style, prompt = "", negativePrompt = "") {
    if (!style?.prompt && !style?.negative_prompt) return [false, prompt, negativePrompt];
    const [positiveMatched, extractedPositive] = extractStyleTextFromPrompt(style.prompt || "", prompt);
    if (!positiveMatched) return [false, prompt, negativePrompt];
    const [negativeMatched, extractedNegative] = extractStyleTextFromPrompt(style.negative_prompt || "", negativePrompt);
    if (!negativeMatched) return [false, prompt, negativePrompt];
    return [true, extractedPositive, extractedNegative];
}

function extractStylesFromPrompts(styles = [], prompt = "", negativePrompt = "") {
    const extracted = [];
    const applicable = styles.filter((style) => style?.name && !String(style.name).startsWith("---"));
    let currentPrompt = prompt;
    let currentNegative = negativePrompt;
    while (applicable.length) {
        let foundIndex = -1;
        for (let index = 0; index < applicable.length; index += 1) {
            const [matched, nextPrompt, nextNegative] = extractOriginalPromptsFromStyle(applicable[index], currentPrompt, currentNegative);
            if (!matched) continue;
            foundIndex = index;
            currentPrompt = nextPrompt;
            currentNegative = nextNegative;
            break;
        }
        if (foundIndex < 0) break;
        extracted.push(applicable[foundIndex].name);
        applicable.splice(foundIndex, 1);
    }
    return {
        styles: extracted.reverse(),
        prompt: currentPrompt,
        negative_prompt: currentNegative,
    };
}

function bridgeTimeoutError(message) {
    const error = new Error(message);
    error.name = "TimeoutError";
    error.__webuiBridgeTimeout = true;
    return error;
}

function bridgeAbortError(message = "请求已取消") {
    const error = new Error(message);
    error.name = "AbortError";
    return error;
}

async function fetchBridgeApiWithTimeout(url, options = {}, timeoutMs = 0, timeoutMessage = "请求超时，请稍后重试") {
    const externalSignal = options.signal;
    if (externalSignal?.aborted) throw bridgeAbortError();
    const controller = timeoutMs || externalSignal ? new AbortController() : null;
    let timedOut = false;
    let timer = 0;
    let removeExternalAbort = () => {};
    if (controller && externalSignal) {
        const onExternalAbort = () => controller.abort();
        externalSignal.addEventListener("abort", onExternalAbort, { once: true });
        removeExternalAbort = () => externalSignal.removeEventListener("abort", onExternalAbort);
    }
    if (controller && timeoutMs) {
        timer = globalThis.setTimeout?.(() => {
            timedOut = true;
            controller.abort();
        }, timeoutMs);
    }
    try {
        return await api.fetchApi(url, controller ? { ...options, signal: controller.signal } : options);
    } catch (error) {
        if (timedOut) throw bridgeTimeoutError(timeoutMessage);
        if (externalSignal?.aborted) throw bridgeAbortError();
        throw error;
    } finally {
        if (timer) {
            globalThis.clearTimeout?.(timer);
        }
        removeExternalAbort();
    }
}

function fetchJsonWithTimeout(url, options = {}, timeoutMs = 0, timeoutMessage = "请求超时，请稍后重试") {
    return fetchBridgeApiWithTimeout(url, options, timeoutMs, timeoutMessage).then((r) => r.json());
}

async function loadBridgeData(options = {}) {
    const loraDetail = options.loraDetail === "basic" ? "basic" : "full";
    const loraTimeoutMs = options.loraTimeoutMs ?? (loraDetail === "basic" ? 8000 : 15000);
    const refreshTimeoutMs = options.refreshTimeoutMs ?? WEBUI_REFRESH_TIMEOUT_MS;
    const fetchOptions = { cache: "no-store", signal: options.signal };
    const fallbackLoras = Array.isArray(options.fallbackLoras) ? options.fallbackLoras : [];
    const loadLoras = async () => {
        if (loraDetail === "basic") {
            const data = await fetchJsonWithTimeout("/webui_prompt_bridge/loras?detail=basic", fetchOptions, loraTimeoutMs, "LoRA 列表读取超时，已保留原列表");
            return { ...data, detail: "basic" };
        }
        try {
            const data = await fetchJsonWithTimeout("/webui_prompt_bridge/loras", fetchOptions, loraTimeoutMs, "LoRA 元数据读取超时，已切换到基础列表");
            return { ...data, detail: "full" };
        } catch (error) {
            console.warn("[WebUI Prompt Bridge] Full LoRA metadata load failed; falling back to basic list", error);
            const data = await fetchJsonWithTimeout("/webui_prompt_bridge/loras?detail=basic", fetchOptions, 8000, "LoRA 基础列表读取超时，已保留原列表");
            return { ...data, detail: "basic" };
        }
    };
    const [lorasRes, stylesRes, promptAllInOneRes, modelsRes, webuiRes, settingsRes] = await Promise.allSettled([
        loadLoras(),
        fetchJsonWithTimeout("/webui_prompt_bridge/styles", fetchOptions, refreshTimeoutMs, "样式读取超时"),
        fetchJsonWithTimeout("/webui_prompt_bridge/prompt_all_in_one?lang=zh_CN", fetchOptions, refreshTimeoutMs, "Prompt All in One 数据读取超时"),
        fetchJsonWithTimeout("/webui_prompt_bridge/models", fetchOptions, refreshTimeoutMs, "模型列表读取超时"),
        fetchJsonWithTimeout("/webui_prompt_bridge/webui_integration", fetchOptions, WEBUI_STATUS_TIMEOUT_MS, "WebUI 接入状态读取超时"),
        fetchJsonWithTimeout("/webui_prompt_bridge/settings", fetchOptions, refreshTimeoutMs, "设置读取超时"),
    ]);
    if (options.signal?.aborted) throw bridgeAbortError();
    const lorasLoaded = lorasRes.status === "fulfilled";
    return {
        loras: lorasLoaded ? lorasRes.value.loras || [] : fallbackLoras,
        lorasLoaded,
        loraDetail: lorasLoaded ? lorasRes.value.detail || loraDetail : loraDetail,
        styles: stylesRes.status === "fulfilled" ? stylesRes.value.styles || [] : [],
        promptAllInOne: promptAllInOneRes.status === "fulfilled" ? promptAllInOneRes.value : { group_tags: [], favorites: {} },
        models: modelsRes.status === "fulfilled" ? modelsRes.value : { checkpoints: [], unets: [], clips: [], vaes: [], embeddings: [] },
        webuiIntegration: webuiRes.status === "fulfilled" ? webuiRes.value : null,
        settings: normalizeBridgeSettings(settingsRes.status === "fulfilled" ? settingsRes.value.settings : null),
        customTagCount: settingsRes.status === "fulfilled" ? settingsRes.value.custom_tag_count || 0 : 0,
        assets: settingsRes.status === "fulfilled" ? settingsRes.value.assets || null : null,
        moduleAssets: settingsRes.status === "fulfilled" ? settingsRes.value.module_assets || null : null,
    };
}

function getGraphNodes() {
    return getAppGraphSafe()?._nodes || [];
}

function getGraphNodeById(id) {
    return getAppGraphSafe()?.getNodeById?.(id) || getGraphNodes().find((graphNode) => String(graphNode.id) === String(id));
}

function repairComfyCorePackageMetadata() {
    let changed = 0;
    for (const graphNode of getGraphNodes()) {
        const properties = graphNode?.properties;
        if (!properties || String(properties.cnr_id || "") !== "comfy-core") continue;
        delete properties.cnr_id;
        delete properties.ver;
        changed += 1;
    }
    if (changed) markGraphChanged();
    return changed;
}

function isComfyCoreMissingNodeWarning(item) {
    if (!item || typeof item === "string") return false;
    return String(item.cnrId || item.cnr_id || "") === "comfy-core";
}

function getNodeCnrId(graphNode) {
    const properties = graphNode?.properties || graphNode?.last_serialization?.properties;
    return String(properties?.cnrId || properties?.cnr_id || "");
}

function filterComfyCoreMissingNodeWarnings(missingNodes) {
    if (!Array.isArray(missingNodes)) return 0;
    let writeIndex = 0;
    let changed = 0;
    for (const item of missingNodes) {
        if (isComfyCoreMissingNodeWarning(item)) {
            changed += 1;
            continue;
        }
        missingNodes[writeIndex] = item;
        writeIndex += 1;
    }
    if (changed) missingNodes.length = writeIndex;
    return changed;
}

function pageShowsMissingNodeWarning() {
    const text = document.body?.innerText || "";
    return /缺失节点包|部分节点缺失|Missing Node Packs|comfy-core/i.test(text);
}

function isNodeMutedOrBypassed(graphNode) {
    const mode = Number(graphNode?.mode);
    return mode === 2 || mode === 4;
}

function graphNodeLooksRegistered(graphNode, originalType, registered) {
    if (!originalType) return true;
    if (originalType in registered) return true;
    const constructor = graphNode?.constructor || {};
    const nodeData = constructor.nodeData || {};
    const constructorTypes = [
        constructor.comfyClass,
        constructor.type,
        nodeData.name,
        nodeData.display_name,
    ].map((value) => String(value || ""));
    if (constructorTypes.includes(originalType)) return true;
    for (const registeredNode of Object.values(registered || {})) {
        const registeredData = registeredNode?.nodeData || {};
        const registeredTypes = [
            registeredNode?.comfyClass,
            registeredNode?.type,
            registeredData.name,
            registeredData.display_name,
        ].map((value) => String(value || ""));
        if (registeredTypes.includes(originalType)) return true;
    }
    return false;
}

function liveGraphMissingNodeWarnings() {
    const registered = window.LiteGraph?.registered_node_types || {};
    const warnings = [];
    const visit = (graph, prefix = "") => {
        const nodes = graph?._nodes || graph?.nodes || [];
        for (const graphNode of nodes) {
            if (!graphNode || isNodeMutedOrBypassed(graphNode)) continue;
            const originalType = String(graphNode.last_serialization?.type || graphNode.type || "");
            if (originalType && !graphNodeLooksRegistered(graphNode, originalType, registered)) {
                const nodeId = prefix ? `${prefix}:${graphNode.id}` : String(graphNode.id);
                warnings.push({
                    type: originalType,
                    nodeId,
                    cnrId: getNodeCnrId(graphNode),
                    liveType: String(graphNode.type || ""),
                    constructorName: String(graphNode.constructor?.name || ""),
                    constructorComfyClass: String(graphNode.constructor?.comfyClass || ""),
                    constructorType: String(graphNode.constructor?.type || ""),
                    nodeDataName: String(graphNode.constructor?.nodeData?.name || ""),
                    nodeDataDisplayName: String(graphNode.constructor?.nodeData?.display_name || ""),
                    registeredCount: Object.keys(registered).length,
                });
            }
            const subgraph = graphNode.subgraph;
            if (subgraph) {
                const nextPrefix = prefix ? `${prefix}:${graphNode.id}` : String(graphNode.id);
                visit(subgraph, nextPrefix);
            }
        }
    };
    visit(getAppGraphSafe());
    return warnings;
}

function getDialogServiceModuleUrls() {
    const urls = [];
    const addUrl = (value) => {
        if (!value) return;
        const absolute = new URL(value, window.location.href).href;
        if (!/\/assets\/dialogService-[^/]+\.js(?:$|\?)/.test(absolute)) return;
        if (!urls.includes(absolute)) urls.push(absolute);
    };
    document.querySelectorAll('link[rel="modulepreload"], script[type="module"]').forEach((element) => {
        addUrl(element.getAttribute("href") || element.getAttribute("src"));
    });
    return urls;
}

async function loadComfyWorkflowService() {
    if (BRIDGE_DEBUG.workflowServicePromise) return BRIDGE_DEBUG.workflowServicePromise;
    BRIDGE_DEBUG.workflowServicePromise = (async () => {
        const urls = getDialogServiceModuleUrls();
        BRIDGE_DEBUG.workflowServiceUrls = urls;
        for (const url of urls) {
            try {
                const module = await import(url);
                const useWorkflowService = module.useWorkflowService || module.K;
                if (typeof useWorkflowService === "function") return useWorkflowService();
            } catch (error) {
                console.debug("[WebUI Prompt Bridge] Failed to import ComfyUI workflow service", url, error);
            }
        }
        return null;
    })();
    return BRIDGE_DEBUG.workflowServicePromise;
}

async function clearStaleMissingNodeWarningIfGraphClean(reason = "scheduled") {
    const visibleWarning = pageShowsMissingNodeWarning();
    if (!visibleWarning) {
        BRIDGE_DEBUG.lastMissingNodeClear = { reason, cleared: false, liveWarnings: [], visibleWarning: false, skipped: true };
        return true;
    }
    let liveWarnings = [];
    try {
        liveWarnings = liveGraphMissingNodeWarnings();
    } catch (error) {
        BRIDGE_DEBUG.lastMissingNodeClear = { reason, cleared: false, graphUnavailable: true, error: String(error?.message || error) };
        return false;
    }
    const realWarnings = liveWarnings.filter((item) => !isComfyCoreMissingNodeWarning(item));
    if (realWarnings.length) {
        BRIDGE_DEBUG.lastMissingNodeClear = { reason, cleared: false, liveWarnings, realWarnings };
        console.warn("[WebUI Prompt Bridge] Missing-node warning preserved; live graph still has missing nodes", JSON.stringify(BRIDGE_DEBUG.lastMissingNodeClear));
        return false;
    }
    const workflowService = await loadComfyWorkflowService();
    if (typeof workflowService?.showPendingWarnings !== "function") {
        BRIDGE_DEBUG.lastMissingNodeClear = { reason, cleared: false, liveWarnings, serviceMissing: true };
        console.warn("[WebUI Prompt Bridge] Missing-node warning clear skipped; workflow service not found", BRIDGE_DEBUG.lastMissingNodeClear);
        return false;
    }
    workflowService.showPendingWarnings({ pendingWarnings: null }, { silent: true });
    BRIDGE_DEBUG.lastMissingNodeClear = { reason, cleared: true, liveWarnings };
    return true;
}

function scheduleStaleMissingNodeWarningClear(reason = "scheduled") {
    window.setTimeout(() => clearStaleMissingNodeWarningIfGraphClean(reason), 700);
    window.setTimeout(() => clearStaleMissingNodeWarningIfGraphClean(reason), 1800);
    window.setTimeout(() => clearStaleMissingNodeWarningIfGraphClean(reason), 3600);
}

function sanitizeComfyCorePackageMetadataInWorkflowData(data) {
    if (!data || typeof data !== "object") return 0;
    let changed = 0;
    const cleanNodes = (nodes) => {
        if (!Array.isArray(nodes)) return;
        for (const nodeData of nodes) {
            if (nodeData?.type === TARGET_NODE) {
                if (shouldRepairBridgePanelSize(nodeData.size)) {
                    nodeData.size = clampPanelSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT);
                    changed += 1;
                }
                if (Array.isArray(nodeData.widgets_values)) {
                    const repaired = sanitizeBridgeWidgetsValues(nodeData.widgets_values);
                    if (repaired.changed) {
                        nodeData.widgets_values = repaired.values;
                        changed += repaired.changed;
                    }
                }
            }
            const properties = nodeData?.properties;
            if (!properties || String(properties.cnr_id || "") !== "comfy-core") continue;
            delete properties.cnr_id;
            delete properties.ver;
            changed += 1;
        }
    };
    cleanNodes(data.nodes);
    for (const subgraph of data.definitions?.subgraphs || []) {
        cleanNodes(subgraph?.nodes);
    }
    return changed;
}

async function repairComfyCorePackageMetadataAndReload() {
    if (app.__webuiBridgeComfyCoreReloadDone || typeof app.loadGraphData !== "function") return 0;
    const changed = repairComfyCorePackageMetadata();
    if (!changed) return 0;
    const graphData = safeGraphSerialization();
    if (!graphData || graphData.error || !Array.isArray(graphData.nodes)) return changed;
    sanitizeComfyCorePackageMetadataInWorkflowData(graphData);
    app.__webuiBridgeComfyCoreReloadDone = true;
    try {
        await app.loadGraphData(graphData, true, true, undefined, {
            checkForRerouteMigration: false,
            silentAssetErrors: true,
            skipAssetScans: true,
        });
    } catch (error) {
        console.warn("[WebUI Prompt Bridge] Failed to reload repaired comfy-core workflow metadata", error);
    }
    return changed;
}

function scheduleComfyCorePackageMetadataRepair() {
    window.setTimeout(repairComfyCorePackageMetadataAndReload, 500);
    window.setTimeout(repairComfyCorePackageMetadataAndReload, 1500);
    window.setTimeout(repairComfyCorePackageMetadataAndReload, 3000);
}

function visitBridgeNodes(graph, visitor) {
    const nodes = graph?._nodes || graph?.nodes || [];
    if (!Array.isArray(nodes)) return;
    for (const node of nodes) {
        if (node?.type === TARGET_NODE) visitor(node);
        if (node?.subgraph) visitBridgeNodes(node.subgraph, visitor);
    }
}

function repairLiveBridgeWidgetDefaults() {
    let changed = 0;
    visitBridgeNodes(getAppGraphSafe(), (node) => {
        changed += repairBridgeNodeWidgetDefaults(node);
    });
    return changed;
}

function installGraphToPromptWidgetRepair() {
    if (app.__webuiBridgeGraphToPromptRepairInstalled || typeof app.graphToPrompt !== "function") return;
    const originalGraphToPrompt = app.graphToPrompt.bind(app);
    app.graphToPrompt = function (...args) {
        repairLiveBridgeWidgetDefaults();
        return originalGraphToPrompt(...args);
    };
    app.__webuiBridgeGraphToPromptRepairInstalled = true;
}

function scheduleGraphToPromptWidgetRepairInstall() {
    installGraphToPromptWidgetRepair();
    window.setTimeout(installGraphToPromptWidgetRepair, 0);
    window.setTimeout(installGraphToPromptWidgetRepair, 500);
    window.setTimeout(installGraphToPromptWidgetRepair, 1500);
}

function installWorkflowLoadSanitizer() {
    if (app.__webuiBridgeWorkflowLoadSanitizerInstalled) return;
    app.__webuiBridgeWorkflowLoadSanitizerInstalled = true;
    if (typeof app.loadGraphData === "function") {
        const originalLoadGraphData = app.loadGraphData.bind(app);
        app.loadGraphData = async function (graphData, ...args) {
            sanitizeComfyCorePackageMetadataInWorkflowData(graphData);
            const result = await originalLoadGraphData(graphData, ...args);
            scheduleBridgePanelLayoutRepairForGraph("loadGraphData");
            return result;
        };
    }
    const installGraphConfigurePatch = () => {
        const prototype = window.LGraph?.prototype;
        if (!prototype || prototype.__webuiBridgeWorkflowLoadSanitizerInstalled || typeof prototype.configure !== "function") return;
        const originalConfigure = prototype.configure;
        prototype.configure = function (graphData, ...args) {
            sanitizeComfyCorePackageMetadataInWorkflowData(graphData);
            const result = originalConfigure.call(this, graphData, ...args);
            scheduleBridgePanelLayoutRepairForGraph("LGraph.configure");
            return result;
        };
        prototype.__webuiBridgeWorkflowLoadSanitizerInstalled = true;
    };
    installGraphConfigurePatch();
    window.setTimeout(installGraphConfigurePatch, 0);
    window.setTimeout(installGraphConfigurePatch, 500);
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
    markGraphChanged(targetNode);
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

function checkpointWidgetLooksLikeCheckpoint(graphNode, widget) {
    const widgetName = String(widget?.name || "").toLowerCase();
    const nodeText = `${graphNode?.type || ""} ${graphNode?.title || ""} ${graphNode?.properties?.["Node name for S&R"] || ""}`.toLowerCase();
    return widgetName === "ckpt_name" || (widgetName.includes("ckpt") && /checkpoint/.test(nodeText));
}

function findCheckpointWidgetTargets() {
    const targets = [];
    for (const graphNode of getGraphNodes()) {
        for (const widget of graphNode.widgets || []) {
            if (checkpointWidgetLooksLikeCheckpoint(graphNode, widget)) targets.push({ graphNode, widget });
        }
    }
    return targets;
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
    markGraphChanged(loader);
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

function applyDirectCheckpointModel(modelName, models = {}) {
    const loader = findDirectCheckpointLoader();
    if (!loader) return { changed: false, message: "未找到也无法创建 CheckpointLoaderSimple" };
    const modelChanged = setNodeWidgetValue(loader, "ckpt_name", modelName);
    const state = directSwitchState();
    state.checkpointNodeId = loader.id;
    let changed = modelChanged ? 1 : 0;
    const syncedMissing = syncMissingCheckpointLoadersToModel(modelName, { models, skipNodeId: loader.id });
    changed += syncedMissing;
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
        message: `已直接切换到整合模型: ${modelName}${syncedMissing ? `；已同步 ${syncedMissing} 个缺失 CheckpointLoader` : ""}`,
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
    const checkpointList = (models.checkpoints || []).map((checkpoint) => String(checkpoint || "").trim()).filter(Boolean);
    const checkpointKeys = new Set();
    for (const checkpoint of checkpointList) {
        add(checkpoint);
        addCheckpointLookupKeys(checkpointKeys, checkpoint);
    }
    for (const { widget } of findCheckpointWidgetTargets()) {
        if (checkpointList.length) {
            if (checkpointLookupHas(checkpointKeys, widget?.value)) add(widget?.value);
            continue;
        }
        for (const value of widget?.options?.values || []) add(value);
        add(widget?.value);
    }
    return options;
}

function checkpointLookupKeys(value) {
    const text = String(value || "").trim().replace(/\\/g, "/");
    if (!text) return [];
    const lower = text.toLowerCase();
    const base = lower.split("/").pop();
    return [...new Set([lower, base].filter(Boolean))];
}

function addCheckpointLookupKeys(target, value) {
    for (const key of checkpointLookupKeys(value)) target.add(key);
}

function checkpointLookupHas(target, value) {
    return checkpointLookupKeys(value).some((key) => target.has(key));
}

function checkpointNamesMatch(left, right) {
    if (!left || !right) return false;
    const rightKeys = new Set(checkpointLookupKeys(right));
    return checkpointLookupKeys(left).some((key) => rightKeys.has(key));
}

function availableCheckpointLookupKeys(models = {}) {
    const keys = new Set();
    const checkpointList = (models.checkpoints || []).map((checkpoint) => String(checkpoint || "").trim()).filter(Boolean);
    for (const checkpoint of checkpointList) addCheckpointLookupKeys(keys, checkpoint);
    if (checkpointList.length) return keys;
    for (const { widget } of findCheckpointWidgetTargets()) {
        for (const value of widget?.options?.values || []) addCheckpointLookupKeys(keys, value);
    }
    return keys;
}

function syncMissingCheckpointLoadersToModel(modelName, options = {}) {
    const selected = String(modelName || "").trim();
    const available = availableCheckpointLookupKeys(options.models || {});
    if (!selected || !available.size || !checkpointLookupHas(available, selected)) return 0;
    let changed = 0;
    for (const { graphNode, widget } of findCheckpointWidgetTargets()) {
        if (String(graphNode.id) === String(options.skipNodeId || "")) continue;
        const current = String(widget?.value || "").trim();
        if (!current || checkpointNamesMatch(current, selected) || checkpointLookupHas(available, current)) continue;
        if (setGraphNodeWidgetObjectValue(graphNode, widget, selected)) changed += 1;
    }
    if (changed) markGraphChanged();
    return changed;
}

function scheduleMissingModelRefresh(reason = "checkpoint-sync") {
    window.clearTimeout(BRIDGE_DEBUG.missingModelRefreshTimer);
    BRIDGE_DEBUG.missingModelRefreshTimer = window.setTimeout(async () => {
        if (typeof app.refreshMissingModels !== "function") return;
        try {
            BRIDGE_DEBUG.lastMissingModelRefresh = {
                reason,
                result: await app.refreshMissingModels({ silent: true }),
            };
        } catch (error) {
            BRIDGE_DEBUG.lastMissingModelRefresh = { reason, error: String(error?.message || error) };
            console.warn("[WebUI Prompt Bridge] Missing-model refresh failed", BRIDGE_DEBUG.lastMissingModelRefresh);
        }
    }, 400);
}

function safeGraphSerialization() {
    try {
        const graph = getAppGraphSafe();
        return graph?.serialize?.() || graph?.asSerialisable?.() || graph?.asSerializable?.() || null;
    } catch (error) {
        return { error: String(error?.message || error) };
    }
}

function collectTextHits(value, needle, path = "$", hits = [], seen = new Set()) {
    if (!needle || hits.length >= 200 || value === undefined || value === null) return hits;
    const lowerNeedle = String(needle).toLowerCase();
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        const text = String(value);
        if (text.toLowerCase().includes(lowerNeedle)) hits.push({ path, value: text.slice(0, 500) });
        return hits;
    }
    if (typeof value !== "object" || seen.has(value)) return hits;
    seen.add(value);
    if (Array.isArray(value)) {
        value.forEach((item, index) => collectTextHits(item, needle, `${path}[${index}]`, hits, seen));
        return hits;
    }
    for (const [key, item] of Object.entries(value)) {
        collectTextHits(item, needle, `${path}.${key}`, hits, seen);
    }
    return hits;
}

function checkpointWidgetDebugRows(models = {}) {
    const available = availableCheckpointLookupKeys(models);
    return findCheckpointWidgetTargets().map(({ graphNode, widget }) => ({
        id: graphNode.id,
        type: graphNode.type,
        title: graphNode.title,
        widget: widget.name,
        value: widget.value,
        valid: checkpointLookupHas(available, widget.value),
        optionCount: widget.options?.values?.length || 0,
    }));
}

function visibleMissingModelText() {
    const text = document.body?.innerText || "";
    const markers = ["缺失模型", "Missing Models", "missing model", "v1-5", "v1_5"];
    const hits = [];
    for (const marker of markers) {
        const index = text.toLowerCase().indexOf(marker.toLowerCase());
        if (index >= 0) hits.push(text.slice(Math.max(0, index - 120), index + 260));
    }
    return [...new Set(hits)];
}

function installBridgeDebugHelpers() {
    Object.assign(BRIDGE_DEBUG, {
        app,
        markGraphChanged,
        checkpointWidgets: () => checkpointWidgetDebugRows(BRIDGE_DEBUG.models || {}),
        checkpointLoaders: () => findCheckpointLoaderNodes().map((graphNode) => ({
            id: graphNode.id,
            type: graphNode.type,
            title: graphNode.title,
            value: getNodeWidgetValue(graphNode, "ckpt_name"),
        })),
        currentCheckpointName,
        graphHits: (needle = "v1-5") => collectTextHits(safeGraphSerialization(), needle),
        graphSerialization: safeGraphSerialization,
        visibleMissingModelText,
        repairComfyCorePackageMetadata,
        liveGraphMissingNodeWarnings,
        clearStaleMissingNodeWarningIfGraphClean,
        syncMissingTo: (modelName = currentCheckpointName()) => {
            const changed = syncMissingCheckpointLoadersToModel(modelName, { models: BRIDGE_DEBUG.models || {} });
            markGraphChanged();
            if (changed) scheduleMissingModelRefresh("debug-syncMissingTo");
            return { changed, modelName, checkpointWidgets: checkpointWidgetDebugRows(BRIDGE_DEBUG.models || {}) };
        },
    });
}

installBridgeDebugHelpers();

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

function applyCheckpointModel(name, models = {}) {
    const modelName = String(name || "").trim();
    if (!modelName) return { changed: false, message: "请选择模型" };
    const switchNode = findModelModeSwitchNode();
    if (!switchNode) return applyDirectCheckpointModel(modelName, models);
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
    const data = await bridgeJson(response, "样式保存失败");
    return data.styles || [];
}

async function translatePromptAllInOne(text, to = "english") {
    const response = await api.fetchApi("/webui_prompt_bridge/prompt_all_in_one/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, to, lang: "zh_CN" }),
    });
    return await bridgeJson(response, "翻译失败");
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
    return bridgeJson(response, "读取 LoRA 备注失败");
}

async function saveLoraUserMetadata(name, values) {
    const response = await api.fetchApi("/webui_prompt_bridge/lora_user_metadata", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...values }),
    });
    return bridgeJson(response, "保存 LoRA 备注失败");
}

async function replaceLoraPreview(name, file) {
    const form = new FormData();
    form.append("name", name);
    form.append("preview", file);
    const response = await api.fetchApi("/webui_prompt_bridge/lora_preview", {
        method: "POST",
        body: form,
    });
    return bridgeJson(response, "替换 LoRA 预览图失败");
}

async function fetchWebUIIntegration(options = {}) {
    const response = await fetchBridgeApiWithTimeout(
        "/webui_prompt_bridge/webui_integration",
        { cache: "no-store", signal: options.signal },
        options.timeoutMs ?? WEBUI_STATUS_TIMEOUT_MS,
        "读取 WebUI 接入状态超时；如果电脑有断开的移动盘/网盘，请先断开或手动填写 WebUI 根目录后重试",
    );
    if (!response.ok) {
        if (response.status === 404) throw new Error("后端接口未加载，请重启 ComfyUI 后再打开一键接入");
        const { message } = await readBridgeResponse(response, `读取 WebUI 接入状态失败 (${response.status})`);
        throw new Error(message);
    }
    return response.json();
}

async function connectWebUIRoot(webuiRoot, autoDetect = false, options = {}) {
    const response = await fetchBridgeApiWithTimeout(
        "/webui_prompt_bridge/webui_integration",
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ webui_root: webuiRoot, auto_detect: autoDetect }),
            signal: options.signal,
        },
        options.timeoutMs ?? WEBUI_CONNECT_TIMEOUT_MS,
        "WebUI 接入超时；已停止等待，请确认根目录能访问后重新点击。8/9 通常只是缺少一个可选目录，不代表接入失败",
    );
    const { data, message, text } = await readBridgeResponse(response, `WebUI 接入失败 (${response.status})，请确认选择的是 WebUI 根目录`);
    if (!response.ok) {
        if (response.status === 404) throw new Error("后端接口未加载，请重启 ComfyUI 后再点一键接入");
        throw new Error(message || text || `WebUI 接入失败 (${response.status})，请确认选择的是 WebUI 根目录`);
    }
    return data;
}

async function saveBridgeSettings(settings) {
    const response = await api.fetchApi("/webui_prompt_bridge/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
    });
    return bridgeJson(response, "保存设置失败");
}

async function fetchModuleAssets() {
    const response = await api.fetchApi("/webui_prompt_bridge/module_assets", { cache: "no-store" });
    if (!response.ok) {
        if (response.status === 404) throw new Error("后端接口未加载，请重启 ComfyUI 后读取扩展状态");
        const { message } = await readBridgeResponse(response, `扩展状态读取失败 (${response.status})，请确认已重启 ComfyUI`);
        throw new Error(message);
    }
    return response.json();
}

async function installModuleAssets(assets) {
    const response = await api.fetchApi("/webui_prompt_bridge/install_module_assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets }),
    });
    const { data, message } = await readBridgeResponse(response, "模块节点包安装失败");
    if (response.status === 404) throw new Error("后端接口未加载，请重启 ComfyUI 后再下载扩展");
    if (!response.ok) throw new Error(message);
    return data;
}

async function fetchAIConfig() {
    const response = await api.fetchApi("/webui_prompt_bridge/ai_config", { cache: "no-store" });
    return bridgeJson(response, "读取 AI 配置失败");
}

async function saveAIConfig(config) {
    const response = await api.fetchApi("/webui_prompt_bridge/ai_config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
    });
    if (!response.ok) {
        if (response.status === 405) throw new Error("后端接口还是旧版本，请重启 ComfyUI 后再保存 AI 配置");
        const { message } = await readBridgeResponse(response, "保存 AI 配置失败");
        throw new Error(message);
    }
    return response.json();
}

async function testAIConfig(prompt) {
    const response = await api.fetchApi("/webui_prompt_bridge/ai_config/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
    });
    return bridgeJson(response, "AI 接口测试失败");
}

async function fetchAIModels(config) {
    const response = await api.fetchApi("/webui_prompt_bridge/ai_config/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config || {}),
    });
    const { data, message } = await readBridgeResponse(response, "模型检测失败");
    if (!response.ok) {
        if (response.status === 405) throw new Error("后端接口还是旧版本，请重启 ComfyUI 后再检测模型");
        throw new Error(message);
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
    return bridgeJson(response, "导入失败");
}

async function fetchCustomTags() {
    const response = await api.fetchApi("/webui_prompt_bridge/custom_tags", { cache: "no-store" });
    return bridgeJson(response, "读取自定义标签失败");
}

async function saveCustomTag(index, item) {
    const response = await api.fetchApi("/webui_prompt_bridge/custom_tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index, item }),
    });
    return bridgeJson(response, "保存自定义标签失败");
}

async function deleteCustomTag(index) {
    const response = await api.fetchApi(`/webui_prompt_bridge/custom_tags?index=${encodeURIComponent(index)}`, {
        method: "DELETE",
    });
    return bridgeJson(response, "删除自定义标签失败");
}

async function fetchPromptMarketSources() {
    const response = await api.fetchApi("/webui_prompt_bridge/prompt_market", { cache: "no-store" });
    return bridgeJson(response, "读取提示词市场失败");
}

async function importPromptMarketSource(sourceId) {
    const response = await api.fetchApi("/webui_prompt_bridge/prompt_market/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_id: sourceId }),
    });
    return bridgeJson(response, "导入失败");
}

async function installBridgeAssets(mode, webuiRoot = "") {
    const response = await api.fetchApi("/webui_prompt_bridge/install_assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, webui_root: webuiRoot }),
    });
    const { data, text } = await readBridgeResponse(response, "下载失败");
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
    return bridgeJson(response, "更新提示词收藏失败");
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
        if (collapseButton) collapseButton.textContent = collapsed ? "展开反向" : "折叠反向";
        for (const part of [textarea, chips, textChipGrip, chipBottomGrip, counter]) {
            if (part) part.style.display = collapsed ? "none" : "";
        }
        row?.closest?.(".webui-bridge-panel")?.__webuiBridgeScheduleAdaptiveLayout?.();
    };
    if (options.collapsible) {
        collapseButton = el("button", {
            class: "webui-bridge-prompt-label-btn webui-bridge-collapse-btn",
            title: "折叠/展开这个提示词区域",
            onclick: () => {
                applyCollapsedState(!collapsed);
                writeLocalBoolean(collapseKey, collapsed);
            },
        }, collapsed ? "展开反向" : "折叠反向");
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
    row.__webuiBridgeSetCollapsed = (nextCollapsed, persist = false) => {
        applyCollapsedState(nextCollapsed);
        if (persist) writeLocalBoolean(collapseKey, collapsed);
    };
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
    const panel = el("div", { class: "webui-bridge-panel webui-bridge-panel-error" }, [
        el("div", { class: "webui-bridge-error-title" }, "WebUI Prompt Bridge failed to render"),
        el("pre", {}, message),
    ]);
    installBridgePanelCanvasEventGuards(panel);
    return panel;
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
        writeLocalString(storageKey, JSON.stringify({ activeGroup, activeSubGroup }));
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
    repairBridgeNodeWidgetDefaults(node);
    const positiveWidget = getWidget(node, "positive_prompt");
    const negativeWidget = getWidget(node, "negative_prompt");
    const clipStrengthWidget = getWidget(node, "default_clip_strength");
    const regionalSplitWidget = getWidget(node, "regional_split");
    const regionalRatiosWidget = getWidget(node, "regional_ratios");
    const regionalBaseRatioWidget = getWidget(node, "regional_base_ratio");
    const regionalStrengthWidget = getWidget(node, "regional_strength");
    const regionalCanvasAutoWidget = getWidget(node, "regional_canvas_auto");
    const regionalCanvasWidthWidget = getWidget(node, "regional_canvas_width");
    const regionalCanvasHeightWidget = getWidget(node, "regional_canvas_height");
    const moduleMaskEnabledWidget = getWidget(node, "module_mask_enabled");
    const moduleMaskStrengthWidget = getWidget(node, "module_mask_strength");
    const moduleMaskSetAreaToBoundsWidget = getWidget(node, "module_mask_set_area_to_bounds");
    const moduleTableEnabledWidget = getWidget(node, "module_table_enabled");
    const moduleNegativeCommonEnabledWidget = getWidget(node, "module_negative_common_enabled");
    const moduleNegativeCommonPromptWidget = getWidget(node, "module_negative_common_prompt");
    const moduleFlipEnabledWidget = getWidget(node, "module_flip_enabled");
    const moduleFlipAxisWidget = getWidget(node, "module_flip_axis");
    const modulePresetsEnabledWidget = getWidget(node, "module_presets_enabled");
    const moduleImg2ImgImageWidget = getWidget(node, "module_img2img_image");
    const moduleImg2ImgMaskWidget = getWidget(node, "module_img2img_mask");
    const moduleImg2ImgModeWidget = getWidget(node, "module_img2img_mode");
    const moduleImg2ImgDenoiseWidget = getWidget(node, "module_img2img_denoise");
    const moduleImg2ImgEnabledWidget = getWidget(node, "module_img2img_enabled");
    const moduleAdetailerEnabledWidget = getWidget(node, "module_adetailer_enabled");
    const moduleAdetailerModelWidget = getWidget(node, "module_adetailer_model");
    const moduleAdetailerPromptWidget = getWidget(node, "module_adetailer_prompt");
    const moduleAdetailerNegativePromptWidget = getWidget(node, "module_adetailer_negative_prompt");
    const moduleAdetailerConfidenceWidget = getWidget(node, "module_adetailer_confidence");
    const moduleAdetailerMaskBlurWidget = getWidget(node, "module_adetailer_mask_blur");
    const moduleAdetailerDenoiseWidget = getWidget(node, "module_adetailer_denoise");
    const moduleAdetailerInpaintOnlyMaskedWidget = getWidget(node, "module_adetailer_inpaint_only_masked");
    const moduleAdetailerCyclesWidget = getWidget(node, "module_adetailer_cycles");
    const moduleControlnetEnabledWidget = getWidget(node, "module_controlnet_enabled");
    const moduleControlnetPreprocessorWidget = getWidget(node, "module_controlnet_preprocessor");
    const moduleControlnetModelWidget = getWidget(node, "module_controlnet_model");
    const moduleControlnetWeightWidget = getWidget(node, "module_controlnet_weight");
    const moduleControlnetStartWidget = getWidget(node, "module_controlnet_start");
    const moduleControlnetEndWidget = getWidget(node, "module_controlnet_end");
    const moduleControlnetResizeModeWidget = getWidget(node, "module_controlnet_resize_mode");
    const moduleControlnetControlModeWidget = getWidget(node, "module_controlnet_control_mode");
    const moduleControlnetPixelPerfectWidget = getWidget(node, "module_controlnet_pixel_perfect");
    const moduleSamEnabledWidget = getWidget(node, "module_sam_enabled");
    const moduleSamModelWidget = getWidget(node, "module_sam_model");
    const moduleSamPromptModeWidget = getWidget(node, "module_sam_prompt_mode");
    const moduleSamConfidenceWidget = getWidget(node, "module_sam_confidence");
    const moduleSamMaskBlurWidget = getWidget(node, "module_sam_mask_blur");
    const moduleSamDilateWidget = getWidget(node, "module_sam_dilate");
    const moduleSamInpaintDenoiseWidget = getWidget(node, "module_sam_inpaint_denoise");
    const moduleSamInpaintAreaWidget = getWidget(node, "module_sam_inpaint_area");
    const moduleSamPaddingWidget = getWidget(node, "module_sam_padding");
    const moduleUpscaleEnabledWidget = getWidget(node, "module_upscale_enabled");
    const moduleUpscaleModeWidget = getWidget(node, "module_upscale_mode");
    const moduleUpscaleByWidget = getWidget(node, "module_upscale_by");
    const moduleUpscaleUpscalerWidget = getWidget(node, "module_upscale_upscaler");
    const moduleUpscaleStepsWidget = getWidget(node, "module_upscale_steps");
    const moduleUpscaleDenoiseWidget = getWidget(node, "module_upscale_denoise");
    const moduleUpscaleTileWidthWidget = getWidget(node, "module_upscale_tile_width");
    const moduleUpscaleTileHeightWidget = getWidget(node, "module_upscale_tile_height");
    const moduleUpscaleOverlapWidget = getWidget(node, "module_upscale_overlap");
    const moduleRegionalLoraEnabledWidget = getWidget(node, "module_regional_lora_enabled");
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
        moduleAssets: null,
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
    let syncRegionalWidgets = () => {};
    let renderModuleAssetStatuses = () => {};

    const sync = () => {
        setWidgetValue(node, "positive_prompt", positive.textarea.value);
        setWidgetValue(node, "negative_prompt", negative.textarea.value);
        syncRegionalWidgets?.();
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
    failOnMissingInput.checked = bridgeBooleanWidgetValue(node, "fail_on_missing_lora", true);

    const regionalEnabledInput = el("input", { type: "checkbox", title: "启用 WebUI Regional Prompter 风格区域控制" });
    regionalEnabledInput.checked = bridgeBooleanWidgetValue(node, "regional_enabled", false);
    const regionalSplitSelect = el("select", { class: "webui-bridge-regional-select", title: "区域切分方向" }, [
        el("option", { value: "vertical" }, "纵向"),
        el("option", { value: "horizontal" }, "横向"),
        el("option", { value: "grid" }, "网格"),
    ]);
    regionalSplitSelect.value = String(regionalSplitWidget?.value || "vertical");
    const regionalRatiosInput = el("input", {
        class: "webui-bridge-regional-ratios",
        value: bridgeWidgetValue(node, "regional_ratios", "1,1"),
        placeholder: "1,1 或 1,2;1,1",
        title: "区域比例；网格用分号分行",
    });
    const regionalBaseInput = el("input", { type: "checkbox", title: "第一段作为所有区域共享的 base prompt" });
    regionalBaseInput.checked = bridgeBooleanWidgetValue(node, "regional_base_enabled", false);
    const regionalCommonInput = el("input", { type: "checkbox", title: "第一段追加到每个区域 prompt" });
    regionalCommonInput.checked = bridgeBooleanWidgetValue(node, "regional_common_enabled", false);
    const regionalBaseRatioInput = el("input", {
        type: "number",
        min: "0",
        max: "1",
        step: "0.05",
        value: bridgeWidgetValue(node, "regional_base_ratio", 0.2),
        title: "Base prompt 混合比例",
    });
    const regionalStrengthInput = el("input", {
        type: "number",
        min: "0",
        max: "10",
        step: "0.05",
        value: bridgeWidgetValue(node, "regional_strength", 1),
        title: "区域 prompt 强度",
    });
    const regionalCanvasAutoInput = el("input", {
        type: "checkbox",
        title: "自动跟随 KSampler 的 latent/image 画布尺寸；编辑宽高会退出自动跟随",
    });
    regionalCanvasAutoInput.checked = bridgeBooleanWidgetValue(node, "regional_canvas_auto", true);
    const regionalCanvasWidthInput = el("input", {
        class: "webui-bridge-regional-canvas-size",
        type: "number",
        min: "64",
        max: "16384",
        step: "8",
        value: bridgeWidgetValue(node, "regional_canvas_width", DEFAULT_REGIONAL_CANVAS_WIDTH),
        title: "输入后同步到实际 Image Size / Resize 节点；编辑时会退出自动跟随",
    });
    const regionalCanvasHeightInput = el("input", {
        class: "webui-bridge-regional-canvas-size",
        type: "number",
        min: "64",
        max: "16384",
        step: "8",
        value: bridgeWidgetValue(node, "regional_canvas_height", DEFAULT_REGIONAL_CANVAS_HEIGHT),
        title: "输入后同步到实际 Image Size / Resize 节点；编辑时会退出自动跟随",
    });
    const regionalCanvasSource = el("span", { class: "webui-bridge-regional-canvas-source" });
    const regionalDetectButton = el("button", {
        class: "webui-bridge-regional-detect",
        type: "button",
        title: "重新检测工作流里的画布尺寸，并回到自动读取",
        onclick: () => {
            const detected = detectRegionalCanvasSizeFromGraph(node);
            if (detected) {
                regionalCanvasWidthInput.value = detected.width;
                regionalCanvasHeightInput.value = detected.height;
                regionalCanvasAutoInput.checked = true;
                setStatus(`已检测画布: ${detected.width}x${detected.height}`);
            } else {
                setStatus("未检测到画布尺寸，请手动填写宽高", { kind: "error" });
            }
            syncRegionalWidgets();
        },
    }, "↻");
    const regionalStatus = el("div", { class: "webui-bridge-regional-status" });
    const regionalPreview = el("div", { class: "webui-bridge-regional-preview" });
    const regionalPreviewFrame = el("div", { class: "webui-bridge-regional-preview-frame" }, [
        el("div", { class: "webui-bridge-regional-preview-meta" }, [
            el("span", {}, "预览"),
            regionalCanvasSource,
        ]),
        regionalPreview,
    ]);
    const regionalTemplateButton = el("button", {
        class: "webui-bridge-network-tool",
        type: "button",
        title: "按当前区域数生成 BREAK 模板",
        onclick: () => {
            const split = regionalSplitSelect.value;
            const count = countRegionalCells(regionalRatiosInput.value, split);
            const prefix = regionalCommonInput.checked ? "common prompt ADDCOMM\n" : "";
            const base = regionalBaseInput.checked ? "base prompt ADDBASE\n" : "";
            const parts = Array.from({ length: Math.max(1, count) }, (_, index) => `region ${index + 1} prompt`);
            positive.textarea.value = `${prefix}${base}${parts.join(" BREAK\n")}`;
            sync();
            renderRegionalPreview();
            renderPromptPanels();
        },
    }, "生成模板");

    const applyRegionalCanvasInputsToGraph = ({ quiet = false } = {}) => {
        const size = normalizeRegionalCanvasSize(regionalCanvasWidthInput.value, regionalCanvasHeightInput.value);
        regionalCanvasWidthInput.value = size.width;
        regionalCanvasHeightInput.value = size.height;
        const result = applyRegionalCanvasSizeToGraph(node, size.width, size.height);
        if (!quiet) {
            setStatus(result.ok
                ? `${result.message}: ${size.width}x${size.height}`
                : result.message,
            { kind: result.ok ? "success" : "error" });
        }
        return result;
    };

    const onRegionalCanvasManualInput = () => {
        regionalCanvasAutoInput.checked = false;
        syncRegionalWidgets();
    };

    const enterRegionalCanvasManualMode = () => {
        if (!regionalCanvasAutoInput.checked) return;
        regionalCanvasAutoInput.checked = false;
        setWidgetValue(node, "regional_canvas_auto", false);
        renderRegionalPreview();
    };

    const onRegionalCanvasManualCommit = () => {
        regionalCanvasAutoInput.checked = false;
        applyRegionalCanvasInputsToGraph();
        syncRegionalWidgets();
    };

    const renderRegionalPreview = () => {
        const split = regionalSplitSelect.value;
        const ratios = regionalRatiosInput.value;
        const rows = parseRegionalRatioRows(ratios, split);
        const cellCount = countRegionalCells(ratios, split);
        const promptCount = regionalPromptRegionCount(positive.textarea.value, regionalBaseInput.checked, regionalCommonInput.checked);
        const negativeCount = parseRegionalPromptParts(negative.textarea.value).length;
        const warnings = [];
        if (regionalEnabledInput.checked && promptCount > 0 && promptCount !== cellCount) warnings.push(`Prompt 区域 ${promptCount} 个，比例区域 ${cellCount} 个`);
        if (regionalEnabledInput.checked && negativeCount > 1 && negativeCount !== promptCount) warnings.push(`反向词区域 ${negativeCount} 个，正向区域 ${promptCount} 个`);
        regionalStatus.textContent = regionalEnabledInput.checked
            ? (warnings.length ? warnings.join("；") : `区域 ${cellCount} 个；使用 BREAK/ADDCOL/ADDROW 分隔提示词`)
            : "区域控制关闭";
        regionalStatus.classList.toggle("error", warnings.length > 0);
        const manualCanvas = normalizeRegionalCanvasSize(
            regionalCanvasWidthInput.value,
            regionalCanvasHeightInput.value,
        );
        const detectedCanvas = regionalCanvasAutoInput.checked ? detectRegionalCanvasSizeFromGraph(node) : null;
        const canvas = detectedCanvas || manualCanvas;
        regionalPreview.style.setProperty("--webui-bridge-regional-aspect", `${canvas.width} / ${canvas.height}`);
        regionalCanvasSource.textContent = detectedCanvas
            ? `${canvas.width}x${canvas.height} · ${detectedCanvas.source}`
            : `${canvas.width}x${canvas.height} · 手动`;
        regionalCanvasWidthInput.value = canvas.width;
        regionalCanvasHeightInput.value = canvas.height;
        if (detectedCanvas) {
            setWidgetValue(node, "regional_canvas_width", canvas.width);
            setWidgetValue(node, "regional_canvas_height", canvas.height);
        }
        regionalPreview.innerHTML = "";
        const previewRows = regionalPreviewLayoutRows(rows, split === "grid" || /[;；]/.test(String(ratios || "")) ? "grid" : split);
        const totalRowWeight = previewRows.reduce((sum, row) => sum + row.weight, 0) || 1;
        let cellNumber = 1;
        previewRows.forEach((row, rowIndex) => {
            const rowEl = el("div", {
                class: "webui-bridge-regional-preview-row",
                style: { flex: `${row.weight / totalRowWeight} 1 0` },
            });
            const total = row.values.reduce((sum, value) => sum + value, 0) || 1;
            row.values.forEach((value) => {
                rowEl.append(el("div", {
                    class: "webui-bridge-regional-preview-cell",
                    style: { flex: `${value / total} 1 0` },
                }, `${cellNumber}`));
                cellNumber += 1;
            });
            regionalPreview.append(rowEl);
        });
    };
    syncRegionalWidgets = () => {
        setWidgetValue(node, "regional_enabled", regionalEnabledInput.checked);
        setWidgetValue(node, "regional_mode", "matrix");
        setWidgetValue(node, "regional_split", regionalSplitSelect.value);
        setWidgetValue(node, "regional_ratios", regionalRatiosInput.value.trim() || "1,1");
        setWidgetValue(node, "regional_base_enabled", regionalBaseInput.checked);
        setWidgetValue(node, "regional_common_enabled", regionalCommonInput.checked);
        setWidgetValue(node, "regional_base_ratio", normalizeClipStrength(regionalBaseRatioInput.value, 0.2));
        setWidgetValue(node, "regional_strength", normalizeClipStrength(regionalStrengthInput.value, 1));
        setWidgetValue(node, "regional_canvas_auto", regionalCanvasAutoInput.checked);
        setWidgetValue(node, "regional_canvas_width", normalizeRegionalCanvasDimension(regionalCanvasWidthInput.value, DEFAULT_REGIONAL_CANVAS_WIDTH));
        setWidgetValue(node, "regional_canvas_height", normalizeRegionalCanvasDimension(regionalCanvasHeightInput.value, DEFAULT_REGIONAL_CANVAS_HEIGHT));
        renderRegionalPreview();
    };
    for (const control of [regionalEnabledInput, regionalSplitSelect, regionalRatiosInput, regionalBaseInput, regionalCommonInput, regionalBaseRatioInput, regionalStrengthInput, regionalCanvasAutoInput]) {
        control.addEventListener("input", syncRegionalWidgets);
        control.addEventListener("change", syncRegionalWidgets);
    }
    for (const control of [regionalCanvasWidthInput, regionalCanvasHeightInput]) {
        control.addEventListener("pointerdown", enterRegionalCanvasManualMode);
        control.addEventListener("focus", enterRegionalCanvasManualMode);
        control.addEventListener("beforeinput", enterRegionalCanvasManualMode);
        control.addEventListener("wheel", enterRegionalCanvasManualMode, { passive: true });
        control.addEventListener("input", onRegionalCanvasManualInput);
        control.addEventListener("change", onRegionalCanvasManualCommit);
        control.addEventListener("keydown", (event) => {
            if (!["Tab", "Shift", "Control", "Alt", "Meta"].includes(event.key)) enterRegionalCanvasManualMode();
            if (event.key !== "Enter") return;
            event.preventDefault();
            onRegionalCanvasManualCommit();
        });
    }

    let regionalCanvasSyncTimer = null;
    const syncRegionalCanvasFromGraph = () => {
        if (!regionalCanvasAutoInput.checked) return false;
        const detected = detectRegionalCanvasSizeFromGraph(node);
        if (!detected) return false;
        const sourceText = `${detected.width}x${detected.height} · ${detected.source}`;
        const currentWidth = normalizeRegionalCanvasDimension(regionalCanvasWidthInput.value, DEFAULT_REGIONAL_CANVAS_WIDTH);
        const currentHeight = normalizeRegionalCanvasDimension(regionalCanvasHeightInput.value, DEFAULT_REGIONAL_CANVAS_HEIGHT);
        if (
            currentWidth === detected.width &&
            currentHeight === detected.height &&
            regionalCanvasSource.textContent === sourceText
        ) {
            return false;
        }
        regionalCanvasWidthInput.value = detected.width;
        regionalCanvasHeightInput.value = detected.height;
        setWidgetValue(node, "regional_canvas_width", detected.width);
        setWidgetValue(node, "regional_canvas_height", detected.height);
        renderRegionalPreview();
        return true;
    };
    const startRegionalCanvasAutoSync = () => {
        window.clearInterval(regionalCanvasSyncTimer);
        regionalCanvasSyncTimer = window.setInterval(() => {
            if (!regionalPreviewFrame.isConnected) {
                window.clearInterval(regionalCanvasSyncTimer);
                regionalCanvasSyncTimer = null;
                return;
            }
            syncRegionalCanvasFromGraph();
        }, 700);
    };
    startRegionalCanvasAutoSync();

    const regionalPromptState = () => {
        const positiveParts = parseRegionalPromptParts(positive.textarea.value);
        const negativeParts = parseRegionalPromptParts(negative.textarea.value);
        const commonEnabled = regionalCommonInput.checked || /\bADDCOMM\b/i.test(positive.textarea.value);
        const baseEnabled = regionalBaseInput.checked || /\bADDBASE\b/i.test(positive.textarea.value);
        let offset = 0;
        const common = commonEnabled ? positiveParts[offset++] || "" : "";
        const base = baseEnabled ? positiveParts[offset++] || "" : "";
        return {
            common,
            base,
            regions: positiveParts.slice(offset),
            negativeRegions: negativeParts,
            commonEnabled,
            baseEnabled,
            cellCount: countRegionalCells(regionalRatiosInput.value, regionalSplitSelect.value),
        };
    };
    const rebuildRegionalPrompt = ({ common, base, regions }) => {
        const parts = [];
        if (regionalCommonInput.checked && common) parts.push(`${common} ADDCOMM`);
        if (regionalBaseInput.checked && base) parts.push(`${base} ADDBASE`);
        parts.push(...regions.filter(Boolean));
        setTextareaValue(positive.textarea, parts.join(" BREAK\n"));
    };
    const reverseRegionalText = (textarea, offset = 0) => {
        const parts = parseRegionalPromptParts(textarea.value);
        if (parts.length <= offset + 1) return false;
        const fixed = parts.slice(0, offset);
        const reversed = parts.slice(offset).reverse();
        setTextareaValue(textarea, [...fixed, ...reversed].join(" BREAK\n"));
        return true;
    };
    const reverseRegionalRatios = () => {
        const split = regionalSplitSelect.value;
        const rows = parseRegionalRatioRows(regionalRatiosInput.value, split);
        const nextRows = split === "horizontal" ? [...rows].reverse() : rows.map((row) => [...row].reverse());
        regionalRatiosInput.value = nextRows.map((row) => row.join(",")).join(";");
    };
    const openModuleDialog = (title, bodyChildren, actionChildren = []) => {
        const mask = el("div", { class: "webui-bridge-config-mask" });
        const close = () => mask.remove();
        mask.addEventListener("mousedown", (event) => {
            if (event.target === mask) close();
        });
        mask.append(el("div", { class: "webui-bridge-config-panel webui-bridge-module-dialog" }, [
            el("div", { class: "webui-bridge-config-head" }, [
                el("span", {}, title),
                el("button", { type: "button", onclick: close }, "×"),
            ]),
            el("div", { class: "webui-bridge-config-body" }, bodyChildren),
            el("div", { class: "webui-bridge-config-actions" }, [
                ...actionChildren,
                el("button", { type: "button", class: actionChildren.length ? "" : "primary", onclick: close }, actionChildren.length ? "关闭" : "完成"),
            ]),
        ]));
        document.body.append(mask);
    };
    const showRegionalTableAssistant = () => {
        const snapshot = regionalPromptState();
        const count = Math.max(snapshot.cellCount, snapshot.regions.length || 1);
        const rows = Array.from({ length: count }, (_, index) => {
            const pos = el("textarea", { class: "webui-bridge-config-input", rows: "2" });
            pos.value = snapshot.regions[index] || "";
            const neg = el("textarea", { class: "webui-bridge-config-input", rows: "2" });
            neg.value = snapshot.negativeRegions[index] || (snapshot.negativeRegions.length === 1 ? snapshot.negativeRegions[0] : "");
            return { pos, neg };
        });
        const commonInput = el("textarea", { class: "webui-bridge-config-input", rows: "2" });
        commonInput.value = snapshot.common;
        const baseInput = el("textarea", { class: "webui-bridge-config-input", rows: "2" });
        baseInput.value = snapshot.base;
        const table = el("div", { class: "webui-bridge-region-table" }, rows.flatMap((row, index) => [
            el("b", {}, `区域 ${index + 1}`),
            row.pos,
            row.neg,
        ]));
        const apply = () => {
            rebuildRegionalPrompt({
                common: commonInput.value.trim(),
                base: baseInput.value.trim(),
                regions: rows.map((row, index) => row.pos.value.trim() || `region ${index + 1} prompt`),
            });
            const negativeValues = rows.map((row) => row.neg.value.trim()).filter(Boolean);
            if (negativeValues.length) setTextareaValue(negative.textarea, negativeValues.join(" BREAK\n"));
            sync();
            syncRegionalWidgets();
            renderPromptPanels();
        };
        openModuleDialog("区域表格", [
            el("div", { class: "webui-bridge-config-note" }, "按区域编辑提示词后会回写为 Regional Prompter 风格 BREAK 文本。"),
            el("label", {}, [el("span", {}, "Common"), commonInput]),
            el("label", {}, [el("span", {}, "Base"), baseInput]),
            table,
        ], [
            el("button", { type: "button", class: "primary", onclick: apply }, "回写区域文本"),
        ]);
    };
    const showMaskModule = () => openModuleDialog("Mask 区域", [
        el("div", { class: "webui-bridge-config-note" }, "Mask 模块会读取本节点的可选 MASK 输入，并把遮罩写入正向 conditioning。适合把外部画布、SAM 或手绘遮罩接进区域流程。"),
        el("div", { class: "webui-bridge-config-note" }, `当前画布: ${regionalCanvasWidthInput.value}x${regionalCanvasHeightInput.value}。区域 prompt 继续用 BREAK 分段，mask 用来限制采样范围。`),
    ]);
    const applyNegativeCommonTemplate = () => {
        const stateNow = regionalPromptState();
        const count = Math.max(stateNow.cellCount, stateNow.regions.length || 1);
        const current = negative.textarea.value.trim();
        const common = current && !/\bBREAK\b/i.test(current) ? current : "common negative prompt";
        setTextareaValue(negative.textarea, [
            common,
            ...Array.from({ length: count }, (_, index) => `region ${index + 1} negative prompt`),
        ].join(" BREAK\n"));
        sync();
        renderRegionalPreview();
    };
    const showNegativeCommonModule = () => openModuleDialog("负向 Common", [
        el("div", { class: "webui-bridge-config-note" }, "启用后，模块会把通用反向词合并进每个区域的反向 conditioning；也可以生成 BREAK 模板后继续手调。"),
    ], [
        el("button", { type: "button", class: "primary", onclick: applyNegativeCommonTemplate }, "生成负向模板"),
    ]);
    const flipRegionalPrompt = () => {
        const stateNow = regionalPromptState();
        const offset = (stateNow.commonEnabled ? 1 : 0) + (stateNow.baseEnabled ? 1 : 0);
        reverseRegionalRatios();
        reverseRegionalText(positive.textarea, offset);
        reverseRegionalText(negative.textarea, 0);
        sync();
        syncRegionalWidgets();
        renderPromptPanels();
        setStatus("已翻转区域顺序", { kind: "success" });
    };
    const regionalPresetStorageKey = "webui-bridge-regional-presets";
    const readRegionalPresets = () => {
        try {
            const value = JSON.parse(localStorage.getItem(regionalPresetStorageKey) || "[]");
            return Array.isArray(value) ? value : [];
        } catch {
            return [];
        }
    };
    const writeRegionalPresets = (presets) => writeLocalString(regionalPresetStorageKey, JSON.stringify(presets.slice(-30)));
    const showPresetModule = () => {
        const list = el("div", { class: "webui-bridge-preset-list" });
        const renderPresets = () => {
            list.innerHTML = "";
            for (const preset of readRegionalPresets()) {
                list.append(el("button", {
                    type: "button",
                    title: preset.name,
                    onclick: () => {
                        regionalEnabledInput.checked = true;
                        regionalSplitSelect.value = preset.split || "vertical";
                        regionalRatiosInput.value = preset.ratios || "1,1";
                        regionalBaseInput.checked = Boolean(preset.baseEnabled);
                        regionalCommonInput.checked = Boolean(preset.commonEnabled);
                        regionalBaseRatioInput.value = preset.baseRatio ?? 0.2;
                        regionalStrengthInput.value = preset.strength ?? 1;
                        setTextareaValue(positive.textarea, preset.positive || positive.textarea.value);
                        setTextareaValue(negative.textarea, preset.negative || negative.textarea.value);
                        sync();
                        syncRegionalWidgets();
                        renderPromptPanels();
                    },
                }, preset.name || "未命名 Preset"));
            }
            if (!list.childElementCount) list.append(el("span", {}, "暂无 Preset"));
        };
        const saveCurrent = () => {
            const name = prompt("Preset 名称", `区域 ${regionalSplitSelect.value} ${regionalRatiosInput.value}`);
            if (name === null) return;
            const presets = readRegionalPresets().filter((item) => item.name !== name);
            presets.push({
                name: name || "未命名 Preset",
                split: regionalSplitSelect.value,
                ratios: regionalRatiosInput.value,
                baseEnabled: regionalBaseInput.checked,
                commonEnabled: regionalCommonInput.checked,
                baseRatio: regionalBaseRatioInput.value,
                strength: regionalStrengthInput.value,
                positive: positive.textarea.value,
                negative: negative.textarea.value,
            });
            writeRegionalPresets(presets);
            renderPresets();
        };
        renderPresets();
        openModuleDialog("区域 Preset", [
            el("div", { class: "webui-bridge-config-note" }, "Preset 保存在浏览器本地，用来快速恢复区域比例、Base/Common 和提示词模板。"),
            list,
        ], [
            el("button", { type: "button", class: "primary", onclick: saveCurrent }, "保存当前"),
        ]);
    };
    const showWorkflowHelper = (title, message, template = "") => openModuleDialog(title, [
        el("div", { class: "webui-bridge-config-note" }, message),
        ...(template ? [el("textarea", { class: "webui-bridge-config-input", rows: "4", readonly: "readonly" }, template)] : []),
    ]);
    const moduleAssetStatus = (kind, packageKey = "") => {
        const line = el("div", { class: "webui-bridge-module-note webui-bridge-module-asset" }, "模块资产: 正在等待扫描");
        const render = () => {
            const assets = state.moduleAssets || {};
            const model = assets.models?.[kind];
            const pkg = packageKey ? assets.node_packages?.[packageKey] : null;
            const parts = [];
            if (model) parts.push(`${model.count || 0} 个模型`);
            if (pkg) parts.push(pkg.installed ? `${pkg.name} 已安装` : `${pkg.name} 未安装`);
            if (!parts.length) parts.push("重启 ComfyUI 后可读取模块资产");
            line.textContent = `模块资产: ${parts.join("；")}`;
            line.title = model?.items?.length ? model.items.slice(0, 16).join("\n") : "";
        };
        line.__webuiBridgeRender = render;
        render();
        return line;
    };
    const refreshModuleAssetsButton = () => el("button", {
        class: "webui-bridge-module-button",
        type: "button",
        onclick: async () => {
            try {
                state.moduleAssets = await fetchModuleAssets();
                renderModuleAssetStatuses();
                setStatus("已刷新模块资产状态", { kind: "success" });
            } catch (error) {
                setStatus(`模块资产刷新失败: ${error?.message || error}`, { kind: "error" });
            }
        },
    }, "刷新资产状态");
    const installModuleAssetsButton = (assets, label = "安装缺失节点包") => el("button", {
        class: "webui-bridge-module-button",
        type: "button",
        onclick: async (event) => {
            const button = event.currentTarget;
            button.disabled = true;
            const oldText = button.textContent;
            button.textContent = "正在安装...";
            button.classList.add("downloading");
            setStatus(`正在下载/安装 ${label}...`, { kind: "warning", sticky: true });
            try {
                const result = await installModuleAssets(assets);
                state.moduleAssets = result.module_assets || state.moduleAssets;
                renderModuleAssetStatuses();
                const installed = (result.results || []).filter((item) => item.status === "installed").map((item) => item.label || item.id);
                const existed = (result.results || []).filter((item) => item.status === "exists").map((item) => item.label || item.id);
                const message = [
                    installed.length ? `已安装 ${installed.join("、")}` : "",
                    existed.length ? `已存在 ${existed.join("、")}` : "",
                    result.restart_required ? "重启 ComfyUI 后生效" : "",
                ].filter(Boolean).join("；") || "模块节点包已检查";
                setStatus(message, { kind: "success", sticky: Boolean(result.restart_required) });
            } catch (error) {
                setStatus(`安装失败: ${error?.message || error}`, { kind: "error", sticky: true });
            } finally {
                button.disabled = false;
                button.textContent = oldText;
                button.classList.remove("downloading");
            }
        },
    }, label);

    const moduleControls = [];
    const moduleCheckbox = (widget, fallback = false) => {
        const input = el("input", { type: "checkbox" });
        input.checked = widget ? sanitizeBridgeWidgetValue(widget.name, widget.value) : Boolean(fallback);
        moduleControls.push(input);
        return input;
    };
    const moduleNumber = (widget, fallback, attrs = {}) => {
        const input = el("input", {
            class: "webui-bridge-module-input",
            type: "number",
            value: bridgeWidgetValue(node, widget?.name, fallback),
            ...attrs,
        });
        moduleControls.push(input);
        return input;
    };
    const moduleText = (widget, fallback = "", rows = 2) => {
        const input = el("textarea", {
            class: "webui-bridge-module-input",
            rows: String(rows),
        });
        input.value = bridgeWidgetValue(node, widget?.name, fallback);
        moduleControls.push(input);
        return input;
    };
    const moduleSelect = (widget, fallback, options) => {
        const input = el("select", { class: "webui-bridge-module-input" }, options.map((item) => (
            el("option", { value: item.value, selected: item.value === bridgeWidgetValue(node, widget?.name, fallback) ? "selected" : undefined }, item.label)
        )));
        moduleControls.push(input);
        return input;
    };

    const moduleTableEnabledInput = moduleCheckbox(moduleTableEnabledWidget);
    const moduleMaskEnabledInput = moduleCheckbox(moduleMaskEnabledWidget);
    const moduleMaskStrengthInput = moduleNumber(moduleMaskStrengthWidget, 1, { min: "0", max: "10", step: "0.05" });
    const moduleMaskBoundsInput = moduleCheckbox(moduleMaskSetAreaToBoundsWidget);
    const moduleNegativeCommonEnabledInput = moduleCheckbox(moduleNegativeCommonEnabledWidget);
    const moduleNegativeCommonPromptInput = moduleText(moduleNegativeCommonPromptWidget, "", 2);
    const moduleFlipEnabledInput = moduleCheckbox(moduleFlipEnabledWidget);
    const moduleFlipAxisInput = moduleSelect(moduleFlipAxisWidget, "auto", [
        { value: "auto", label: "跟随切分" },
        { value: "vertical", label: "左右翻转" },
        { value: "horizontal", label: "上下翻转" },
    ]);
    const modulePresetsEnabledInput = moduleCheckbox(modulePresetsEnabledWidget);
    const moduleAdetailerEnabledInput = moduleCheckbox(moduleAdetailerEnabledWidget);
    const moduleAdetailerModelInput = moduleSelect(moduleAdetailerModelWidget, "face_yolov8m.pt", [
        { value: "face_yolov8m.pt", label: "脸 face_yolov8m" },
        { value: "face_yolov8n.pt", label: "脸 face_yolov8n" },
        { value: "face_yolov8s.pt", label: "脸 face_yolov8s" },
        { value: "hand_yolov8s.pt", label: "手 hand_yolov8s" },
        { value: "hand_yolov8n.pt", label: "手 hand_yolov8n" },
        { value: "person_yolov8m-seg.pt", label: "人物分割 yolov8m" },
        { value: "person_yolov8n-seg.pt", label: "人物分割" },
        { value: "mediapipe_face_full", label: "MediaPipe 全脸" },
        { value: "custom", label: "自定义模型" },
    ]);
    const moduleAdetailerPromptInput = moduleText(moduleAdetailerPromptWidget, "detailed face, detailed eyes, detailed hands", 2);
    const moduleAdetailerNegativePromptInput = moduleText(moduleAdetailerNegativePromptWidget, "bad anatomy, deformed, blurry, extra fingers", 2);
    const moduleAdetailerConfidenceInput = moduleNumber(moduleAdetailerConfidenceWidget, 0.3, { min: "0", max: "1", step: "0.01" });
    const moduleAdetailerMaskBlurInput = moduleNumber(moduleAdetailerMaskBlurWidget, 4, { min: "0", max: "64", step: "1" });
    const moduleAdetailerDenoiseInput = moduleNumber(moduleAdetailerDenoiseWidget, 0.4, { min: "0", max: "1", step: "0.01" });
    const moduleAdetailerInpaintOnlyMaskedInput = moduleCheckbox(moduleAdetailerInpaintOnlyMaskedWidget, true);
    const moduleAdetailerCyclesInput = moduleNumber(moduleAdetailerCyclesWidget, 1, { min: "1", max: "8", step: "1" });
    const moduleControlnetEnabledInput = moduleCheckbox(moduleControlnetEnabledWidget);
    const moduleControlnetPreprocessorInput = moduleSelect(moduleControlnetPreprocessorWidget, "canny", [
        { value: "none", label: "无预处理" },
        { value: "canny", label: "Canny" },
        { value: "depth", label: "Depth" },
        { value: "openpose", label: "OpenPose" },
        { value: "lineart", label: "Lineart" },
        { value: "softedge", label: "SoftEdge" },
        { value: "normal", label: "Normal" },
        { value: "tile", label: "Tile" },
        { value: "reference", label: "Reference" },
        { value: "ip-adapter", label: "IP-Adapter" },
    ]);
    const moduleControlnetModelInput = moduleText(moduleControlnetModelWidget, "", 1);
    const moduleControlnetWeightInput = moduleNumber(moduleControlnetWeightWidget, 1, { min: "0", max: "2", step: "0.05" });
    const moduleControlnetStartInput = moduleNumber(moduleControlnetStartWidget, 0, { min: "0", max: "1", step: "0.01" });
    const moduleControlnetEndInput = moduleNumber(moduleControlnetEndWidget, 1, { min: "0", max: "1", step: "0.01" });
    const moduleControlnetResizeModeInput = moduleSelect(moduleControlnetResizeModeWidget, "just_resize", [
        { value: "just_resize", label: "Just Resize" },
        { value: "crop_and_resize", label: "Crop and Resize" },
        { value: "resize_and_fill", label: "Resize and Fill" },
    ]);
    const moduleControlnetControlModeInput = moduleSelect(moduleControlnetControlModeWidget, "balanced", [
        { value: "balanced", label: "Balanced" },
        { value: "prompt", label: "Prompt 更重要" },
        { value: "control", label: "Control 更重要" },
    ]);
    const moduleControlnetPixelPerfectInput = moduleCheckbox(moduleControlnetPixelPerfectWidget, true);
    const moduleSamEnabledInput = moduleCheckbox(moduleSamEnabledWidget);
    const moduleSamModelInput = moduleSelect(moduleSamModelWidget, "sam_vit_b", [
        { value: "sam_vit_b", label: "SAM ViT-B" },
        { value: "sam_vit_l", label: "SAM ViT-L" },
        { value: "sam_vit_h", label: "SAM ViT-H" },
        { value: "sam_hq_vit_h", label: "SAM HQ ViT-H" },
        { value: "mobile_sam", label: "Mobile SAM" },
        { value: "custom", label: "自定义" },
    ]);
    const moduleSamPromptModeInput = moduleSelect(moduleSamPromptModeWidget, "auto", [
        { value: "auto", label: "自动" },
        { value: "point", label: "点选" },
        { value: "box", label: "框选" },
        { value: "mask", label: "已有 Mask" },
    ]);
    const moduleSamConfidenceInput = moduleNumber(moduleSamConfidenceWidget, 0.5, { min: "0", max: "1", step: "0.01" });
    const moduleSamMaskBlurInput = moduleNumber(moduleSamMaskBlurWidget, 4, { min: "0", max: "64", step: "1" });
    const moduleSamDilateInput = moduleNumber(moduleSamDilateWidget, 0, { min: "-64", max: "64", step: "1" });
    const moduleSamInpaintDenoiseInput = moduleNumber(moduleSamInpaintDenoiseWidget, 0.45, { min: "0", max: "1", step: "0.01" });
    const moduleSamInpaintAreaInput = moduleSelect(moduleSamInpaintAreaWidget, "only_masked", [
        { value: "only_masked", label: "Only masked" },
        { value: "whole_picture", label: "Whole picture" },
    ]);
    const moduleSamPaddingInput = moduleNumber(moduleSamPaddingWidget, 32, { min: "0", max: "512", step: "8" });
    const moduleUpscaleEnabledInput = moduleCheckbox(moduleUpscaleEnabledWidget);
    const moduleUpscaleModeInput = moduleSelect(moduleUpscaleModeWidget, "hires_fix", [
        { value: "hires_fix", label: "Hires.fix" },
        { value: "ultimate_sd_upscale", label: "Ultimate SD Upscale" },
        { value: "latent_upscale", label: "Latent Upscale" },
        { value: "tile", label: "Tiled" },
    ]);
    const moduleUpscaleByInput = moduleNumber(moduleUpscaleByWidget, 2, { min: "1", max: "8", step: "0.05" });
    const moduleUpscaleUpscalerInput = moduleText(moduleUpscaleUpscalerWidget, "Latent", 1);
    const moduleUpscaleStepsInput = moduleNumber(moduleUpscaleStepsWidget, 18, { min: "0", max: "150", step: "1" });
    const moduleUpscaleDenoiseInput = moduleNumber(moduleUpscaleDenoiseWidget, 0.48, { min: "0", max: "1", step: "0.01" });
    const moduleUpscaleTileWidthInput = moduleNumber(moduleUpscaleTileWidthWidget, 768, { min: "128", max: "4096", step: "8" });
    const moduleUpscaleTileHeightInput = moduleNumber(moduleUpscaleTileHeightWidget, 768, { min: "128", max: "4096", step: "8" });
    const moduleUpscaleOverlapInput = moduleNumber(moduleUpscaleOverlapWidget, 64, { min: "0", max: "1024", step: "8" });
    const moduleRegionalLoraEnabledInput = moduleCheckbox(moduleRegionalLoraEnabledWidget);

    const syncModuleWidgets = () => {
        setWidgetValue(node, "module_table_enabled", moduleTableEnabledInput.checked);
        setWidgetValue(node, "module_mask_enabled", moduleMaskEnabledInput.checked);
        setWidgetValue(node, "module_mask_strength", normalizeClipStrength(moduleMaskStrengthInput.value, 1));
        setWidgetValue(node, "module_mask_set_area_to_bounds", moduleMaskBoundsInput.checked);
        setWidgetValue(node, "module_negative_common_enabled", moduleNegativeCommonEnabledInput.checked);
        setWidgetValue(node, "module_negative_common_prompt", moduleNegativeCommonPromptInput.value.trim());
        setWidgetValue(node, "module_flip_enabled", moduleFlipEnabledInput.checked);
        setWidgetValue(node, "module_flip_axis", moduleFlipAxisInput.value);
        setWidgetValue(node, "module_presets_enabled", modulePresetsEnabledInput.checked);
        setWidgetValue(node, "module_adetailer_enabled", moduleAdetailerEnabledInput.checked);
        setWidgetValue(node, "module_adetailer_model", moduleAdetailerModelInput.value);
        setWidgetValue(node, "module_adetailer_prompt", moduleAdetailerPromptInput.value.trim());
        setWidgetValue(node, "module_adetailer_negative_prompt", moduleAdetailerNegativePromptInput.value.trim());
        setWidgetValue(node, "module_adetailer_confidence", normalizeClipStrength(moduleAdetailerConfidenceInput.value, 0.3));
        setWidgetValue(node, "module_adetailer_mask_blur", Math.max(0, Math.round(normalizeClipStrength(moduleAdetailerMaskBlurInput.value, 4))));
        setWidgetValue(node, "module_adetailer_denoise", normalizeClipStrength(moduleAdetailerDenoiseInput.value, 0.4));
        setWidgetValue(node, "module_adetailer_inpaint_only_masked", moduleAdetailerInpaintOnlyMaskedInput.checked);
        setWidgetValue(node, "module_adetailer_cycles", Math.max(1, Math.round(normalizeClipStrength(moduleAdetailerCyclesInput.value, 1))));
        setWidgetValue(node, "module_controlnet_enabled", moduleControlnetEnabledInput.checked);
        setWidgetValue(node, "module_controlnet_preprocessor", moduleControlnetPreprocessorInput.value);
        setWidgetValue(node, "module_controlnet_model", moduleControlnetModelInput.value.trim());
        setWidgetValue(node, "module_controlnet_weight", normalizeClipStrength(moduleControlnetWeightInput.value, 1));
        setWidgetValue(node, "module_controlnet_start", normalizeClipStrength(moduleControlnetStartInput.value, 0));
        setWidgetValue(node, "module_controlnet_end", normalizeClipStrength(moduleControlnetEndInput.value, 1));
        setWidgetValue(node, "module_controlnet_resize_mode", moduleControlnetResizeModeInput.value);
        setWidgetValue(node, "module_controlnet_control_mode", moduleControlnetControlModeInput.value);
        setWidgetValue(node, "module_controlnet_pixel_perfect", moduleControlnetPixelPerfectInput.checked);
        setWidgetValue(node, "module_sam_enabled", moduleSamEnabledInput.checked);
        setWidgetValue(node, "module_sam_model", moduleSamModelInput.value);
        setWidgetValue(node, "module_sam_prompt_mode", moduleSamPromptModeInput.value);
        setWidgetValue(node, "module_sam_confidence", normalizeClipStrength(moduleSamConfidenceInput.value, 0.5));
        setWidgetValue(node, "module_sam_mask_blur", Math.round(normalizeClipStrength(moduleSamMaskBlurInput.value, 4)));
        setWidgetValue(node, "module_sam_dilate", Math.round(normalizeClipStrength(moduleSamDilateInput.value, 0)));
        setWidgetValue(node, "module_sam_inpaint_denoise", normalizeClipStrength(moduleSamInpaintDenoiseInput.value, 0.45));
        setWidgetValue(node, "module_sam_inpaint_area", moduleSamInpaintAreaInput.value);
        setWidgetValue(node, "module_sam_padding", Math.max(0, Math.round(normalizeClipStrength(moduleSamPaddingInput.value, 32))));
        setWidgetValue(node, "module_upscale_enabled", moduleUpscaleEnabledInput.checked);
        setWidgetValue(node, "module_upscale_mode", moduleUpscaleModeInput.value);
        setWidgetValue(node, "module_upscale_by", normalizeClipStrength(moduleUpscaleByInput.value, 2));
        setWidgetValue(node, "module_upscale_upscaler", moduleUpscaleUpscalerInput.value.trim());
        setWidgetValue(node, "module_upscale_steps", Math.max(0, Math.round(normalizeClipStrength(moduleUpscaleStepsInput.value, 18))));
        setWidgetValue(node, "module_upscale_denoise", normalizeClipStrength(moduleUpscaleDenoiseInput.value, 0.48));
        setWidgetValue(node, "module_upscale_tile_width", Math.max(128, Math.round(normalizeClipStrength(moduleUpscaleTileWidthInput.value, 768))));
        setWidgetValue(node, "module_upscale_tile_height", Math.max(128, Math.round(normalizeClipStrength(moduleUpscaleTileHeightInput.value, 768))));
        setWidgetValue(node, "module_upscale_overlap", Math.max(0, Math.round(normalizeClipStrength(moduleUpscaleOverlapInput.value, 64))));
        setWidgetValue(node, "module_regional_lora_enabled", moduleRegionalLoraEnabledInput.checked);
    };
    const moduleControlBindings = [
        [moduleTableEnabledInput, "checked"],
        [moduleMaskEnabledInput, "checked"],
        [moduleMaskStrengthInput, "value"],
        [moduleMaskBoundsInput, "checked"],
        [moduleNegativeCommonEnabledInput, "checked"],
        [moduleNegativeCommonPromptInput, "value"],
        [moduleFlipEnabledInput, "checked"],
        [moduleFlipAxisInput, "value"],
        [modulePresetsEnabledInput, "checked"],
        [moduleAdetailerEnabledInput, "checked"],
        [moduleAdetailerModelInput, "value"],
        [moduleAdetailerPromptInput, "value"],
        [moduleAdetailerNegativePromptInput, "value"],
        [moduleAdetailerConfidenceInput, "value"],
        [moduleAdetailerMaskBlurInput, "value"],
        [moduleAdetailerDenoiseInput, "value"],
        [moduleAdetailerInpaintOnlyMaskedInput, "checked"],
        [moduleAdetailerCyclesInput, "value"],
        [moduleControlnetEnabledInput, "checked"],
        [moduleControlnetPreprocessorInput, "value"],
        [moduleControlnetModelInput, "value"],
        [moduleControlnetWeightInput, "value"],
        [moduleControlnetStartInput, "value"],
        [moduleControlnetEndInput, "value"],
        [moduleControlnetResizeModeInput, "value"],
        [moduleControlnetControlModeInput, "value"],
        [moduleControlnetPixelPerfectInput, "checked"],
        [moduleSamEnabledInput, "checked"],
        [moduleSamModelInput, "value"],
        [moduleSamPromptModeInput, "value"],
        [moduleSamConfidenceInput, "value"],
        [moduleSamMaskBlurInput, "value"],
        [moduleSamDilateInput, "value"],
        [moduleSamInpaintDenoiseInput, "value"],
        [moduleSamInpaintAreaInput, "value"],
        [moduleSamPaddingInput, "value"],
        [moduleUpscaleEnabledInput, "checked"],
        [moduleUpscaleModeInput, "value"],
        [moduleUpscaleByInput, "value"],
        [moduleUpscaleUpscalerInput, "value"],
        [moduleUpscaleStepsInput, "value"],
        [moduleUpscaleDenoiseInput, "value"],
        [moduleUpscaleTileWidthInput, "value"],
        [moduleUpscaleTileHeightInput, "value"],
        [moduleUpscaleOverlapInput, "value"],
        [moduleRegionalLoraEnabledInput, "checked"],
    ];
    const captureModuleControlSnapshot = () => moduleControlBindings.map(([control, prop]) => [control, prop, control[prop]]);
    const restoreModuleControlSnapshot = (snapshot = []) => {
        for (const [control, prop, value] of snapshot) {
            if (control) control[prop] = value;
        }
        syncModuleWidgets();
    };
    for (const control of moduleControls) {
        control.addEventListener("input", syncModuleWidgets);
        control.addEventListener("change", syncModuleWidgets);
    }
    const moduleSection = (key, title, enabledInput, children) => {
        const hasToggle = Boolean(enabledInput);
        const body = el("div", { class: "webui-bridge-module-body" }, children);
        const section = el("details", { class: "webui-bridge-module-section", open: hasToggle ? Boolean(enabledInput.checked) : true }, [
            el("summary", {}, [
                el("span", {}, title),
                hasToggle ? enabledInput : el("span", { class: "webui-bridge-module-badge" }, "内置"),
            ].filter(Boolean)),
            body,
        ]);
        section.dataset.visibilityKey = key;
        if (hasToggle) {
            enabledInput.addEventListener("click", (event) => event.stopPropagation());
            enabledInput.addEventListener("change", () => {
                section.open = enabledInput.checked || section.open;
                syncModuleWidgets();
            });
        }
        return section;
    };
    const moduleHint = (text) => el("div", { class: "webui-bridge-module-note" }, text);
    const graphSlotIndex = (graphNode, kind, name) => {
        if (!graphNode) return -1;
        const list = kind === "input" ? graphNode.inputs : graphNode.outputs;
        const method = kind === "input" ? graphNode.findInputSlot : graphNode.findOutputSlot;
        if (typeof method === "function") {
            const found = method.call(graphNode, name);
            if (found >= 0) return found;
        }
        return (list || []).findIndex((slot) => slot?.name === name);
    };
    const connectGraphSlots = (fromNode, outputName, toNode, inputName, report = null, options = {}) => {
        if (!fromNode || !toNode) {
            const source = fromNode?.title || fromNode?.type || "源节点未创建";
            const target = toNode?.title || toNode?.type || "目标节点未创建";
            report?.warnings?.push(`无法连接: ${source}.${outputName} -> ${target}.${inputName}`);
            return false;
        }
        const outputSlot = graphSlotIndex(fromNode, "output", outputName);
        const inputSlot = graphSlotIndex(toNode, "input", inputName);
        const label = `${fromNode?.title || fromNode?.type || "源节点"}.${outputName} -> ${toNode?.title || toNode?.type || "目标节点"}.${inputName}`;
        if (outputSlot < 0) {
            report?.warnings?.push(`找不到输出: ${label}`);
            return false;
        }
        if (inputSlot < 0) {
            report?.warnings?.push(`找不到输入: ${label}`);
            return false;
        }
        const input = toNode.inputs?.[inputSlot];
        if (input?.link != null) {
            if (options.replace) {
                disconnectInput(toNode, inputSlot);
            } else {
                report?.warnings?.push(`输入已被占用，未覆盖: ${label}`);
                return false;
            }
        }
        try {
            fromNode.connect(outputSlot, toNode, inputSlot);
        } catch (error) {
            report?.warnings?.push(`连接失败: ${label} (${error?.message || error})`);
            return false;
        }
        report?.connected?.push(label);
        return true;
    };
    const graphNodeLabel = (graphNode) => graphNode?.title || graphNode?.type || `Node ${graphNode?.id || "?"}`;
    const inputLinkInfo = (targetNode, inputName) => {
        const inputSlot = graphSlotIndex(targetNode, "input", inputName);
        const link = getGraphLink(targetNode?.inputs?.[inputSlot]?.link);
        if (!link) return null;
        return {
            inputSlot,
            link,
            source: getGraphNodeById(linkOriginId(link)),
            sourceSlot: linkOriginSlot(link),
        };
    };
    const outputLinkedTargets = (sourceNode, outputSlot) => {
        const output = sourceNode?.outputs?.[outputSlot];
        if (!Array.isArray(output?.links)) return [];
        return output.links
            .map((linkId) => {
                const link = getGraphLink(linkId);
                const target = getGraphNodeById(linkTargetId(link));
                return target ? { link, target, inputSlot: linkTargetSlot(link) } : null;
            })
            .filter(Boolean);
    };
    const findBridgeDrivenSampler = () => {
        const candidates = getGraphNodes().filter((graphNode) => {
            const text = `${graphNode?.type || ""} ${graphNode?.title || ""}`.toLowerCase();
            if (!text.includes("ksampler") && graphSlotIndex(graphNode, "input", "latent_image") < 0) return false;
            const positive = inputLinkInfo(graphNode, "positive");
            const negative = inputLinkInfo(graphNode, "negative");
            const model = inputLinkInfo(graphNode, "model");
            return positive?.source === node || negative?.source === node || model?.source === node;
        });
        return candidates.sort((a, b) => {
            const aScore = (inputLinkInfo(a, "positive")?.source === node ? 2 : 0) + (inputLinkInfo(a, "negative")?.source === node ? 2 : 0) + (inputLinkInfo(a, "model")?.source === node ? 1 : 0);
            const bScore = (inputLinkInfo(b, "positive")?.source === node ? 2 : 0) + (inputLinkInfo(b, "negative")?.source === node ? 2 : 0) + (inputLinkInfo(b, "model")?.source === node ? 1 : 0);
            return bScore - aScore;
        })[0] || null;
    };
    const rememberInputReplacement = (targetNode, inputSlot, report) => {
        const captured = captureInputLink(targetNode, inputSlot);
        if (captured) report?.replacedLinks?.push(captured);
        return captured;
    };
    const connectGraphSlotsByIndex = (fromNode, outputSlot, toNode, inputSlot, report, label) => {
        if (!fromNode || !toNode || outputSlot < 0 || inputSlot < 0) {
            report?.warnings?.push(`无法连接: ${label}`);
            return false;
        }
        rememberInputReplacement(toNode, inputSlot, report);
        connectNodes(fromNode, outputSlot, toNode, inputSlot);
        report?.connected?.push(label);
        return true;
    };
    const copySamplerWidgetValue = (sourceNode, targetNode, widgetName, fallback = undefined) => {
        const sourceWidget = getWidget(sourceNode, widgetName);
        const value = sourceWidget?.value ?? fallback;
        if (value !== undefined) return setNodeWidgetValue(targetNode, widgetName, value);
        return false;
    };
    const configureHiresSampler = (sourceSampler, hiresSampler) => {
        if (!hiresSampler) return;
        copySamplerWidgetValue(sourceSampler, hiresSampler, "seed");
        copySamplerWidgetValue(sourceSampler, hiresSampler, "control_after_generate");
        copySamplerWidgetValue(sourceSampler, hiresSampler, "cfg", 5);
        copySamplerWidgetValue(sourceSampler, hiresSampler, "sampler_name", "euler");
        copySamplerWidgetValue(sourceSampler, hiresSampler, "scheduler", "normal");
        setNodeWidgetValue(hiresSampler, "steps", Math.max(1, Math.round(normalizeClipStrength(moduleUpscaleStepsInput.value, 18))));
        setNodeWidgetValue(hiresSampler, "denoise", Math.max(0.01, Math.min(1, normalizeClipStrength(moduleUpscaleDenoiseInput.value, 0.48))));
    };
    const applyHiresSharpDefaults = () => {
        const mode = moduleUpscaleModeInput.value || "hires_fix";
        if (mode !== "hires_fix" && mode !== "latent_upscale") return false;
        const steps = Math.round(normalizeClipStrength(moduleUpscaleStepsInput.value, 18));
        const denoise = normalizeClipStrength(moduleUpscaleDenoiseInput.value, 0.48);
        const upscaler = String(moduleUpscaleUpscalerInput.value || "").trim().toLowerCase();
        const looksLikeOldDefault = steps <= 12 && denoise <= 0.36 && (!upscaler || upscaler === "latent" || upscaler === "bislerp");
        if (!looksLikeOldDefault) return false;
        moduleUpscaleStepsInput.value = "18";
        moduleUpscaleDenoiseInput.value = "0.48";
        moduleUpscaleUpscalerInput.value = "nearest-exact";
        syncModuleWidgets();
        return true;
    };
    const connectMatchingInputSource = (sourceNode, sourceInputName, targetNode, targetInputName, report) => {
        const info = inputLinkInfo(sourceNode, sourceInputName);
        const targetSlot = graphSlotIndex(targetNode, "input", targetInputName);
        if (!info?.source || targetSlot < 0) return false;
        return connectGraphSlotsByIndex(
            info.source,
            info.sourceSlot,
            targetNode,
            targetSlot,
            report,
            `${graphNodeLabel(info.source)} -> ${graphNodeLabel(targetNode)}.${targetInputName}`
        );
    };
    const insertLatentUpscaleIntoMainRoute = (latentNode, hiresSampler, report) => {
        const sampler = findBridgeDrivenSampler();
        if (!sampler) {
            report?.warnings?.push("没有找到当前 Bridge 驱动的 KSampler 主链路，放大节点需要手动接入。");
            return false;
        }
        const samplerOutputSlot = outputSlotForType(sampler, "LATENT", 0);
        const targets = outputLinkedTargets(sampler, samplerOutputSlot)
            .filter(({ target, inputSlot }) => {
                const input = target?.inputs?.[inputSlot];
                const text = `${target?.type || ""} ${target?.title || ""}`.toLowerCase();
                return input?.name === "samples" || text.includes("vaedecode");
            });
        if (!targets.length) {
            report?.warnings?.push(`找到了 ${graphNodeLabel(sampler)}，但没有找到它后面的 VAE Decode.samples，放大节点需要手动接入。`);
            return false;
        }
        const latentInputSlot = graphSlotIndex(latentNode, "input", "samples");
        const latentOutputSlot = graphSlotIndex(latentNode, "output", "latent");
        const hiresLatentInputSlot = graphSlotIndex(hiresSampler, "input", "latent_image");
        const hiresOutputSlot = outputSlotForType(hiresSampler, "LATENT", 0);
        if (!hiresSampler || hiresLatentInputSlot < 0 || hiresOutputSlot < 0) {
            report?.warnings?.push("没有创建可用的 Hires KSampler，放大节点需要手动接入。");
            return false;
        }
        configureHiresSampler(sampler, hiresSampler);
        const connectedIn = connectGraphSlotsByIndex(
            sampler,
            samplerOutputSlot,
            latentNode,
            latentInputSlot,
            report,
            `${graphNodeLabel(sampler)}.LATENT -> ${graphNodeLabel(latentNode)}.samples`
        );
        const connectedHiresInputs = ["model", "positive", "negative"]
            .map((inputName) => connectMatchingInputSource(sampler, inputName, hiresSampler, inputName, report))
            .filter(Boolean).length;
        const connectedToHires = connectGraphSlotsByIndex(
            latentNode,
            latentOutputSlot,
            hiresSampler,
            hiresLatentInputSlot,
            report,
            `${graphNodeLabel(latentNode)}.latent -> ${graphNodeLabel(hiresSampler)}.latent_image`
        );
        let connectedOut = 0;
        for (const { target, inputSlot } of targets) {
            if (connectGraphSlotsByIndex(
                hiresSampler,
                hiresOutputSlot,
                target,
                inputSlot,
                report,
                `${graphNodeLabel(hiresSampler)}.LATENT -> ${graphNodeLabel(target)}.${target.inputs?.[inputSlot]?.name || inputSlot}`
            )) connectedOut += 1;
        }
        if (connectedIn && connectedToHires && connectedOut) {
            report.manualHint = `已构建 Hires.fix 主链路：原 KSampler -> Latent Upscale -> Hires KSampler -> VAE Decode；二次采样 steps=${Math.max(1, Math.round(normalizeClipStrength(moduleUpscaleStepsInput.value, 18)))} denoise=${Math.max(0.01, Math.min(1, normalizeClipStrength(moduleUpscaleDenoiseInput.value, 0.48))).toFixed(2)}${connectedHiresInputs < 3 ? "；部分采样输入需要手动确认" : ""}`;
            return true;
        }
        return false;
    };
    const insertImageUpscaleIntoMainRoute = (imageNode, report) => {
        const imageSources = getGraphNodes().filter((graphNode) => {
            const imageSlot = outputSlotForType(graphNode, "IMAGE", -1);
            if (imageSlot < 0) return false;
            const text = `${graphNode?.type || ""} ${graphNode?.title || ""}`.toLowerCase();
            return text.includes("vaedecode") || outputLinkedTargets(graphNode, imageSlot).some(({ target }) => /preview|save|gallery/i.test(`${target?.type || ""} ${target?.title || ""}`));
        });
        const source = imageSources[0] || null;
        const sourceOutputSlot = outputSlotForType(source, "IMAGE", -1);
        const targets = outputLinkedTargets(source, sourceOutputSlot)
            .filter(({ target, inputSlot }) => {
                const input = target?.inputs?.[inputSlot];
                return input?.name === "images" || slotTypesCompatible(source?.outputs?.[sourceOutputSlot]?.type, input?.type);
            });
        if (!source || !targets.length) return false;
        const imageInputSlot = graphSlotIndex(imageNode, "input", "image");
        const imageOutputSlot = graphSlotIndex(imageNode, "output", "image");
        const connectedIn = connectGraphSlotsByIndex(
            source,
            sourceOutputSlot,
            imageNode,
            imageInputSlot,
            report,
            `${graphNodeLabel(source)}.IMAGE -> ${graphNodeLabel(imageNode)}.image`
        );
        let connectedOut = 0;
        for (const { target, inputSlot } of targets) {
            if (connectGraphSlotsByIndex(
                imageNode,
                imageOutputSlot,
                target,
                inputSlot,
                report,
                `${graphNodeLabel(imageNode)}.image -> ${graphNodeLabel(target)}.${target.inputs?.[inputSlot]?.name || inputSlot}`
            )) connectedOut += 1;
        }
        if (connectedIn && connectedOut) {
            report.manualHint = "已把 Image Upscale 插入当前 VAE Decode -> Preview/Save 输出链路";
            return true;
        }
        return false;
    };
    const findLikelyVaeSource = () => {
        const candidates = getGraphNodes()
            .map((graphNode) => {
                const outputSlot = outputSlotForType(graphNode, "VAE", -1);
                if (outputSlot < 0) return null;
                const text = `${graphNode?.type || ""} ${graphNode?.title || ""}`.toLowerCase();
                let score = 0;
                if (text.includes("checkpoint") || text.includes("vae")) score += 3;
                if (outputLinkedTargets(graphNode, outputSlot).length) score += 2;
                return { graphNode, outputSlot, score };
            })
            .filter(Boolean)
            .sort((a, b) => b.score - a.score);
        return candidates[0] || null;
    };
    const insertImg2ImgIntoMainRoute = (encoderNode, report) => {
        const sampler = findBridgeDrivenSampler();
        if (!sampler) {
            report?.warnings?.push("没有找到当前 Bridge 驱动的 KSampler，请先把 Bridge 的 model/positive/negative 接到采样器。");
            return false;
        }
        const vaeSource = findLikelyVaeSource();
        if (!vaeSource) {
            report?.warnings?.push("没有找到可用 VAE 输出；请把 CheckpointLoader/VAELoader 的 VAE 接到 VAE Encode。");
            return false;
        }
        let connected = 0;
        if (connectGraphSlots(node, "image", encoderNode, "pixels", report)) connected += 1;
        if (graphSlotIndex(encoderNode, "input", "mask") >= 0 && connectGraphSlots(node, "mask", encoderNode, "mask", report)) connected += 1;
        if (connectGraphSlotsByIndex(
            vaeSource.graphNode,
            vaeSource.outputSlot,
            encoderNode,
            graphSlotIndex(encoderNode, "input", "vae"),
            report,
            `${graphNodeLabel(vaeSource.graphNode)}.VAE -> ${graphNodeLabel(encoderNode)}.vae`
        )) connected += 1;
        const samplerLatentSlot = graphSlotIndex(sampler, "input", "latent_image");
        rememberInputReplacement(sampler, samplerLatentSlot, report);
        if (connectGraphSlots(encoderNode, "LATENT", sampler, "latent_image", report, { replace: true })) connected += 1;
        setNodeWidgetValue(sampler, "denoise", Math.max(0, Math.min(1, normalizeClipStrength(moduleImg2ImgDenoiseWidget?.value ?? 0.55, 0.55))));
        report.manualHint = `已接入 ${graphNodeLabel(encoderNode)} -> ${graphNodeLabel(sampler)}.latent_image；采样器 denoise 已设为 ${Number(getWidget(sampler, "denoise")?.value ?? 0).toFixed(2)}`;
        return connected >= 3;
    };
    const createBridgeModuleGraphNode = (type, title, x, y, report = null) => {
        let graphNode = null;
        try {
            graphNode = LiteGraph?.createNode?.(type);
        } catch (error) {
            report?.errors?.push(`创建节点失败: ${title || type} (${error?.message || error})`);
            return null;
        }
        if (!graphNode) {
            report?.errors?.push(`没有找到节点: ${title || type}。请确认后端已加载并重启 ComfyUI。`);
            return null;
        }
        graphNode.pos = [x, y];
        try {
            app.graph.add(graphNode);
        } catch (error) {
            report?.errors?.push(`添加节点失败: ${title || type} (${error?.message || error})`);
            return null;
        }
        return graphNode;
    };
    const moduleBuildHistory = [];
    const restoreButtons = [];
    const updateModuleRestoreButtons = () => {
        for (const button of restoreButtons) {
            const kind = button.dataset.moduleKind;
            button.disabled = !moduleBuildHistory.some((item) => item.kind === kind);
        }
    };
    const removeCreatedGraphNode = (graphNode) => {
        if (!graphNode || !getGraphNodeById(graphNode.id)) return false;
        try {
            app.graph.remove?.(graphNode);
            return true;
        } catch {
            return false;
        }
    };
    const restoreLastModuleBuild = (kind) => {
        const index = moduleBuildHistory.map((item) => item.kind).lastIndexOf(kind);
        if (index < 0) {
            setStatus("没有可还原的构建记录", { kind: "warning" });
            updateModuleRestoreButtons();
            return;
        }
        const session = moduleBuildHistory.splice(index, 1)[0];
        let restoredLinks = 0;
        const restoredTargets = new Set();
        for (const captured of [...(session.replacedLinks || [])].reverse()) {
            const key = `${captured.targetId}:${captured.targetSlot}`;
            if (restoredTargets.has(key)) continue;
            if (restoreCapturedLink(captured)) restoredLinks += 1;
            restoredTargets.add(key);
        }
        let removedNodes = 0;
        for (const graphNode of [...(session.created || [])].reverse()) {
            if (removeCreatedGraphNode(graphNode)) removedNodes += 1;
        }
        restoreModuleControlSnapshot(session.moduleControls);
        app.graph.setDirtyCanvas?.(true, true);
        updateModuleRestoreButtons();
        setStatus(`已还原 ${session.label} 构建：删除 ${removedNodes} 个外置节点，恢复 ${restoredLinks} 条线`, { kind: "success", sticky: true });
    };
    const bridgeNodeGraphPosition = () => {
        const x = Number(node.pos?.[0]) || 0;
        const y = Number(node.pos?.[1]) || 0;
        const width = Number(node.size?.[0]) || DEFAULT_PANEL_WIDTH;
        const buildIndex = Number(node.__webuiBridgeExternalBuildCount || 0);
        node.__webuiBridgeExternalBuildCount = buildIndex + 1;
        return { x: x + width + 80, y: y + buildIndex * 260 };
    };
    const finishModuleGraphBuild = (created, label, report) => {
        if (!created.length) {
            const message = report?.errors?.length
                ? report.errors.join("；")
                : `${label} 外置节点构建失败。`;
            setStatus(message, { kind: "error", sticky: true });
            return;
        }
        app.graph.setDirtyCanvas?.(true, true);
        if (created[0]) {
            app.canvas.selectNode?.(created[0]);
        }
        const missingInputs = report?.manualHint || "未自动连接的 IMAGE / VAE / MASK / CONTROL_NET 等接口，需要按当前工作流手动接入";
        const details = [];
        if (report?.errors?.length) details.push(`失败: ${report.errors.slice(0, 3).join("；")}`);
        if (report?.warnings?.length) details.push(`注意: ${report.warnings.slice(0, 4).join("；")}`);
        const kind = report?.errors?.length ? "error" : (report?.warnings?.length ? "warning" : "success");
        const prefix = report?.errors?.length ? `部分构建 ${label} 外置节点` : `已构建 ${label} 外置节点`;
        setStatus(`${prefix}，已自动连接 ${report?.connected?.length || 0} 条线；${missingInputs}${details.length ? `；${details.join("；")}` : ""}`, { kind, sticky: true });
    };
    const buildExternalModuleNodes = (kind) => {
        const report = { connected: [], warnings: [], errors: [], replacedLinks: [] };
        const moduleControlsSnapshot = captureModuleControlSnapshot();
        try {
            syncModuleWidgets();
        } catch (error) {
            setStatus(`同步模块参数失败: ${error?.message || error}`, { kind: "error", sticky: true });
            return;
        }
        if (!app?.graph || !LiteGraph) {
            setStatus("无法构建外置节点：ComfyUI 图形接口还没有就绪，请稍后再试。", { kind: "error", sticky: true });
            return;
        }
        const { x, y } = bridgeNodeGraphPosition();
        const created = [];
        const make = (type, title, dx, dy) => {
            const graphNode = createBridgeModuleGraphNode(type, title, x + dx, y + dy, report);
            if (graphNode) created.push(graphNode);
            return graphNode;
        };
        if (kind === "img2img") {
            setWidgetValue(node, "module_img2img_enabled", true);
            const mode = String(moduleImg2ImgModeWidget?.value || "img2img");
            const hasMask = Boolean(normalizeBridgeImageRef(moduleImg2ImgMaskWidget?.value));
            const encoder = mode === "inpaint" || hasMask
                ? make("VAEEncodeForInpaint", "VAE Encode Inpaint", 0, 0)
                : make("VAEEncode", "VAE Encode Img2Img", 0, 0);
            if (encoder && encoder.type === "VAEEncodeForInpaint") setNodeWidgetValue(encoder, "grow_mask_by", 4);
            if (encoder) insertImg2ImgIntoMainRoute(encoder, report);
            moduleBuildHistory.push({ kind, label: "图生图 / 局部重绘", created: [...created], replacedLinks: [...report.replacedLinks], moduleControls: moduleControlsSnapshot });
            updateModuleRestoreButtons();
            finishModuleGraphBuild(created, "图生图 / 局部重绘", report);
            return;
        }
        if (kind === "mask") {
            moduleMaskEnabledInput.checked = true;
            moduleSamEnabledInput.checked = moduleSamEnabledInput.checked || false;
            syncModuleWidgets();
            const latent = make("WebUIPromptBridgeSetLatentMask", "Set Latent Mask", 0, 0);
            const inpaint = make("WebUIPromptBridgeInpaintConditioning", "Inpaint Conditioning", 0, 190);
            connectGraphSlots(node, "module_config", latent, "module_config", report);
            connectGraphSlots(node, "positive", inpaint, "positive", report);
            connectGraphSlots(node, "negative", inpaint, "negative", report);
            connectGraphSlots(node, "module_config", inpaint, "module_config", report);
            moduleBuildHistory.push({ kind, label: "Mask / Inpaint", created: [...created], replacedLinks: [...report.replacedLinks], moduleControls: moduleControlsSnapshot });
            updateModuleRestoreButtons();
            finishModuleGraphBuild(created, "Mask / Inpaint", report);
            return;
        }
        if (kind === "adetailer") {
            moduleAdetailerEnabledInput.checked = true;
            syncModuleWidgets();
            const conditioning = make("WebUIPromptBridgeADetailerConditioning", "ADetailer Conditioning", 0, 0);
            const apply = make("WebUIPromptBridgeADetailerApply", "Apply ADetailer", 420, 0);
            connectGraphSlots(node, "clip", conditioning, "clip", report);
            connectGraphSlots(node, "positive", conditioning, "positive", report);
            connectGraphSlots(node, "negative", conditioning, "negative", report);
            connectGraphSlots(node, "module_config", conditioning, "module_config", report);
            connectGraphSlots(node, "model", apply, "model", report);
            connectGraphSlots(node, "clip", apply, "clip", report);
            connectGraphSlots(node, "module_config", apply, "module_config", report);
            connectGraphSlots(conditioning, "positive", apply, "positive", report);
            connectGraphSlots(conditioning, "negative", apply, "negative", report);
            moduleBuildHistory.push({ kind, label: "ADetailer", created: [...created], replacedLinks: [...report.replacedLinks], moduleControls: moduleControlsSnapshot });
            updateModuleRestoreButtons();
            finishModuleGraphBuild(created, "ADetailer", report);
            return;
        }
        if (kind === "controlnet") {
            moduleControlnetEnabledInput.checked = true;
            syncModuleWidgets();
            const apply = make("WebUIPromptBridgeControlNetApply", "Apply ControlNet", 0, 0);
            connectGraphSlots(node, "positive", apply, "positive", report);
            connectGraphSlots(node, "negative", apply, "negative", report);
            connectGraphSlots(node, "module_config", apply, "module_config", report);
            moduleBuildHistory.push({ kind, label: "ControlNet", created: [...created], replacedLinks: [...report.replacedLinks], moduleControls: moduleControlsSnapshot });
            updateModuleRestoreButtons();
            finishModuleGraphBuild(created, "ControlNet", report);
            return;
        }
        if (kind === "sam") {
            moduleSamEnabledInput.checked = true;
            moduleMaskEnabledInput.checked = true;
            syncModuleWidgets();
            const latent = make("WebUIPromptBridgeSetLatentMask", "Set Latent Mask", 0, 0);
            const inpaint = make("WebUIPromptBridgeInpaintConditioning", "Inpaint Conditioning", 420, 0);
            connectGraphSlots(node, "module_config", latent, "module_config", report);
            connectGraphSlots(node, "positive", inpaint, "positive", report);
            connectGraphSlots(node, "negative", inpaint, "negative", report);
            connectGraphSlots(node, "module_config", inpaint, "module_config", report);
            moduleBuildHistory.push({ kind, label: "SAM / Inpaint", created: [...created], replacedLinks: [...report.replacedLinks], moduleControls: moduleControlsSnapshot });
            updateModuleRestoreButtons();
            finishModuleGraphBuild(created, "SAM / Inpaint", report);
            return;
        }
        if (kind === "upscale") {
            moduleUpscaleEnabledInput.checked = true;
            const upgradedSharpDefaults = applyHiresSharpDefaults();
            syncModuleWidgets();
            const mode = moduleUpscaleModeInput.value || "hires_fix";
            const latent = make("WebUIPromptBridgeLatentUpscale", "Latent Upscale", 0, 0);
            const hires = make("KSampler", "Hires.fix KSampler", 420, 0);
            setNodeWidgetValue(latent, "fallback_method", "nearest-exact");
            connectGraphSlots(node, "module_config", latent, "module_config", report);
            const insertedLatent = insertLatentUpscaleIntoMainRoute(latent, hires, report);
            if (upgradedSharpDefaults) {
                report.warnings.push("已把旧版偏糊的 Hires.fix 默认值升级为清晰优先：nearest-exact / steps 18 / denoise 0.48。");
            }
            if (!insertedLatent) {
                let image = null;
                if (mode === "ultimate_sd_upscale" || mode === "tile") {
                    image = make("WebUIPromptBridgeImageUpscale", "Image Upscale", 0, 220);
                    connectGraphSlots(node, "module_config", image, "module_config", report);
                }
                if (!image || !insertImageUpscaleIntoMainRoute(image, report)) {
                    report.warnings.push("放大节点已创建，但没有找到可自动改线的 KSampler/VAE/Preview 主链路。真正 Hires.fix 需要接成：原 KSampler.LATENT -> Latent Upscale.samples -> Hires KSampler.latent_image -> VAE Decode.samples。");
                }
            }
            moduleBuildHistory.push({ kind, label: "放大修复", created: [...created], replacedLinks: [...report.replacedLinks], moduleControls: moduleControlsSnapshot });
            updateModuleRestoreButtons();
            finishModuleGraphBuild(created, "放大修复", report);
            return;
        }
    };
    const buildModuleButton = (kind, label) => el("button", {
        class: "webui-bridge-module-button",
        type: "button",
        onclick: () => buildExternalModuleNodes(kind),
    }, label);
    const restoreModuleButton = (kind, label = "还原上次构建") => {
        const button = el("button", {
            class: "webui-bridge-module-button webui-bridge-module-button-secondary",
            type: "button",
            disabled: "disabled",
            onclick: () => restoreLastModuleBuild(kind),
        }, label);
        button.dataset.moduleKind = kind;
        restoreButtons.push(button);
        return button;
    };
    const moduleBuildActions = (kind, label) => el("div", { class: "webui-bridge-module-actions" }, [
        buildModuleButton(kind, label),
        restoreModuleButton(kind),
    ]);
    const regionalModuleSection = el("div", { class: "webui-bridge-modules" }, [
        moduleSection("module_img2img", "图生图 / 局部重绘", null, [
            moduleHint("直接在主节点侧栏上传原图；需要局部重绘时打开涂抹编辑，主节点会输出 IMAGE、MASK、denoise 和 mode。"),
            buildBridgeImageInputPanel(node, {
                title: "图生图输入",
                subtitle: "输出在主节点 image / mask 接口，可接 VAE Encode 或 Inpaint Conditioning",
                imageWidget: "module_img2img_image",
                maskWidget: "module_img2img_mask",
                modeWidget: "module_img2img_mode",
                denoiseWidget: "module_img2img_denoise",
                enabledWidget: "module_img2img_enabled",
            }),
            moduleBuildActions("img2img", "一键接入图生图链路"),
        ]),
        moduleSection("module_table", "区域表格", moduleTableEnabledInput, [
            moduleHint("启用后后端会记录模块状态；按钮可把表格内容回写为 BREAK 区域文本。"),
            el("button", { class: "webui-bridge-module-button", type: "button", onclick: showRegionalTableAssistant }, "打开表格编辑"),
        ]),
        moduleSection("module_mask", "Mask 区域", moduleMaskEnabledInput, [
            moduleHint("连接本节点可选 MASK 输入后，启用会把 mask 写入正向 conditioning；也可把 module_config 接到 WebUI Bridge Set Latent Mask。"),
            el("label", {}, [el("span", {}, "强度"), moduleMaskStrengthInput]),
            el("label", { class: "webui-bridge-module-check" }, [moduleMaskBoundsInput, el("span", {}, "Mask 决定采样边界")]),
            moduleBuildActions("mask", "一键构建 Mask/Inpaint 节点"),
            el("button", { class: "webui-bridge-module-button", type: "button", onclick: showMaskModule }, "查看接入方式"),
        ]),
        moduleSection("module_negative_common", "负向 Common", moduleNegativeCommonEnabledInput, [
            moduleHint("生成时把这里的通用反向词合并到每个反向区域。"),
            moduleNegativeCommonPromptInput,
            el("button", { class: "webui-bridge-module-button", type: "button", onclick: () => {
                moduleNegativeCommonEnabledInput.checked = true;
                moduleNegativeCommonPromptInput.value = negative.textarea.value.trim() && !/\bBREAK\b/i.test(negative.textarea.value) ? negative.textarea.value.trim() : "worst quality, low quality, blurry";
                applyNegativeCommonTemplate();
                syncModuleWidgets();
            } }, "从当前反向词生成模板"),
            el("button", { class: "webui-bridge-module-button", type: "button", onclick: showNegativeCommonModule }, "查看模块说明"),
        ]),
        moduleSection("module_flip", "区域翻转", moduleFlipEnabledInput, [
            moduleHint("启用后生成时会翻转区域顺序；也可以立即把文本和比例翻转写回。"),
            el("label", {}, [el("span", {}, "方向"), moduleFlipAxisInput]),
            el("button", { class: "webui-bridge-module-button", type: "button", onclick: () => {
                moduleFlipEnabledInput.checked = true;
                flipRegionalPrompt();
                syncModuleWidgets();
            } }, "立即翻转并写回"),
        ]),
        moduleSection("module_presets", "区域 Preset", modulePresetsEnabledInput, [
            moduleHint("保存/加载区域比例、Base/Common 和提示词模板。"),
            el("button", { class: "webui-bridge-module-button", type: "button", onclick: showPresetModule }, "管理 Preset"),
        ]),
        moduleSection("module_adetailer", "ADetailer 局部修复", moduleAdetailerEnabledInput, [
            moduleHint("检测脸、手、人物等目标区域后局部重绘。module_config 可接 WebUI Bridge ADetailer Conditioning，再接 WebUI Bridge Apply ADetailer 直接输出修复图。"),
            moduleAssetStatus("ultralytics", "impact_pack"),
            el("label", {}, [el("span", {}, "模型"), moduleAdetailerModelInput]),
            el("div", { class: "webui-bridge-module-grid" }, [
                el("label", {}, [el("span", {}, "置信度"), moduleAdetailerConfidenceInput]),
                el("label", {}, [el("span", {}, "重绘"), moduleAdetailerDenoiseInput]),
                el("label", {}, [el("span", {}, "模糊"), moduleAdetailerMaskBlurInput]),
                el("label", {}, [el("span", {}, "次数"), moduleAdetailerCyclesInput]),
            ]),
            el("label", { class: "webui-bridge-module-check" }, [moduleAdetailerInpaintOnlyMaskedInput, el("span", {}, "仅重绘遮罩区域")]),
            el("label", {}, [el("span", {}, "正向"), moduleAdetailerPromptInput]),
            el("label", {}, [el("span", {}, "反向"), moduleAdetailerNegativePromptInput]),
            el("div", { class: "webui-bridge-module-actions" }, [
                el("button", { class: "webui-bridge-module-button", type: "button", onclick: () => {
                    moduleAdetailerEnabledInput.checked = true;
                    moduleAdetailerModelInput.value = "face_yolov8m.pt";
                    moduleAdetailerPromptInput.value = "detailed face, detailed eyes, symmetrical face, clean skin";
                    moduleAdetailerNegativePromptInput.value = "bad face, deformed eyes, blurry, low quality";
                    moduleAdetailerConfidenceInput.value = "0.30";
                    moduleAdetailerDenoiseInput.value = "0.40";
                    moduleAdetailerMaskBlurInput.value = "4";
                    syncModuleWidgets();
                } }, "脸部模板"),
                el("button", { class: "webui-bridge-module-button", type: "button", onclick: () => {
                    moduleAdetailerEnabledInput.checked = true;
                    moduleAdetailerModelInput.value = "hand_yolov8s.pt";
                    moduleAdetailerPromptInput.value = "detailed hands, natural fingers, correct hand anatomy";
                    moduleAdetailerNegativePromptInput.value = "bad hands, extra fingers, fused fingers, missing fingers, deformed hands";
                    moduleAdetailerConfidenceInput.value = "0.25";
                    moduleAdetailerDenoiseInput.value = "0.45";
                    moduleAdetailerMaskBlurInput.value = "6";
                    syncModuleWidgets();
                } }, "手部模板"),
            ]),
            moduleBuildActions("adetailer", "一键构建 ADetailer 节点"),
            refreshModuleAssetsButton(),
            installModuleAssetsButton(["impact_pack", "impact_subpack"], "安装检测节点包"),
        ]),
        moduleSection("module_controlnet", "ControlNet", moduleControlnetEnabledInput, [
            moduleHint("WebUI ControlNet 风格配置模块。把 module_config、CONTROL_NET、控制图接到 WebUI Bridge Apply ControlNet 即可应用权重和控制区间。"),
            moduleAssetStatus("controlnet", "controlnet_aux"),
            el("label", {}, [el("span", {}, "预处理"), moduleControlnetPreprocessorInput]),
            el("label", {}, [el("span", {}, "模型"), moduleControlnetModelInput]),
            el("div", { class: "webui-bridge-module-grid" }, [
                el("label", {}, [el("span", {}, "权重"), moduleControlnetWeightInput]),
                el("label", {}, [el("span", {}, "起点"), moduleControlnetStartInput]),
                el("label", {}, [el("span", {}, "终点"), moduleControlnetEndInput]),
                el("label", {}, [el("span", {}, "Resize"), moduleControlnetResizeModeInput]),
            ]),
            el("label", {}, [el("span", {}, "模式"), moduleControlnetControlModeInput]),
            el("label", { class: "webui-bridge-module-check" }, [moduleControlnetPixelPerfectInput, el("span", {}, "Pixel Perfect")]),
            el("div", { class: "webui-bridge-module-actions" }, [
                el("button", { class: "webui-bridge-module-button", type: "button", onclick: () => {
                    moduleControlnetEnabledInput.checked = true;
                    moduleControlnetPreprocessorInput.value = "canny";
                    moduleControlnetModelInput.value = "control_v11p_sd15_canny";
                    moduleControlnetWeightInput.value = "1";
                    moduleControlnetStartInput.value = "0";
                    moduleControlnetEndInput.value = "1";
                    moduleControlnetControlModeInput.value = "balanced";
                    moduleControlnetPixelPerfectInput.checked = true;
                    syncModuleWidgets();
                } }, "Canny 模板"),
                el("button", { class: "webui-bridge-module-button", type: "button", onclick: () => {
                    moduleControlnetEnabledInput.checked = true;
                    moduleControlnetPreprocessorInput.value = "openpose";
                    moduleControlnetModelInput.value = "control_v11p_sd15_openpose";
                    moduleControlnetWeightInput.value = "0.85";
                    moduleControlnetStartInput.value = "0";
                    moduleControlnetEndInput.value = "0.85";
                    moduleControlnetControlModeInput.value = "control";
                    moduleControlnetPixelPerfectInput.checked = true;
                    syncModuleWidgets();
                } }, "OpenPose 模板"),
            ]),
            moduleBuildActions("controlnet", "一键构建 ControlNet 节点"),
            refreshModuleAssetsButton(),
            installModuleAssetsButton(["controlnet_aux"], "安装预处理节点包"),
        ]),
        moduleSection("module_sam", "SAM/Inpaint", moduleSamEnabledInput, [
            moduleHint("SAM 分割 + Inpaint 参数模块。已有 MASK 时可把 module_config 接到 WebUI Bridge Inpaint Conditioning 或 Set Latent Mask；检测模型链路可接 SAM 类节点。"),
            moduleAssetStatus("sams", "segment_anything"),
            el("label", {}, [el("span", {}, "模型"), moduleSamModelInput]),
            el("label", {}, [el("span", {}, "模式"), moduleSamPromptModeInput]),
            el("div", { class: "webui-bridge-module-grid" }, [
                el("label", {}, [el("span", {}, "阈值"), moduleSamConfidenceInput]),
                el("label", {}, [el("span", {}, "模糊"), moduleSamMaskBlurInput]),
                el("label", {}, [el("span", {}, "扩张"), moduleSamDilateInput]),
                el("label", {}, [el("span", {}, "重绘"), moduleSamInpaintDenoiseInput]),
                el("label", {}, [el("span", {}, "范围"), moduleSamInpaintAreaInput]),
                el("label", {}, [el("span", {}, "Padding"), moduleSamPaddingInput]),
            ]),
            el("div", { class: "webui-bridge-module-actions" }, [
                el("button", { class: "webui-bridge-module-button", type: "button", onclick: () => {
                    moduleSamEnabledInput.checked = true;
                    moduleSamModelInput.value = "sam_vit_b";
                    moduleSamPromptModeInput.value = "auto";
                    moduleSamConfidenceInput.value = "0.50";
                    moduleSamMaskBlurInput.value = "4";
                    moduleSamDilateInput.value = "4";
                    moduleSamInpaintDenoiseInput.value = "0.45";
                    moduleSamInpaintAreaInput.value = "only_masked";
                    moduleSamPaddingInput.value = "32";
                    syncModuleWidgets();
                } }, "局部重绘模板"),
                el("button", { class: "webui-bridge-module-button", type: "button", onclick: showMaskModule }, "Mask 接入"),
            ]),
            moduleBuildActions("sam", "一键构建 SAM/Inpaint 节点"),
            refreshModuleAssetsButton(),
            installModuleAssetsButton(["segment_anything"], "安装 SAM 节点包"),
        ]),
        moduleSection("module_upscale", "放大修复", moduleUpscaleEnabledInput, [
            moduleHint("WebUI Hires.fix / Ultimate SD Upscale 风格参数。module_config 可接 WebUI Bridge Image Upscale 或 Latent Upscale 直接按倍率放大。"),
            moduleAssetStatus("upscale_models", "ultimate_upscale"),
            el("label", {}, [el("span", {}, "模式"), moduleUpscaleModeInput]),
            el("label", {}, [el("span", {}, "算法"), moduleUpscaleUpscalerInput]),
            el("div", { class: "webui-bridge-module-grid" }, [
                el("label", {}, [el("span", {}, "倍率"), moduleUpscaleByInput]),
                el("label", {}, [el("span", {}, "步数"), moduleUpscaleStepsInput]),
                el("label", {}, [el("span", {}, "重绘"), moduleUpscaleDenoiseInput]),
                el("label", {}, [el("span", {}, "重叠"), moduleUpscaleOverlapInput]),
                el("label", {}, [el("span", {}, "Tile W"), moduleUpscaleTileWidthInput]),
                el("label", {}, [el("span", {}, "Tile H"), moduleUpscaleTileHeightInput]),
            ]),
            el("div", { class: "webui-bridge-module-actions" }, [
                el("button", { class: "webui-bridge-module-button", type: "button", onclick: () => {
                    moduleUpscaleEnabledInput.checked = true;
                    moduleUpscaleModeInput.value = "hires_fix";
                    moduleUpscaleByInput.value = "2";
                    moduleUpscaleUpscalerInput.value = "nearest-exact";
                    moduleUpscaleStepsInput.value = "18";
                    moduleUpscaleDenoiseInput.value = "0.48";
                    syncModuleWidgets();
                } }, "Hires.fix"),
                el("button", { class: "webui-bridge-module-button", type: "button", onclick: () => {
                    moduleUpscaleEnabledInput.checked = true;
                    moduleUpscaleModeInput.value = "ultimate_sd_upscale";
                    moduleUpscaleByInput.value = "2";
                    moduleUpscaleUpscalerInput.value = "4x-UltraSharp";
                    moduleUpscaleStepsInput.value = "20";
                    moduleUpscaleDenoiseInput.value = "0.30";
                    moduleUpscaleTileWidthInput.value = "768";
                    moduleUpscaleTileHeightInput.value = "768";
                    moduleUpscaleOverlapInput.value = "64";
                    syncModuleWidgets();
                } }, "Ultimate"),
            ]),
            moduleBuildActions("upscale", "一键构建放大节点"),
            refreshModuleAssetsButton(),
            installModuleAssetsButton(["ultimate_upscale"], "安装 Ultimate 节点包"),
        ]),
        moduleSection("module_regional_lora", "区域 LoRA", moduleRegionalLoraEnabledInput, [
            moduleHint("后端会审计区域 prompt 里的 LoRA；普通 LoRA 仍是全局加载，需要严格分离时用多分支 + mask 合成。"),
        ]),
    ]);
    renderModuleAssetStatuses = () => {
        for (const item of regionalModuleSection.querySelectorAll(".webui-bridge-module-asset")) item.__webuiBridgeRender?.();
        for (const item of document.querySelectorAll(".webui-bridge-settings-asset-card")) item.__webuiBridgeRender?.();
    };
    syncModuleWidgets();

    const setStatus = (message, options = {}) => {
        window.clearTimeout(statusTimer);
        status.textContent = message || "";
        status.classList.toggle("visible", Boolean(message));
        status.classList.toggle("error", options.kind === "error");
        status.classList.toggle("success", options.kind === "success");
        status.classList.toggle("warning", options.kind === "warning");
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
        state.moduleAssets = data.moduleAssets || data.module_assets || state.moduleAssets;
        renderModuleAssetStatuses();
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
        let autoDetectButton = null;
        let connectButton = null;
        let dialogBusy = false;
        let integrationOperationId = 0;
        let activeIntegrationController = null;
        const setDialogBusy = (busy, activeButton = null) => {
            dialogBusy = busy;
            rootInput.disabled = busy;
            guessSelect.disabled = busy;
            if (autoDetectButton) autoDetectButton.disabled = busy;
            if (connectButton) connectButton.disabled = busy;
            if (webuiAssetsButton) webuiAssetsButton.disabled = busy || Boolean(webuiAssetsButton.__webuiBridgeReady);
            if (autoDetectButton) autoDetectButton.textContent = busy && activeButton === autoDetectButton ? "检测中..." : "自动检测";
            if (connectButton) connectButton.textContent = busy && activeButton === connectButton ? "接入中..." : "接入并刷新";
        };
        const close = () => {
            activeIntegrationController?.abort?.();
            integrationOperationId += 1;
            mask.remove();
        };
        const renderInfo = (info) => {
            state.webuiIntegration = info;
            if (info?.assets) state.assets = info.assets;
            if (info?.module_assets || info?.moduleAssets) {
                state.moduleAssets = info.module_assets || info.moduleAssets;
                renderModuleAssetStatuses();
            }
            rootInput.value = info?.webui_root || rootInput.value || info?.guesses?.[0] || "";
            guessSelect.innerHTML = "";
            guessSelect.append(el("option", { value: "" }, "自动检测到的 WebUI 目录"));
            for (const guess of info?.guesses || []) guessSelect.append(el("option", { value: guess }, guess));
            const ready = webuiExtensionsReady(info, state.assets);
            statusLine.textContent = ready ? `${webuiStatusText(info)}；配套扩展已存在，直接接入即可` : webuiStatusText(info);
            if (webuiAssetsButton) {
                webuiAssetsButton.__webuiBridgeReady = ready;
                webuiAssetsButton.disabled = dialogBusy || ready;
                webuiAssetsButton.textContent = ready ? "扩展已存在" : "补齐缺失扩展";
                webuiAssetsButton.title = ready ? "Prompt All in One 和 TagComplete 已存在，不需要下载" : "只下载 WebUI 中缺失的配套扩展";
            }
        };
        const connect = async (autoDetect = false) => {
            activeIntegrationController?.abort?.();
            const controller = new AbortController();
            activeIntegrationController = controller;
            const operationId = ++integrationOperationId;
            let root = rootInput.value.trim();
            statusLine.textContent = autoDetect ? "正在自动检测并接入..." : "正在接入 WebUI...";
            setDialogBusy(true, autoDetect ? autoDetectButton : connectButton);
            const isStale = () => controller.signal.aborted || operationId !== integrationOperationId;
            try {
                if (autoDetect && !root) {
                    const latest = await fetchWebUIIntegration({ signal: controller.signal });
                    if (isStale()) return;
                    renderInfo(latest);
                    root = rootInput.value.trim() || latest?.guesses?.[0] || "";
                    if (!root) {
                        statusLine.textContent = "没有自动检测到 WebUI 目录，请把 WebUI 根目录粘贴到上面的输入框。";
                        return;
                    }
                }
                const info = await connectWebUIRoot(root, autoDetect, { signal: controller.signal });
                if (isStale()) return;
                renderInfo(info);
                const data = await refreshBridgeData({
                    loraDetail: "basic",
                    loraTimeoutMs: 8000,
                    refreshTimeoutMs: WEBUI_REFRESH_TIMEOUT_MS,
                    signal: controller.signal,
                });
                if (isStale()) return;
                setStatus(`已接入 WebUI：${info.webui_root}`, { kind: "success" });
                statusLine.textContent = data.lorasLoaded
                    ? `${webuiStatusText(info)}；已刷新提示词、样式、LoRA 和模型列表`
                    : `${webuiStatusText(info)}；已刷新提示词、样式和模型列表，LoRA 扫描较慢，已保留原列表`;
            } catch (error) {
                if (isStale()) return;
                statusLine.textContent = `接入失败: ${error?.message || error}`;
            } finally {
                if (operationId === integrationOperationId) {
                    activeIntegrationController = null;
                    setDialogBusy(false);
                }
            }
        };
        const installWebUIAssets = async () => {
            activeIntegrationController?.abort?.();
            const controller = new AbortController();
            activeIntegrationController = controller;
            const operationId = ++integrationOperationId;
            let root = rootInput.value.trim();
            statusLine.textContent = "正在检测 WebUI 配套扩展...";
            setDialogBusy(true, webuiAssetsButton);
            const isStale = () => controller.signal.aborted || operationId !== integrationOperationId;
            try {
                if (!root) {
                    const latest = await fetchWebUIIntegration({ signal: controller.signal });
                    if (isStale()) return;
                    renderInfo(latest);
                    root = rootInput.value.trim() || latest?.guesses?.[0] || "";
                }
                if (!root) {
                    statusLine.textContent = "没有 WebUI 根目录；没有 WebUI 的用户请在设置里点“下载本地数据包”。已有 WebUI 和扩展的用户直接接入即可。";
                    return;
                }
                const result = await installBridgeAssets("webui", root);
                if (isStale()) return;
                if (result.webui_root) rootInput.value = result.webui_root;
                state.settings = normalizeBridgeSettings(result.settings);
                state.customTagCount = result.custom_tag_count || state.customTagCount;
                const latestInfo = await fetchWebUIIntegration({ signal: controller.signal });
                if (isStale()) return;
                renderInfo(latestInfo);
                await refreshBridgeData({ signal: controller.signal });
                if (isStale()) return;
                statusLine.textContent = `${assetInstallMessage(result)}；已存在的扩展不会重复下载`;
                setStatus("WebUI 配套扩展检查完成", { kind: "success" });
            } catch (error) {
                if (isStale()) return;
                statusLine.textContent = `安装失败: ${error?.message || error}`;
            } finally {
                if (operationId === integrationOperationId) {
                    activeIntegrationController = null;
                    setDialogBusy(false);
                }
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
                autoDetectButton = el("button", { type: "button", onclick: () => connect(true) }, "自动检测"),
                webuiAssetsButton = el("button", { type: "button", onclick: installWebUIAssets }, "补齐缺失扩展"),
                connectButton = el("button", { type: "button", class: "primary", onclick: () => connect(false) }, "接入并刷新"),
            ]),
        ]));
        document.body.append(mask);
        const initialOperationId = integrationOperationId;
        try {
            const initialInfo = await fetchWebUIIntegration();
            if (initialOperationId === integrationOperationId && !dialogBusy) {
                renderInfo(initialInfo);
            }
        } catch (error) {
            if (initialOperationId === integrationOperationId && !dialogBusy) {
                statusLine.textContent = error?.message || "读取配置失败，请粘贴 WebUI 根目录后重试";
            }
        }
        rootInput.focus();
        rootInput.select();
    };

    let quickLoraOverlayButton = null;
    const setLayoutPresetClass = (preset) => {
        const normalizedPreset = SETTING_CHOICES.layout_preset.includes(preset) ? preset : "default";
        panel?.classList?.remove(
            "layout-default",
            "layout-compact",
            "layout-roomy",
            "layout-positive-focus",
            "layout-minimal-lora",
        );
        panel?.classList?.add(`layout-${normalizedPreset.replaceAll("_", "-")}`);
        return normalizedPreset;
    };
    const applyLayoutPreset = (preset, options = {}) => {
        const normalizedPreset = setLayoutPresetClass(preset);
        const preserveNodeSize = Boolean(options.preserveNodeSize);
        if (!preserveNodeSize && node.__webuiBridgeFreshNode && !node.__webuiBridgeWasConfigured) {
            node.__webuiBridgeFreshLayoutReleased = true;
        }
        const preserveFreshHeights = preserveNodeSize &&
            node.__webuiBridgeFreshNode &&
            !node.__webuiBridgeWasConfigured &&
            node.__webuiBridgeFreshInitialLayoutSeeded;
        const clearLayoutPresetOverrides = () => {
            for (const key of [
                topRowHeightKey,
                extraHeightKey,
                positive.textarea?.__webuiBridgeHeightKey,
                positive.row?.chips?.__webuiBridgeHeightKey,
                positiveTagPanel?.__webuiBridgeHeightKey,
                negative.textarea?.__webuiBridgeHeightKey,
                negative.row?.chips?.__webuiBridgeHeightKey,
                negativeTagPanel?.__webuiBridgeHeightKey,
            ]) {
                if (key) clearLocalValue(key);
            }
        };
        clearLayoutPresetOverrides();
        promptLoraSplitManual = false;
        promptInnerSplitManual = false;
        if (quickLoraOverlayButton) {
            quickLoraOverlayButton.style.display = normalizedPreset === "minimal_lora" ? "none" : "";
        }
        const collapseNegative = (collapsed) => {
            if (typeof negative.row.__webuiBridgeSetCollapsed === "function") {
                negative.row.__webuiBridgeSetCollapsed(collapsed, false);
                return;
            }
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
                    extraSection.style.flex = "0 0 auto";
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
        const fitNodeToVisibleContent = (width, minimumHeight) => {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (nodeHasSavedUserBridgePanelSize(node) || bridgeConfiguredSizeLockActive(node)) return;
                const splitter = panel?.querySelector?.(".webui-bridge-panel-splitter");
                const panelStyle = panel ? getComputedStyle(panel) : null;
                const paddingY = panelStyle ? (Number.parseFloat(panelStyle.paddingTop) || 0) + (Number.parseFloat(panelStyle.paddingBottom) || 0) : 0;
                const rowGap = panelStyle ? Number.parseFloat(panelStyle.rowGap || panelStyle.gap) || 0 : 0;
                const visibleBlocks = [topControls, topRow, splitter, extraSection].filter((item) => item && !resizeTargetHidden(item));
                const contentHeight = visibleBlocks.reduce((sum, item) => sum + resizeTargetLayoutHeight(item), paddingY + rowGap * Math.max(0, visibleBlocks.length - 1));
                const nextHeight = Math.max(minimumHeight || PANEL_MIN_HEIGHT, Math.ceil(contentHeight + DOM_WIDGET_LAYOUT_PAD));
                setNodeSize(width, nextHeight, { remember: false });
            }));
        };
        const fitLoraToCardRows = (rows = 1) => {
            requestAnimationFrame(() => requestAnimationFrame(() => {
                if (extraCollapsed || !extraSection?.isConnected) return;
                const extraRect = extraSection.getBoundingClientRect();
                const headHeight = extraSection.querySelector(".webui-bridge-extra-head")?.offsetHeight || 44;
                const grid = extraSection.querySelector(".webui-bridge-card-grid");
                const gridStyle = grid ? getComputedStyle(grid) : null;
                const firstCard = grid?.querySelector(".webui-bridge-card, .webui-bridge-empty");
                const scale = extraRect.height && extraSection.offsetHeight ? extraRect.height / extraSection.offsetHeight : 1;
                const cardRect = firstCard?.getBoundingClientRect?.();
                const visibleCardHeight = cardRect?.height && scale ? cardRect.height / scale : 0;
                const cardHeight = visibleCardHeight || firstCard?.offsetHeight || Number.parseFloat(gridStyle?.gridAutoRows) || 142;
                const rowGap = Number.parseFloat(gridStyle?.rowGap || gridStyle?.gap) || 8;
                const paddingY = gridStyle ? (Number.parseFloat(gridStyle.paddingTop) || 0) + (Number.parseFloat(gridStyle.paddingBottom) || 0) : 16;
                const borderY = 4;
                const nextHeight = Math.ceil(headHeight + paddingY + cardHeight * rows + rowGap * Math.max(0, rows - 1) + borderY);
                const panelHeight = panel ? resizeTargetLayoutHeight(panel) : 0;
                const splitter = panel?.querySelector?.(".webui-bridge-panel-splitter");
                const splitterHeight = splitter && !resizeTargetHidden(splitter) ? resizeTargetLayoutHeight(splitter) : 0;
                let availableExtraHeight = nextHeight;
                if (panelHeight) {
                    const viewportScale = resizeTargetViewportScale(panel) || 1;
                    const panelRect = panel.getBoundingClientRect();
                    const topRect = topRow.getBoundingClientRect();
                    const splitterRect = splitter?.getBoundingClientRect?.();
                    const extraRectForGap = extraSection.getBoundingClientRect();
                    const paddingTop = Math.max(0, (topRect.top - panelRect.top) / viewportScale) || (Number.parseFloat(getComputedStyle(panel).paddingTop) || 0);
                    const gapBeforeSplitter = splitterRect ? Math.max(0, (splitterRect.top - topRect.bottom) / viewportScale) : 0;
                    const gapBeforeExtra = splitterRect ? Math.max(0, (extraRectForGap.top - splitterRect.bottom) / viewportScale) : 0;
                    availableExtraHeight = panelHeight - paddingTop - resizeTargetLayoutHeight(topRow) - gapBeforeSplitter - splitterHeight - gapBeforeExtra - 12;
                }
                const cappedHeight = Math.min(nextHeight, Math.max(EXTRA_NETWORKS_MIN_HEIGHT, availableExtraHeight || nextHeight));
                setResizeTargetHeight(extraSection, extraHeightKey, Math.max(EXTRA_NETWORKS_CARD_ROW_MIN_HEIGHT, cappedHeight), {
                    min: EXTRA_NETWORKS_CARD_ROW_MIN_HEIGHT,
                    max: extraSection.__webuiBridgeMaxHeight,
                });
                extraSection.style.flex = "0 0 auto";
            }));
        };
        if (normalizedPreset === "compact") {
            if (!preserveNodeSize) setNodeSize(920, 680, { user: true });
            collapseNegative(false);
            extraCollapsed = false;
            writeLocalBoolean(extraCollapsedKey, false);
            applyExtraCollapsedState?.({ preserveExpandedHeight: preserveFreshHeights });
            setPanelHeights({ top: 420, lora: EXTRA_NETWORKS_MIN_HEIGHT, positiveText: 88, positiveTags: 150 });
            if (!preserveNodeSize) fitLoraToCardRows(1);
            if (!preserveNodeSize) fitNodeToVisibleContent(920, 620);
        } else if (normalizedPreset === "roomy") {
            if (!preserveNodeSize) setNodeSize(1380, 1180, { user: true });
            collapseNegative(false);
            extraCollapsed = false;
            writeLocalBoolean(extraCollapsedKey, false);
            applyExtraCollapsedState?.({ preserveExpandedHeight: preserveFreshHeights });
            setPanelHeights({ top: 840, lora: EXTRA_NETWORKS_MIN_HEIGHT, positiveText: 138, positiveTags: 360 });
            if (!preserveNodeSize) fitLoraToCardRows(1);
            if (!preserveNodeSize) fitNodeToVisibleContent(1380, 1080);
        } else if (normalizedPreset === "positive_focus") {
            if (!preserveNodeSize) setNodeSize(1180, 760, { user: true });
            collapseNegative(true);
            extraCollapsed = false;
            writeLocalBoolean(extraCollapsedKey, false);
            applyExtraCollapsedState?.({ preserveExpandedHeight: preserveFreshHeights });
            setPanelHeights({ top: 500, lora: EXTRA_NETWORKS_MIN_HEIGHT, positiveText: 150, positiveTags: 240 });
            if (!preserveNodeSize) fitLoraToCardRows(1);
            if (!preserveNodeSize) fitNodeToVisibleContent(1180, 680);
        } else if (normalizedPreset === "minimal_lora") {
            if (!preserveNodeSize) setNodeSize(940, 560, { user: true });
            collapseNegative(true);
            extraCollapsed = true;
            writeLocalBoolean(extraCollapsedKey, true);
            applyExtraCollapsedState?.({ preserveExpandedHeight: preserveFreshHeights });
            setPanelHeights({ top: 460, positiveText: 130, positiveTags: 220 });
            if (!preserveNodeSize) fitNodeToVisibleContent(940, 500);
        } else {
            if (!preserveNodeSize) setNodeSize(DEFAULT_PANEL_WIDTH, 1060, { user: true });
            collapseNegative(false);
            extraCollapsed = false;
            writeLocalBoolean(extraCollapsedKey, false);
            applyExtraCollapsedState?.({ preserveExpandedHeight: preserveFreshHeights });
            setPanelHeights({ top: 620, lora: preserveNodeSize ? undefined : EXTRA_NETWORKS_MIN_HEIGHT, positiveText: 110, positiveTags: 190 });
            if (!preserveNodeSize) fitLoraToCardRows(2);
            if (!preserveNodeSize) fitNodeToVisibleContent(DEFAULT_PANEL_WIDTH, 980);
        }
        scheduleAdaptiveLayout();
        requestAnimationFrame(() => applyUiVisibility?.());
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
                    item.filter_profile,
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
        const nodeTutorialPopup = settingSelect(current.node_tutorial_popup, [
            { value: "first_time", label: "首次添加时弹出" },
            { value: "always", label: "每次添加都弹出" },
            { value: "off", label: "不自动弹出" },
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
        const visibilityInputs = new Map();
        const makeVisibilityGrid = (items) => el("div", { class: "webui-bridge-visibility-grid" }, items.map(([key, label]) => {
            const input = el("input", { type: "checkbox" });
            input.checked = current.ui_visibility?.[key] !== false;
            visibilityInputs.set(key, input);
            return el("label", { class: "webui-bridge-config-check webui-bridge-visibility-check" }, [
                input,
                el("span", {}, label),
            ]);
        }));
        const setVisibilityPreset = (presetKey) => {
            const preset = UI_VISIBILITY_PRESETS[presetKey] || UI_VISIBILITY_PRESETS.minimal;
            for (const [key, input] of visibilityInputs) input.checked = preset[key] !== false;
        };
        const collectVisibilitySettings = () => {
            const visibility = { ...UI_VISIBILITY_DEFAULTS };
            for (const [key, input] of visibilityInputs) visibility[key] = input.checked;
            return visibility;
        };
        const visibilityMatchesPreset = (presetKey, visibility) => {
            const preset = UI_VISIBILITY_PRESETS[presetKey] || UI_VISIBILITY_PRESETS.minimal;
            return Object.keys(UI_VISIBILITY_DEFAULTS).every((key) => (visibility?.[key] !== false) === (preset[key] !== false));
        };
        const presetButtons = new Map();
        const updatePresetActiveStates = () => {
            const visibility = collectVisibilitySettings();
            for (const [presetKey, button] of presetButtons) {
                button.classList.toggle("active", visibilityMatchesPreset(presetKey, visibility));
            }
        };
        const makePresetButton = (presetKey, title, text) => el("button", {
            type: "button",
            class: `webui-bridge-settings-preset${visibilityMatchesPreset(presetKey, current.ui_visibility) ? " active" : ""}`,
            onclick: () => {
                setVisibilityPreset(presetKey);
                updatePresetActiveStates();
            },
        }, [
            el("b", {}, title),
            el("span", {}, text),
        ]);
        const registerPresetButton = (presetKey, title, text) => {
            const button = makePresetButton(presetKey, title, text);
            presetButtons.set(presetKey, button);
            return button;
        };
        const configSection = (title, subtitle, children) => el("section", { class: "webui-bridge-settings-section" }, [
            el("div", { class: "webui-bridge-settings-section-title" }, [
                el("h3", {}, title),
                subtitle ? el("p", {}, subtitle) : null,
            ].filter(Boolean)),
            ...children,
        ]);
        const statusLine = el("div", { class: "webui-bridge-config-status" }, webuiStatusText(state.webuiIntegration));
        const webuiReady = webuiExtensionsReady(state.webuiIntegration, state.assets);
        const installWebUIButton = el("button", {
            type: "button",
            onclick: () => installWebUIAssetsFromSettings(),
            disabled: webuiReady ? "disabled" : undefined,
            title: webuiReady ? "WebUI 配套扩展已存在，不需要下载" : "只补齐 WebUI 中缺失的配套扩展",
        }, webuiReady ? "扩展已存在" : "补齐 WebUI 扩展");
        const close = () => mask.remove();
        let localAssetsButton = null;
        const setSettingsStatus = (message, kind = "") => {
            statusLine.textContent = message || "";
            statusLine.classList.remove("download-active", "success", "error", "warning");
            if (kind) statusLine.classList.add(kind);
        };
        const setDownloadTargets = (targets, active) => {
            for (const target of targets.filter(Boolean)) {
                target.classList.toggle("downloading", active);
                if ("disabled" in target) target.disabled = active;
            }
        };
        const beginSettingsDownload = (message, targets = []) => {
            setSettingsStatus(message, "warning");
            statusLine.classList.add("download-active");
            setDownloadTargets(targets, true);
        };
        const finishSettingsDownload = (message, kind = "", targets = []) => {
            setSettingsStatus(message, kind);
            setDownloadTargets(targets, false);
        };
        const downloadLocalAssets = async () => {
            beginSettingsDownload("正在下载本地词库，请保持 ComfyUI 运行，不要关闭这个窗口。", [localAssetsButton]);
            try {
                const result = await installBridgeAssets("local");
                state.settings = normalizeBridgeSettings(result.settings);
                state.customTagCount = result.custom_tag_count || state.customTagCount;
                state.assets = result.assets || state.assets;
                dataSource.value = state.settings.data_source;
                translationSource.value = state.settings.translation_source;
                wizardToggle.checked = state.settings.show_startup_wizard;
                await refreshBridgeData();
                finishSettingsDownload(`${assetInstallMessage(result)}；没有 WebUI 也可以直接使用补全和分类`, "success", [localAssetsButton]);
                setStatus("本地数据包已就绪", { kind: "success" });
            } catch (error) {
                finishSettingsDownload(`下载失败: ${error?.message || error}`, "error", [localAssetsButton]);
            }
        };
        const installWebUIAssetsFromSettings = async () => {
            beginSettingsDownload("正在检测并补齐 WebUI 扩展，请等待下载完成。", [installWebUIButton]);
            try {
                const result = await installBridgeAssets("webui", state.webuiIntegration?.webui_root || "");
                state.settings = normalizeBridgeSettings(result.settings);
                state.customTagCount = result.custom_tag_count || state.customTagCount;
                state.assets = result.assets || state.assets;
                await refreshBridgeData();
                finishSettingsDownload(`${assetInstallMessage(result)}；已存在的扩展不会重复下载`, "success", [installWebUIButton]);
                installWebUIButton.disabled = true;
                installWebUIButton.textContent = "扩展已存在";
                setStatus("WebUI 扩展检查完成", { kind: "success" });
            } catch (error) {
                finishSettingsDownload(`检查失败: ${error?.message || error}。没有 WebUI 时请点“下载本地数据包”。`, "error", [installWebUIButton]);
            }
        };
        const moduleAssetCatalog = [
            ["impact_pack", "Impact Pack", "ADetailer、局部重绘、FaceDetailer 等核心修复节点。", "ultralytics"],
            ["impact_subpack", "Impact Subpack", "YOLO/Ultralytics 检测器，修脸修手通常需要它。", "ultralytics"],
            ["controlnet_aux", "ControlNet Aux", "Canny、Depth、OpenPose、Lineart 等预处理器。", "controlnet"],
            ["segment_anything", "Segment Anything", "SAM 分割与 Inpaint 相关节点。", "sams"],
            ["ultimate_upscale", "Ultimate SD Upscale", "分块放大修复和 Ultimate 放大流程。", "upscale_models"],
        ];
        const settingsAssetCard = (assetKey, title, description, modelKey = "") => {
            const status = el("span", { class: "webui-bridge-settings-asset-status" }, "正在读取状态");
            const button = el("button", {
                type: "button",
                onclick: async () => {
                    button.disabled = true;
                    const oldText = button.textContent;
                    button.textContent = "下载中...";
                    beginSettingsDownload(`正在下载 ${title}，新节点包下载完成后通常需要重启 ComfyUI。`, [button, card]);
                    try {
                        const result = await installModuleAssets([assetKey]);
                        state.moduleAssets = result.module_assets || state.moduleAssets;
                        renderModuleAssetStatuses();
                        const installed = (result.results || []).filter((item) => item.status === "installed").map((item) => item.label || item.id);
                        const existed = (result.results || []).filter((item) => item.status === "exists").map((item) => item.label || item.id);
                        finishSettingsDownload([
                            installed.length ? `已下载 ${installed.join("、")}` : "",
                            existed.length ? `已存在 ${existed.join("、")}` : "",
                            result.restart_required ? "重启 ComfyUI 后生效" : "",
                        ].filter(Boolean).join("；") || `${title} 已检查`, "success", [button, card]);
                        setStatus(statusLine.textContent, { kind: "success", sticky: Boolean(result.restart_required) });
                    } catch (error) {
                        finishSettingsDownload(`${title} 下载失败: ${error?.message || error}`, "error", [button, card]);
                        setStatus(statusLine.textContent, { kind: "error", sticky: true });
                    } finally {
                        button.disabled = false;
                        button.textContent = oldText;
                        button.classList.remove("downloading");
                        card.classList.remove("downloading");
                    }
                },
            }, "下载 / 检查");
            const card = el("div", { class: "webui-bridge-settings-asset-card" }, [
                el("div", {}, [
                    el("b", {}, title),
                    el("p", {}, description),
                    status,
                ]),
                button,
            ]);
            card.__webuiBridgeRender = () => {
                const assets = state.moduleAssets || {};
                const pkg = assets.node_packages?.[assetKey];
                const model = modelKey ? assets.models?.[modelKey] : null;
                const bits = [];
                bits.push(pkg ? (pkg.installed ? "节点包已安装" : "节点包未安装") : "状态未刷新");
                if (model) bits.push(`${model.count || 0} 个相关模型`);
                status.textContent = bits.join("；");
                button.textContent = pkg?.installed ? "重新检查" : "下载";
            };
            card.__webuiBridgeRender();
            return card;
        };
        localAssetsButton = el("button", { type: "button", onclick: downloadLocalAssets }, "下载本地词库");
        const refreshSettingsAssets = async () => {
            setSettingsStatus("正在刷新扩展状态...");
            try {
                state.moduleAssets = await fetchModuleAssets();
                renderModuleAssetStatuses();
                setSettingsStatus("扩展状态已刷新", "success");
            } catch (error) {
                setSettingsStatus(`刷新失败: ${error?.message || error}`, "error");
            }
        };
        const save = async () => {
            setSettingsStatus("正在保存...");
            try {
                const result = await saveBridgeSettings({
                    data_source: dataSource.value,
                    translation_source: translationSource.value,
                    tag_translation_source: tagTranslationSource.value,
                    layout_preset: layoutPreset.value,
                    tag_display: tagDisplay.value,
                    lora_card_size: loraCardSize.value,
                    node_tutorial_popup: nodeTutorialPopup.value,
                    show_startup_wizard: wizardToggle.checked,
                    ui_visibility: collectVisibilitySettings(),
                });
                state.settings = normalizeBridgeSettings(result.settings);
                state.customTagCount = result.custom_tag_count || state.customTagCount;
                writeLocalNumber("webui-bridge-font-size", Number(fontSizeInput.value || DEFAULT_FONT_SIZE));
                applyPanelFontSize(panel);
                await refreshBridgeData();
                applyLayoutPreset(state.settings.layout_preset);
                applyUiVisibility();
                setStatus("设置已保存", { kind: "success" });
                close();
            } catch (error) {
                setSettingsStatus(`保存失败: ${error?.message || error}`, "error");
            }
        };
        mask.addEventListener("mousedown", (event) => {
            if (event.target === mask) close();
        });
        mask.append(el("div", { class: "webui-bridge-config-panel webui-bridge-settings-panel" }, [
            el("div", { class: "webui-bridge-config-head" }, [
                el("div", { class: "webui-bridge-settings-title" }, [
                    el("span", {}, "WebUI Prompt Bridge 设置"),
                    el("small", {}, "默认侧栏保持清爽；区域、样式和重型扩展都可按需打开。"),
                ]),
                el("button", { type: "button", onclick: close }, "×"),
            ]),
            el("div", { class: "webui-bridge-config-body" }, [
                el("div", { class: "webui-bridge-settings-hero" }, [
                    el("div", {}, [
                        el("b", {}, "快速开始"),
                        el("span", {}, "首次安装默认使用起步模式：保留基础生成、默认布局和 LoRA 浏览；推荐模式展开常用区域和 Styles；全部模式只显示面板，不会启用扩展执行。"),
                    ]),
                    el("div", { class: "webui-bridge-settings-preset-row" }, [
                        registerPresetButton("minimal", "起步", "首次安装默认"),
                        registerPresetButton("recommended", "推荐", "常用功能展开"),
                        registerPresetButton("all", "全部", "显示所有面板"),
                    ]),
                ]),
                el("div", { class: "webui-bridge-settings-grid" }, [
                    configSection("数据 / 翻译", "选择词库和中文解释来源。", [
                        el("label", {}, [el("span", {}, "数据来源"), dataSource]),
                        el("label", {}, [el("span", {}, "翻译来源"), translationSource]),
                        el("label", {}, [el("span", {}, "补全中文解释"), tagTranslationSource]),
                    ]),
                    configSection("布局 / 显示", "调节点内部密度，不影响工作流执行。", [
                        el("label", {}, [el("span", {}, "布局尺寸"), layoutPreset]),
                        el("label", {}, [el("span", {}, "Tag 显示"), tagDisplay]),
                        el("label", {}, [el("span", {}, "LoRA 卡片"), loraCardSize]),
                        el("label", {}, [el("span", {}, "字体大小"), fontSizeInput]),
                        el("label", { class: "webui-bridge-config-check" }, [
                            wizardToggle,
                            el("span", {}, "首次向导"),
                        ]),
                    ]),
                    configSection("教程提示", "控制新建 WebUI Prompt Bridge 主节点时是否自动弹出完整教程。", [
                        el("label", {}, [el("span", {}, "新建节点教程"), nodeTutorialPopup]),
                        el("div", { class: "webui-bridge-settings-asset-tools" }, [
                            el("button", { type: "button", onclick: showBridgeTutorialDialog }, "查看完整教程"),
                            el("button", {
                                type: "button",
                                onclick: () => {
                                    clearLocalValue(NODE_TUTORIAL_SEEN_KEY);
                                    setSettingsStatus("已重置首次教程记录；下次新建节点会再次弹出。", "success");
                                },
                            }, "重置首次提示"),
                        ]),
                    ]),
                ]),
                configSection("侧栏功能显示", "隐藏只影响面板，不删除已有 widget 值，也不会改变工作流执行。", [
                    makeVisibilityGrid(SIDEBAR_VISIBILITY_OPTIONS),
                ]),
                configSection("主节点内置功能显示", "这些功能直接由 WebUI Prompt Bridge 主节点处理，不需要额外增加模块节点。", [
                    makeVisibilityGrid(MAIN_MODULE_VISIBILITY_OPTIONS),
                ]),
                configSection("高级扩展模块显示", "这里只控制面板是否显示；真正启用执行要打开各模块标题里的复选框。", [
                    makeVisibilityGrid(ADVANCED_MODULE_VISIBILITY_OPTIONS),
                ]),
                configSection("扩展与资源下载", "按需逐项下载。已存在的项目会跳过；新节点包通常需要重启 ComfyUI 后生效。", [
                    el("div", { class: "webui-bridge-settings-asset-tools" }, [
                        el("button", { type: "button", onclick: refreshSettingsAssets }, "刷新状态"),
                        localAssetsButton,
                        installWebUIButton,
                    ]),
                    el("div", { class: "webui-bridge-settings-assets" }, moduleAssetCatalog.map((item) => settingsAssetCard(...item))),
                ]),
                statusLine,
            ]),
            el("div", { class: "webui-bridge-config-actions" }, [
                el("button", { type: "button", onclick: showPromptMarketDialog }, "市场"),
                el("button", { type: "button", onclick: () => showImportTagsDialog({ mode: "editor" }) }, "编辑词库"),
                el("button", { type: "button", onclick: showAIConfigDialog }, "AI"),
                el("button", { type: "button", onclick: showWebUIIntegrationDialog }, "WebUI"),
                el("button", { type: "button", onclick: close }, "取消"),
                el("button", { type: "button", class: "primary", onclick: save }, "保存"),
            ]),
        ]));
        document.body.append(mask);
        refreshSettingsAssets();
    };

    const showBridgeTutorialDialog = (options = {}) => {
        const mask = el("div", { class: "webui-bridge-config-mask" });
        const close = () => mask.remove();
        const tutorialCard = (title, badge, lines) => el("section", {}, [
            el("div", { class: "webui-bridge-tutorial-card-head" }, [
                el("h3", {}, title),
                badge ? el("span", {}, badge) : null,
            ].filter(Boolean)),
            el("ul", {}, lines.map((line) => el("li", {}, line))),
        ]);
        const tutorialFlow = (items) => el("div", { class: "webui-bridge-tutorial-flow" }, items.map((item, index) => [
            index ? el("span", { class: "webui-bridge-tutorial-arrow" }, "→") : null,
            el("b", {}, item),
        ]).flat().filter(Boolean));
        mask.addEventListener("mousedown", (event) => {
            if (event.target === mask) close();
        });
        mask.append(el("div", { class: "webui-bridge-config-panel webui-bridge-tutorial-panel" }, [
            el("div", { class: "webui-bridge-config-head" }, [
                el("span", {}, options.auto ? "首次使用教程" : "WebUI Prompt Bridge 完整教程"),
                el("button", { type: "button", onclick: close }, "×"),
            ]),
            el("div", { class: "webui-bridge-config-body" }, [
                el("div", { class: "webui-bridge-tutorial-hero" }, [
                    el("b", {}, "先连线，再在节点里完成提示词、LoRA、图生图和局部重绘。"),
                    el("span", {}, "这个节点的目标是把常用 WebUI 工作流收进一个侧栏；隐藏侧栏后接口会露出来，适合继续连 ComfyUI 节点。"),
                    tutorialFlow(["WebUI Bridge", "正/负提示词", "LoRA / 模块", "KSampler / 后处理"]),
                ]),
                el("div", { class: "webui-bridge-tutorial-grid" }, [
                    tutorialCard("1. 主链路怎么接", "必看", [
                        "model、clip 输出接后面的 KSampler / CLIP 文本编码链路。",
                        "positive、negative 是已经编码好的提示词；positive_text、negative_text 是纯文本，方便接其他节点。",
                        "缺 LoRA 停止、CLIP 强度、模型切换都在顶部或侧栏里控制。",
                    ]),
                    tutorialCard("2. 提示词与标签", "常用", [
                        "左侧写正向和反向提示词，标签区可以搜索、点击、导入和整理。",
                        "Styles、Prompt 工具、翻译来源可以在设置里打开或切换。",
                        "分隔条可上下拖动，双击恢复默认高度。",
                    ]),
                    tutorialCard("3. LoRA 浏览", "常用", [
                        "接入 WebUI 或下载本地词库后，LoRA 卡片会显示名称、触发词和强度入口。",
                        "点卡片会写入提示词，强度会同步到 LoRA 标签。",
                        "如果模型/LoRA 缺失，可在设置里检查资源状态。",
                    ]),
                    tutorialCard("4. 图生图 / 局部重绘", "新功能", [
                        "先在设置里显示“图生图 / 局部重绘”，再在侧栏上传原图。",
                        "局部重绘要点“涂抹编辑”，红色区域就是 mask。",
                        "只上传图片不会自动影响 KSampler；请点“一键接入图生图链路”。",
                    ]),
                    tutorialCard("5. 图生图正确链路", "关键", [
                        "普通图生图：Bridge image → VAE Encode → KSampler latent_image。",
                        "局部重绘：Bridge image + mask → VAE Encode For Inpaint → KSampler latent_image。",
                        "denoise 越低越保留原图，越高变化越大；脸部小修通常 0.35-0.65 起步。",
                    ]),
                    tutorialCard("6. Mask / ControlNet / 修复模块", "高级", [
                        "高级模块默认隐藏；在设置里勾选后会出现在侧栏。",
                        "ControlNet、ADetailer、SAM、放大修复需要对应节点包和模型。",
                        "设置里的“下载 / 检查”会高亮显示下载状态，下载节点包后通常要重启 ComfyUI。",
                    ]),
                    tutorialCard("7. 布局与显示", "舒服点", [
                        "顶部“侧栏”按钮可隐藏面板露出接口，适合连线。",
                        "布局预设能快速切换紧凑、宽松、正向聚焦等模式。",
                        "右下角蓝色箭头可整体缩放节点。",
                    ]),
                    tutorialCard("8. 教程弹出设置", "可控", [
                        "第一次新建主节点会弹出这份教程；再次新建默认不弹。",
                        "在“设置 → 教程提示”里可改为每次弹出或不自动弹出。",
                        "也可以随时点顶部“教程”或设置里的“查看完整教程”。",
                    ]),
                ]),
                el("div", { class: "webui-bridge-config-note" }, "图生图最常见的问题：图片已经上传但 KSampler 仍在空 latent 上生成。看到这种情况，先检查 KSampler 的 latent_image 是否已经被 VAE Encode 或 VAE Encode For Inpaint 接管。"),
            ]),
            el("div", { class: "webui-bridge-config-actions" }, [
                el("button", {
                    type: "button",
                    onclick: () => {
                        close();
                        showBridgeSettingsDialog();
                    },
                }, "打开设置"),
                el("button", { type: "button", class: "primary", onclick: close }, "知道了"),
            ]),
        ]));
        document.body.append(mask);
    };

    const hasSeenNodeTutorial = () => {
        try {
            return localStorage.getItem(NODE_TUTORIAL_SEEN_KEY) === "1";
        } catch {
            return false;
        }
    };

    const rememberNodeTutorialSeen = () => {
        writeLocalString(NODE_TUTORIAL_SEEN_KEY, "1");
    };

    const maybeShowNodeTutorial = () => {
        if (!node.__webuiBridgeFreshNode || node.__webuiBridgeWasConfigured) return false;
        if (node.__webuiBridgeNodeTutorialHandled) return false;
        const mode = normalizeBridgeSettings(state.settings).node_tutorial_popup;
        if (mode === "off") return false;
        if (mode === "first_time" && hasSeenNodeTutorial()) return false;
        node.__webuiBridgeNodeTutorialHandled = true;
        if (mode === "first_time") rememberNodeTutorialSeen();
        window.setTimeout(() => showBridgeTutorialDialog({ auto: true }), 280);
        return true;
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
        const current = currentCheckpointName();
        const split = isSplitModelMode();
        BRIDGE_DEBUG.models = state.models;
        BRIDGE_DEBUG.currentCheckpoint = current;
        BRIDGE_DEBUG.splitModelMode = split;
        const checkpoints = collectCheckpointOptions(state.models);
        const availableCheckpoints = availableCheckpointLookupKeys(state.models);
        const syncTarget = current && checkpointLookupHas(availableCheckpoints, current)
            ? current
            : checkpoints[0];
        const autoSyncedMissing = syncTarget
            ? syncMissingCheckpointLoadersToModel(syncTarget, { models: state.models })
            : 0;
        if (autoSyncedMissing) {
            scheduleMissingModelRefresh("renderModelSwitch");
            setStatus(`已自动同步 ${autoSyncedMissing} 个缺失 CheckpointLoader 到可用模型`);
        }
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
            : applyCheckpointModel(modelSelect.value, state.models);
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
    const selectStyleOptions = (names = []) => {
        const selected = new Set(names);
        for (const option of styleSelect.options) option.selected = selected.has(option.value);
    };
    const selectedStyleNames = () => [...styleSelect.selectedOptions].map((option) => option.value);
    const selectedStyle = () => {
        const name = styleName.value.trim() || styleSelect.selectedOptions[0]?.value || "";
        return state.styles.find((style) => style.name === name) || null;
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
                title: loraTreeNodeTitle(node, isRoot),
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

    let scheduleAdaptiveLayout = () => {};
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
            scheduleAdaptiveLayout();
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
        scheduleAdaptiveLayout();
    };

    const applyStyles = () => {
        const selected = selectedStyleNames();
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

    const materializeSelectedStyles = () => {
        const selected = selectedStyleNames();
        if (!selected.length) {
            setStatus("请选择要套用的起手式", { kind: "error" });
            return;
        }
        applyStyles();
        setStatus(`已套用 ${selected.length} 个起手式`, { kind: "success" });
    };

    const extractAppliedStyles = () => {
        const result = extractStylesFromPrompts(state.styles, positive.textarea.value, negative.textarea.value);
        if (!result.styles.length) {
            setStatus("没有从当前 prompt 中识别到已套用的起手式", { kind: "error" });
            return;
        }
        positive.textarea.value = result.prompt;
        negative.textarea.value = result.negative_prompt;
        selectStyleOptions(result.styles);
        styleName.value = result.styles[0] || "";
        sync();
        renderPromptPanels();
        setStatus(`已提取起手式: ${result.styles.join(", ")}`, { kind: "success", duration: 8000 });
    };

    const showStyleEditorDialog = () => {
        const mask = el("div", { class: "webui-bridge-config-mask" });
        const listId = `webui-bridge-style-list-${Math.random().toString(36).slice(2)}`;
        const selection = el("input", {
            class: "webui-bridge-config-input",
            list: listId,
            placeholder: "选择或输入新起手式名称",
        });
        selection.value = styleName.value.trim() || styleSelect.selectedOptions[0]?.value || "";
        const datalist = el("datalist", { id: listId });
        const promptInput = el("textarea", {
            class: "webui-bridge-style-dialog-textarea",
            rows: "5",
            placeholder: "正向起手式，可使用 {prompt}",
        });
        const negativeInput = el("textarea", {
            class: "webui-bridge-style-dialog-textarea",
            rows: "5",
            placeholder: "反向起手式，可使用 {prompt}",
        });
        const statusLine = el("div", { class: "webui-bridge-config-status" }, "起手式会写入 WebUI styles.csv；{prompt} 会在套用时替换为当前 prompt。");
        const refreshList = () => {
            datalist.innerHTML = "";
            for (const style of state.styles) datalist.append(el("option", { value: style.name }));
        };
        const fill = (name = selection.value.trim()) => {
            const style = state.styles.find((item) => item.name === name);
            promptInput.value = style?.prompt || "";
            negativeInput.value = style?.negative_prompt || "";
            statusLine.textContent = style ? `正在编辑: ${style.name}` : "新建起手式";
        };
        const close = () => mask.remove();
        const save = async () => {
            const name = selection.value.trim();
            if (!name) {
                statusLine.textContent = "请先填写起手式名称";
                return;
            }
            try {
                state.styles = await updateStyle("save", name, promptInput.value, negativeInput.value);
                renderStyles();
                selectStyleOptions([name]);
                styleName.value = name;
                refreshList();
                statusLine.textContent = `已保存: ${name}`;
                setStatus(`已保存起手式: ${name}`, { kind: "success" });
            } catch (error) {
                statusLine.textContent = `保存失败: ${error?.message || error}`;
            }
        };
        const remove = async () => {
            const name = selection.value.trim();
            if (!name) {
                statusLine.textContent = "请选择要删除的起手式";
                return;
            }
            if (!confirm(`Delete style "${name}"?`)) return;
            try {
                state.styles = await updateStyle("delete", name);
                renderStyles();
                selection.value = "";
                styleName.value = "";
                promptInput.value = "";
                negativeInput.value = "";
                refreshList();
                statusLine.textContent = `已删除: ${name}`;
                setStatus(`已删除起手式: ${name}`);
            } catch (error) {
                statusLine.textContent = `删除失败: ${error?.message || error}`;
            }
        };
        const copyCurrent = () => {
            promptInput.value = positive.textarea.value;
            negativeInput.value = negative.textarea.value;
            statusLine.textContent = "已复制当前正向/反向 prompt 到编辑器";
        };
        const applyEdited = () => {
            positive.textarea.value = applyStyleText(positive.textarea.value, promptInput.value);
            negative.textarea.value = applyStyleText(negative.textarea.value, negativeInput.value);
            sync();
            renderPromptPanels();
            statusLine.textContent = "已把编辑器里的起手式套用到当前 prompt";
        };
        const materializeAndClose = () => {
            materializeSelectedStyles();
            close();
        };
        selection.addEventListener("change", () => fill());
        selection.addEventListener("input", () => {
            const style = state.styles.find((item) => item.name === selection.value.trim());
            if (style) fill(style.name);
        });
        mask.addEventListener("mousedown", (event) => {
            if (event.target === mask) close();
        });
        refreshList();
        fill();
        mask.append(el("div", { class: "webui-bridge-config-panel webui-bridge-style-dialog" }, [
            el("div", { class: "webui-bridge-config-head" }, [
                el("span", {}, "起手式编辑"),
                el("button", { type: "button", onclick: close }, "×"),
            ]),
            el("div", { class: "webui-bridge-config-body" }, [
                datalist,
                el("label", {}, [el("span", {}, "名称"), selection]),
                el("label", {}, [el("span", {}, "正向 Prompt"), promptInput]),
                el("label", {}, [el("span", {}, "Negative prompt"), negativeInput]),
                statusLine,
            ]),
            el("div", { class: "webui-bridge-config-actions" }, [
                el("button", { type: "button", onclick: copyCurrent }, "复制当前"),
                el("button", { type: "button", onclick: applyEdited }, "套用编辑器"),
                el("button", { type: "button", onclick: materializeAndClose }, "套用选中"),
                el("button", { type: "button", onclick: extractAppliedStyles }, "提取起手式"),
                el("button", { type: "button", onclick: remove }, "删除"),
                el("button", { type: "button", class: "primary", onclick: save }, "保存"),
            ]),
        ]));
        document.body.append(mask);
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
        if (regionalEnabledInput.checked) {
            const promptRegions = regionalPromptRegionCount(positiveText, regionalBaseInput.checked, regionalCommonInput.checked);
            const ratioRegions = countRegionalCells(regionalRatiosInput.value, regionalSplitSelect.value);
            const negativeRegions = parseRegionalPromptParts(negativeText).length;
            if (promptRegions > 0 && ratioRegions !== promptRegions) {
                setStatus(`区域配置不匹配：Prompt 有 ${promptRegions} 个区域，但比例生成 ${ratioRegions} 个区域。请调整 BREAK 或比例。`, { kind: "error", sticky: true });
                renderRegionalPreview();
                return;
            }
            if (negativeRegions > 1 && negativeRegions !== promptRegions) {
                setStatus(`区域反向词不匹配：Negative prompt 有 ${negativeRegions} 个区域，正向区域是 ${promptRegions} 个。`, { kind: "error", sticky: true });
                renderRegionalPreview();
                return;
            }
        }
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

    let syncNodeSizeInputs = () => {};
    const setNodeSize = (width, height, options = {}) => {
        const [nextWidth, nextHeight] = clampPanelSize(width, height);
        const rememberSize = options.remember !== false;
        const userSize = Boolean(options.user);
        if (userSize) {
            node.__webuiBridgeUserSized = true;
            node.__webuiBridgeFreshLayoutReleased = true;
            node.__webuiBridgeFreshLayoutStabilizeUntil = 0;
        }
        if (rememberSize) {
            node.__webuiBridgeSavedPanelSize = [nextWidth, nextHeight];
        }
        const currentWidth = Math.round(Number(node.size?.[0] || 0));
        const currentHeight = Math.round(Number(node.size?.[1] || 0));
        const desiredWidth = Math.round(Number(node.__webuiBridgeDesiredSize?.[0] || 0));
        const desiredHeight = Math.round(Number(node.__webuiBridgeDesiredSize?.[1] || 0));
        if (currentWidth === nextWidth && currentHeight === nextHeight &&
            desiredWidth === nextWidth && desiredHeight === nextHeight) {
            node.__webuiBridgeApplyDomWidgetSize?.(nextWidth, nextHeight);
            syncNodeSizeInputs();
            window.requestAnimationFrame?.(() => panel?.__webuiBridgeScheduleAdaptiveLayout?.());
            return;
        }
        node.__webuiBridgeDesiredSize = [nextWidth, nextHeight];
        node.__webuiBridgeManagedSetSize = true;
        node.__webuiBridgeRememberNextSetSize = rememberSize;
        node.__webuiBridgeSetSizeIsUser = userSize;
        try {
            node.size = [nextWidth, nextHeight];
            node.setSize([nextWidth, nextHeight]);
            if (Math.round(Number(node.size?.[0] || 0)) !== nextWidth ||
                Math.round(Number(node.size?.[1] || 0)) !== nextHeight) {
                node.size = [nextWidth, nextHeight];
            }
        } finally {
            node.__webuiBridgeManagedSetSize = false;
            node.__webuiBridgeRememberNextSetSize = false;
            node.__webuiBridgeSetSizeIsUser = false;
        }
        syncNodeSizeInputs();
        app.graph?.setDirtyCanvas(true, true);
    };

    let resizeExtraWithNode = () => {};
    let resizePanelSectionsWithNode = () => {};
    let settleManualResizeLayout = () => {};
    let suppressNodeBottomFitUntil = 0;
    let suppressPanelAutoFitUntil = 0;
    let suppressPromptSplitFitUntil = 0;
    let suppressPromptInnerFitUntil = 0;
    let manualNodeResizeActive = false;
    let promptLoraSplitManual = false;
    let promptInnerSplitManual = false;
    let manualResizeSettleTimer = 0;
    let bottomFitReleaseTimer = 0;
    const freshInitialLayoutStabilizing = () => node.__webuiBridgeFreshNode &&
        !node.__webuiBridgeWasConfigured &&
        !node.__webuiBridgeUserSized &&
        (performance?.now?.() || Date.now()) < (node.__webuiBridgeFreshLayoutStabilizeUntil || 0);
    const freshInitialLayoutPending = () => node.__webuiBridgeFreshNode &&
        !node.__webuiBridgeWasConfigured &&
        !node.__webuiBridgeUserSized &&
        !node.__webuiBridgeFreshLayoutApplied;
    const releaseFreshInitialLayout = () => {
        if (node.__webuiBridgeFreshNode && !node.__webuiBridgeWasConfigured) {
            node.__webuiBridgeFreshLayoutReleased = true;
            node.__webuiBridgeFreshLayoutStabilizeUntil = 0;
        }
    };
    const nodeSizeAutoFitLocked = () => manualNodeResizeActive ||
        freshInitialLayoutStabilizing() ||
        (performance?.now?.() || Date.now()) < suppressPanelAutoFitUntil ||
        nodeHasSavedUserBridgePanelSize(node) ||
        bridgeConfiguredSizeLockActive(node);
    const sectionAutoFitSuspended = () => manualNodeResizeActive ||
        freshInitialLayoutStabilizing() ||
        (performance?.now?.() || Date.now()) < suppressPanelAutoFitUntil;
    const layoutSuppressionUntil = () => Math.max(suppressNodeBottomFitUntil, suppressPanelAutoFitUntil);
    const schedulePostSuppressionAdaptiveLayout = () => {
        window.clearTimeout?.(bottomFitReleaseTimer);
        const now = performance?.now?.() || Date.now();
        const delay = Math.max(80, layoutSuppressionUntil() - now + 80);
        bottomFitReleaseTimer = window.setTimeout?.(() => {
            bottomFitReleaseTimer = 0;
            scheduleAdaptiveLayout?.();
        }, delay) || 0;
    };
    const holdNodeBottomFit = () => {
        suppressNodeBottomFitUntil = (performance?.now?.() || Date.now()) + 1400;
        schedulePostSuppressionAdaptiveLayout();
    };
    node.__webuiBridgeHoldNodeBottomFit = holdNodeBottomFit;
    const holdPromptSplitFit = () => {
        suppressPromptSplitFitUntil = (performance?.now?.() || Date.now()) + 1400;
    };
    const holdPromptInnerFit = () => {
        suppressPromptInnerFitUntil = (performance?.now?.() || Date.now()) + 1400;
    };
    const holdPanelAutoFit = (duration = 2600) => {
        const now = performance?.now?.() || Date.now();
        suppressPanelAutoFitUntil = Math.max(suppressPanelAutoFitUntil, now + duration);
        promptLoraSplitManual = true;
        holdNodeBottomFit();
        holdPromptSplitFit();
    };
    const beginManualNodeResize = () => {
        releaseFreshInitialLayout();
        manualNodeResizeActive = true;
        holdPanelAutoFit();
    };
    const endManualNodeResize = () => {
        manualNodeResizeActive = false;
        holdPanelAutoFit();
        scheduleManualResizeSettle();
    };
    const capturePanelSectionHeights = () => ({
        top: resizeTargetLayoutHeight(topRow) || 0,
        extra: resizeTargetLayoutHeight(extraSection) || 0,
    });
    const hasSavedUserPanelSize = () => nodeHasSavedUserBridgePanelSize(node);
    if (hasSavedUserPanelSize()) holdNodeBottomFit();
    const scheduleManualResizeSettle = () => {
        window.clearTimeout?.(manualResizeSettleTimer);
        manualResizeSettleTimer = window.setTimeout?.(() => {
            manualResizeSettleTimer = 0;
            settleManualResizeLayout?.();
        }, 120) || 0;
    };
    const resizeNode = (deltaWidth, deltaHeight) => {
        const startSections = capturePanelSectionHeights();
        holdPanelAutoFit();
        setNodeSize(
            (node.size?.[0] || DEFAULT_PANEL_WIDTH) + deltaWidth,
            (node.size?.[1] || DEFAULT_PANEL_HEIGHT) + deltaHeight,
            { user: true },
        );
        resizePanelSectionsWithNode(deltaHeight, startSections);
        scheduleManualResizeSettle();
    };

    const installResizeDrag = (handle) => {
        handle.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            event.stopPropagation();
            handle.setPointerCapture?.(event.pointerId);
            handle.classList.add("dragging");
            beginManualNodeResize();
            const startX = event.clientX;
            const startY = event.clientY;
            const startWidth = node.size?.[0] || DEFAULT_PANEL_WIDTH;
            const startHeight = node.size?.[1] || DEFAULT_PANEL_HEIGHT;
            const startSections = capturePanelSectionHeights();
            const viewportScale = resizeTargetViewportScale(node.__webuiBridgePanel || handle);
            const viewportXScale = resizeTargetViewportXScale(node.__webuiBridgePanel || handle);
            const onMove = (moveEvent) => {
                holdPanelAutoFit();
                const deltaWidth = (moveEvent.clientX - startX) / viewportXScale;
                const deltaHeight = (moveEvent.clientY - startY) / viewportScale;
                setNodeSize(startWidth + deltaWidth, startHeight + deltaHeight, { user: true });
                resizePanelSectionsWithNode(deltaHeight, startSections);
            };
            const onUp = () => {
                handle.classList.remove("dragging");
                endManualNodeResize();
                document.removeEventListener("pointermove", onMove, true);
                document.removeEventListener("pointerup", onUp, true);
                document.removeEventListener("pointercancel", onUp, true);
            };
            document.addEventListener("pointermove", onMove, true);
            document.addEventListener("pointerup", onUp, true);
            document.addEventListener("pointercancel", onUp, true);
        }, true);
    };

    const installNodeWidthDrag = (handle) => {
        handle.addEventListener("pointerdown", (event) => {
            event.preventDefault();
            event.stopPropagation();
            handle.setPointerCapture?.(event.pointerId);
            beginManualNodeResize();
            const startX = event.clientX;
            const startWidth = node.size?.[0] || DEFAULT_PANEL_WIDTH;
            const startHeight = node.size?.[1] || DEFAULT_PANEL_HEIGHT;
            const viewportXScale = resizeTargetViewportXScale(node.__webuiBridgePanel || handle);
            let moved = false;
            handle.classList.add("dragging");
            const onMove = (moveEvent) => {
                const deltaWidth = (moveEvent.clientX - startX) / viewportXScale;
                if (!moved && Math.abs(deltaWidth) < 3) return;
                moved = true;
                holdPanelAutoFit();
                setNodeSize(startWidth + deltaWidth, startHeight, { user: true });
            };
            const onUp = () => {
                handle.classList.remove("dragging");
                endManualNodeResize();
                document.removeEventListener("pointermove", onMove, true);
                document.removeEventListener("pointerup", onUp, true);
                document.removeEventListener("pointercancel", onUp, true);
            };
            document.addEventListener("pointermove", onMove, true);
            document.addEventListener("pointerup", onUp, true);
            document.addEventListener("pointercancel", onUp, true);
        }, true);
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

    const nodeWidthInput = el("input", {
        type: "number",
        min: PANEL_MIN_WIDTH,
        max: PANEL_MAX_WIDTH,
        step: 20,
        inputmode: "numeric",
        title: "输入节点宽度",
    });
    const nodeHeightInput = el("input", {
        type: "number",
        min: PANEL_MIN_HEIGHT,
        max: PANEL_MAX_HEIGHT,
        step: 20,
        inputmode: "numeric",
        title: "输入节点高度",
    });
    const nodeSizeField = (label, input) => el("label", { class: "webui-bridge-size-field" }, [
        el("span", {}, label),
        input,
    ]);
    syncNodeSizeInputs = () => {
        const width = Math.round(Number(node.__webuiBridgeDesiredSize?.[0] || node.size?.[0] || DEFAULT_PANEL_WIDTH));
        const height = Math.round(Number(node.__webuiBridgeDesiredSize?.[1] || node.size?.[1] || DEFAULT_PANEL_HEIGHT));
        if (document.activeElement !== nodeWidthInput) nodeWidthInput.value = String(width);
        if (document.activeElement !== nodeHeightInput) nodeHeightInput.value = String(height);
    };
    const applyNodeSizeInputs = () => {
        const currentWidth = node.size?.[0] || DEFAULT_PANEL_WIDTH;
        const currentHeight = node.size?.[1] || DEFAULT_PANEL_HEIGHT;
        const nextWidth = Number(nodeWidthInput.value) || currentWidth;
        const nextHeight = Number(nodeHeightInput.value) || currentHeight;
        const startSections = capturePanelSectionHeights();
        setNodeSize(nextWidth, nextHeight, { user: true });
        resizePanelSectionsWithNode(nextHeight - currentHeight, startSections);
        scheduleManualResizeSettle();
    };
    for (const input of [nodeWidthInput, nodeHeightInput]) {
        input.addEventListener("change", applyNodeSizeInputs);
        input.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            applyNodeSizeInputs();
            input.blur();
        });
    }
    syncNodeSizeInputs();
    const sizeControls = el("div", { class: "webui-bridge-size-controls" }, [
        nodeSizeField("宽", nodeWidthInput),
        nodeSizeField("高", nodeHeightInput),
        el("button", { title: "Compact size", onclick: () => setNodeSize(840, 620, { user: true }) }, "S"),
        el("button", { title: "Smaller node", onclick: () => resizeNode(-120, -90) }, "-"),
        el("button", { title: "Larger node", onclick: () => resizeNode(120, 90) }, "+"),
        el("button", {
            title: "恢复节点默认尺寸并清理异常布局缓存",
            onclick: () => {
                resetNodeLayoutCache();
                setNodeSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT, { user: true });
            },
        }, "默认尺寸"),
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
    const resizeGrip = el("div", { class: "webui-bridge-resize-grip", title: "拖动调整整个节点宽高；缩放时会保留关键拖拽入口" }, "↘");
    installResizeDrag(resizeGrip);

    const promptRowBottomTarget = (row) => row.__webuiBridgeBottomResizeTarget?.() || row;
    const promptRowBottomKey = (row) => row.__webuiBridgeBottomResizeKey?.() || row.__webuiBridgeHeightKey || "";
    let negativeMainStartTopHeight = 0;
    let negativeMainStartExtraHeight = 0;
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
                label: "Prompt / 标签",
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
                label: "标签 / 反向词",
                title: "上下拖动分配标签列表和反向词文本框高度，双击恢复",
                onDragStart: () => {
                    holdPromptInnerFit();
                    negativeMainStartTopHeight = resizeTargetLayoutHeight(topRow);
                    negativeMainStartExtraHeight = resizeTargetLayoutHeight(extraSection);
                },
                onDragMove: (_event, detail) => {
                    promptInnerSplitManual = true;
                    holdPromptInnerFit();
                    if (!negative.row.classList.contains("collapsed") || !topRow || !extraSection || !detail) return;
                    promptLoraSplitManual = true;
                    holdPromptSplitFit();
                    const delta = detail.delta || 0;
                    setResizeTargetHeight(topRow, topRowHeightKey, negativeMainStartTopHeight + delta, {
                        min: getTopRowVisibleMinHeight(),
                        max: topRow.__webuiBridgeMaxHeight,
                    });
                    if (!extraCollapsed && !loraOverlayOpen) {
                        setResizeTargetHeight(extraSection, extraHeightKey, negativeMainStartExtraHeight - delta, {
                            min: EXTRA_NETWORKS_MIN_HEIGHT,
                            max: extraSection.__webuiBridgeMaxHeight || EXTRA_NETWORKS_MAX_HEIGHT,
                        });
                        extraSection.style.flex = "0 0 auto";
                    }
                },
                onDragEnd: () => {
                    holdPromptInnerFit();
                    holdPromptSplitFit();
                },
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
                label: "反向词 / 标签",
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
    const actionWidthKey = "webui-bridge-action-column-width";
    const actionWidthOptions = {
        defaultWidth: ACTION_SIDEBAR_DEFAULT_WIDTH,
        min: ACTION_SIDEBAR_MIN_WIDTH,
        max: ACTION_SIDEBAR_MAX_WIDTH,
        promptMin: ACTION_SIDEBAR_PROMPT_MIN_WIDTH,
    };
    migrateLayoutStorage([
        topRowHeightKey,
        extraHeightKey,
        extraCollapsedKey,
        actionWidthKey,
        "webui-bridge-negative-collapsed",
        positive.textarea.__webuiBridgeHeightKey,
        negative.textarea.__webuiBridgeHeightKey,
        positive.row?.chips?.__webuiBridgeHeightKey,
        negative.row?.chips?.__webuiBridgeHeightKey,
        positiveTagPanel?.__webuiBridgeHeightKey,
        negativeTagPanel?.__webuiBridgeHeightKey,
    ]);
    promptLoraSplitManual = readLocalNumber(topRowHeightKey, null) !== null;
    let extraCollapsed = readLocalBoolean(extraCollapsedKey, false);
    let actionCollapsed = false;
    let loraOverlayOpen = false;
    const resetNodeLayoutCache = () => {
        for (const key of [
            topRowHeightKey,
            extraHeightKey,
            extraCollapsedKey,
            actionWidthKey,
            "webui-bridge-negative-collapsed",
            positive.textarea.__webuiBridgeHeightKey,
            negative.textarea.__webuiBridgeHeightKey,
            positive.row?.chips?.__webuiBridgeHeightKey,
            negative.row?.chips?.__webuiBridgeHeightKey,
            positiveTagPanel?.__webuiBridgeHeightKey,
            negativeTagPanel?.__webuiBridgeHeightKey,
        ]) {
            if (key) clearLocalValue(key);
        }
        promptLoraSplitManual = false;
        promptInnerSplitManual = false;
        extraCollapsed = false;
        actionCollapsed = false;
        resetResizeTargetHeight(topRow, topRowHeightKey);
        resetResizeTargetHeight(extraSection, extraHeightKey, "1 1 auto");
        resetResizeTargetHeight(positive.textarea, positive.textarea.__webuiBridgeHeightKey);
        resetResizeTargetHeight(negative.textarea, negative.textarea.__webuiBridgeHeightKey);
        resetResizeTargetHeight(positive.row?.chips, positive.row?.chips?.__webuiBridgeHeightKey);
        resetResizeTargetHeight(negative.row?.chips, negative.row?.chips?.__webuiBridgeHeightKey);
        resetResizeTargetHeight(positiveTagPanel, positiveTagPanel?.__webuiBridgeHeightKey);
        resetResizeTargetHeight(negativeTagPanel, negativeTagPanel?.__webuiBridgeHeightKey);
        resetSidebarWidth(topRow, actionWidthKey, actionWidthOptions);
        applyTopRowCollapsedState(topRow, false);
        applyExtraCollapsedState();
        applyActionCollapsedState();
        window.requestAnimationFrame?.(() => panel?.__webuiBridgeScheduleAdaptiveLayout?.());
    };
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
    const stopExtraPointerBubble = (event) => {
        if (event.target?.closest?.(".webui-bridge-resize-grip, .webui-bridge-panel-splitter")) return;
        event.stopPropagation();
    };
    extraSection.addEventListener("pointerdown", stopExtraPointerBubble, true);
    extraSection.addEventListener("mousedown", stopExtraPointerBubble, true);
    extraSection.addEventListener("dragstart", stopExtraPointerBubble, true);
    extraSection.__webuiBridgeHeightKey = extraHeightKey;
    extraSection.__webuiBridgeMinHeight = EXTRA_NETWORKS_MIN_HEIGHT;
    extraSection.__webuiBridgeMaxHeight = EXTRA_NETWORKS_MAX_HEIGHT;
    resizeExtraWithNode = (deltaHeight) => {
        if (!deltaHeight || extraCollapsed || loraOverlayOpen || !extraSection?.isConnected) return;
        const currentHeight = resizeTargetLayoutHeight(extraSection) || EXTRA_NETWORKS_MIN_HEIGHT;
        setResizeTargetHeight(extraSection, extraHeightKey, currentHeight + deltaHeight, {
            min: EXTRA_NETWORKS_MIN_HEIGHT,
            max: extraSection.__webuiBridgeMaxHeight || EXTRA_NETWORKS_MAX_HEIGHT,
        });
        extraSection.style.flex = "0 0 auto";
    };
    settleManualResizeLayout = () => {
        if (extraCollapsed || loraOverlayOpen || !panel?.isConnected || !extraSection?.isConnected) return;
        if (freshInitialLayoutStabilizing()) return;
        window.requestAnimationFrame?.(() => {
            window.requestAnimationFrame?.(() => {
                if (extraCollapsed || loraOverlayOpen || !panel?.isConnected || !extraSection?.isConnected) return;
                if (freshInitialLayoutStabilizing()) return;
                const panelRect = panel.getBoundingClientRect();
                const extraRect = extraSection.getBoundingClientRect();
                const scale = resizeTargetViewportScale(panel) || 1;
                const targetGap = 12 * scale;
                const blank = panelRect.bottom - extraRect.bottom - targetGap;
                const settleTolerance = Math.max(24 * scale, panelRect.height * 0.015);
                if (Math.abs(blank) <= settleTolerance) return;
                const currentHeight = resizeTargetLayoutHeight(extraSection) || EXTRA_NETWORKS_MIN_HEIGHT;
                let nextExtraHeight = currentHeight + blank / scale;
                if (blank < 0 && topRow?.isConnected) {
                    const extraComfortHeight = getExtraResizeComfortHeight();
                    const currentTopHeight = resizeTargetLayoutHeight(topRow) || 0;
                    const topMin = getTopRowVisibleMinHeight();
                    if (nextExtraHeight < extraComfortHeight && currentTopHeight > topMin + 1) {
                        const topReduction = Math.min(currentTopHeight - topMin, extraComfortHeight - nextExtraHeight);
                        setResizeTargetHeight(topRow, topRowHeightKey, currentTopHeight - topReduction, {
                            min: topMin,
                            max: topRow.__webuiBridgeMaxHeight,
                        });
                        nextExtraHeight += topReduction;
                    }
                }
                setResizeTargetHeight(extraSection, extraHeightKey, nextExtraHeight, {
                    min: EXTRA_NETWORKS_MIN_HEIGHT,
                    max: extraSection.__webuiBridgeMaxHeight || EXTRA_NETWORKS_MAX_HEIGHT,
                });
                extraSection.style.flex = "0 0 auto";
            });
        });
    };
    function applyExtraCollapsedState(options = {}) {
        const preserveExpandedHeight = Boolean(options.preserveExpandedHeight);
        const preservedHeight = preserveExpandedHeight
            ? (resizeTargetLayoutHeight(extraSection) || readLocalNumber(extraHeightKey, null) || 0)
            : 0;
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
        extraSection.style.flex = "0 0 auto";
        if (preserveExpandedHeight && preservedHeight) {
            setResizeTargetHeight(extraSection, extraHeightKey, preservedHeight, {
                min: EXTRA_NETWORKS_MIN_HEIGHT,
                max: extraSection.__webuiBridgeMaxHeight,
            });
        } else {
            applyStoredHeight(extraSection, extraHeightKey, { min: EXTRA_NETWORKS_MIN_HEIGHT, max: extraSection.__webuiBridgeMaxHeight });
        }
        extraSection.style.flex = "0 0 auto";
        requestAnimationFrame(ensureUsableExtraHeight);
        scheduleAdaptiveLayout();
    }
    applyExtraCollapsedState();
    const regionalSection = el("details", { class: "webui-bridge-regional-section", open: Boolean(regionalEnabledInput.checked) }, [
        el("summary", {}, [
            el("span", {}, "区域控制"),
            regionalEnabledInput,
        ]),
        el("div", { class: "webui-bridge-regional-grid" }, [
            el("label", {}, [el("span", {}, "切分"), regionalSplitSelect]),
            el("label", {}, [el("span", {}, "比例"), regionalRatiosInput]),
            el("label", {}, [regionalBaseInput, el("span", {}, "Base")]),
            el("label", {}, [regionalCommonInput, el("span", {}, "Common")]),
            el("label", {}, [el("span", {}, "Base比例"), regionalBaseRatioInput]),
            el("label", {}, [el("span", {}, "强度"), regionalStrengthInput]),
            el("label", { class: "webui-bridge-regional-canvas-row" }, [
                el("span", {}, "画布"),
                regionalCanvasAutoInput,
                el("span", {}, "自动"),
                regionalCanvasWidthInput,
                el("span", { class: "webui-bridge-regional-canvas-times" }, "x"),
                regionalCanvasHeightInput,
                regionalDetectButton,
            ]),
        ]),
        el("div", { class: "webui-bridge-regional-actions" }, [
            regionalTemplateButton,
            regionalStatus,
        ]),
        regionalPreviewFrame,
    ]);
    renderRegionalPreview();

    let topRow = null;
    let actionColumn = null;
    let actionResizeGrip = null;
    const getActionColumnWidthDelta = () => {
        const sidebarWidth = topRow
            ? Number.parseFloat(getComputedStyle(topRow).getPropertyValue("--webui-bridge-sidebar-width")) || ACTION_SIDEBAR_DEFAULT_WIDTH
            : ACTION_SIDEBAR_DEFAULT_WIDTH;
        const gripWidth = topRow?.__webuiBridgeSidebarGrip?.offsetWidth || 30;
        return Math.ceil(sidebarWidth + gripWidth + gridColumnGap(topRow) * 2);
    };
    const preservePromptLayoutForSidebarToggle = () => {
        promptLoraSplitManual = true;
        promptInnerSplitManual = true;
        holdPromptSplitFit();
        holdPromptInnerFit();
        holdNodeBottomFit();
        const currentTopHeight = resizeTargetLayoutHeight(topRow);
        if (currentTopHeight) {
            setResizeTargetHeight(topRow, topRowHeightKey, currentTopHeight, {
                min: getTopRowVisibleMinHeight(),
                max: topRow.__webuiBridgeMaxHeight,
            });
        }
        const currentExtraHeight = resizeTargetLayoutHeight(extraSection);
        if (currentExtraHeight && !extraCollapsed && !loraOverlayOpen) {
            setResizeTargetHeight(extraSection, extraHeightKey, currentExtraHeight, {
                min: getExtraVisibleFloor(),
                max: extraSection.__webuiBridgeMaxHeight || EXTRA_NETWORKS_MAX_HEIGHT,
            });
            extraSection.style.flex = "0 0 auto";
        }
    };
    const resizeNodeForActionCollapsed = () => {
        if (!topRow || !node.size) return;
        preservePromptLayoutForSidebarToggle();
        const currentWidth = node.size?.[0] || DEFAULT_PANEL_WIDTH;
        const currentHeight = node.size?.[1] || DEFAULT_PANEL_HEIGHT;
        const delta = getActionColumnWidthDelta();
        let nextWidth;
        if (actionCollapsed) {
            node.__webuiBridgeWidthBeforeActionCollapse = currentWidth;
            nextWidth = Math.max(PANEL_MIN_WIDTH, currentWidth - delta);
        } else if (Number.isFinite(node.__webuiBridgeWidthBeforeActionCollapse)) {
            nextWidth = Math.max(DEFAULT_PANEL_WIDTH, node.__webuiBridgeWidthBeforeActionCollapse);
            node.__webuiBridgeWidthBeforeActionCollapse = null;
        } else {
            nextWidth = currentWidth <= PANEL_MIN_WIDTH + 16
                ? Math.max(DEFAULT_PANEL_WIDTH, currentWidth + delta)
                : Math.max(DEFAULT_PANEL_WIDTH, currentWidth);
        }
        setNodeSize(nextWidth, currentHeight, { user: true });
    };
    const actionToggle = el("button", {
        class: "webui-bridge-side-toggle",
        type: "button",
        onclick: () => {
            preservePromptLayoutForSidebarToggle();
            actionCollapsed = !actionCollapsed;
            applyActionCollapsedState();
        },
    });
    function applyActionCollapsedState({ resizeNode = false } = {}) {
        topRow?.classList?.toggle("action-collapsed", actionCollapsed);
        actionColumn?.classList?.toggle("collapsed", actionCollapsed);
        actionResizeGrip?.classList?.toggle("collapsed", actionCollapsed);
        actionToggle.textContent = actionCollapsed ? "显示侧栏" : "隐藏侧栏";
        actionToggle.title = actionCollapsed ? "显示右侧控制栏" : "隐藏右侧控制栏，露出节点接口";
        if (resizeNode) requestAnimationFrame(resizeNodeForActionCollapsed);
    }
    const topControlButton = (text, title, onclick, extraClass = "") => el("button", {
        class: `webui-bridge-top-control ${extraClass}`.trim(),
        type: "button",
        title,
        onclick,
    }, text);
    const visibilityTargets = [];
    const bindVisibility = (element, key) => {
        if (element && key) {
            element.dataset.visibilityKey = key;
            visibilityTargets.push(element);
        }
        return element;
    };
    const nodeWidthGrip = el("div", {
        class: "webui-bridge-node-width-resizer",
        role: "separator",
        "aria-orientation": "vertical",
        "aria-label": "拖动调整整个节点宽度",
        title: "左右拖动调整整个节点宽度；如果右下角手柄不在屏幕里，用这里拉宽",
    }, [
        el("span", { class: "webui-bridge-node-width-icon" }, "↔"),
        el("span", { class: "webui-bridge-node-width-text" }, "拖宽节点"),
    ]);
    installNodeWidthDrag(nodeWidthGrip);

    const settingsButton = topControlButton("设置", "设置数据来源、翻译、布局、Tag 和 LoRA 卡片显示", showBridgeSettingsDialog, "primary");
    const tutorialButton = bindVisibility(topControlButton("教程", "查看拖拽、布局、LoRA 和反向提示词使用说明", showBridgeTutorialDialog, "help"), "top_tutorial");
    const webuiButton = bindVisibility(topControlButton("接入 WebUI", "只填写 WebUI 根目录，自动接入 Prompt All in One、TagComplete、styles、LoRA 和模型目录", showWebUIIntegrationDialog), "top_webui");
    quickLoraOverlayButton = bindVisibility(topControlButton("添加 LoRA", "打开 LoRA / LyCORIS 浮层，添加完成后可关闭让节点更紧凑", openLoraOverlay), "top_lora");
    const clipField = bindVisibility(el("label", { class: "webui-bridge-top-field", title: "Default LoRA CLIP strength when tag has no third value" }, [
        el("span", {}, "CLIP"),
        clipStrengthInput,
    ]), "top_clip");
    const failOnMissingField = bindVisibility(el("label", { class: "webui-bridge-top-check", title: "Stop generation when a LoRA tag cannot be found" }, [
        failOnMissingInput,
        el("span", {}, "缺 LoRA 停止"),
    ]), "top_fail_on_missing");
    bindVisibility(extraSection, "lora_browser");
    const topControls = el("div", { class: "webui-bridge-top-controls" }, [
        actionToggle,
        settingsButton,
        tutorialButton,
        topControlButton("恢复尺寸", "恢复节点默认宽高并清理异常布局缓存，避免误点后缩成窄条", () => {
            resetNodeLayoutCache();
            setNodeSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT, { user: true });
        }),
        nodeWidthGrip,
        webuiButton,
        quickLoraOverlayButton,
        clipField,
        failOnMissingField,
    ]);
    actionColumn = el("div", { class: "webui-bridge-action-column" }, [
        createSidebarWidthButton(() => topRow, actionWidthKey, actionWidthOptions),
        el("button", { class: "webui-bridge-generate", title: "Queue Prompt", onclick: queuePrompt }, "Generate"),
        status,
        bindVisibility(modelSwitchControls, "model_switch"),
        bindVisibility(regionalSection, "regional_control"),
        regionalModuleSection,
        bindVisibility(animaModeControls, "model_switch"),
        bindVisibility(sizeControls, "size_controls"),
        bindVisibility(layoutPresetControls, "layout_presets"),
        bindVisibility(toolbar, "prompt_tools"),
        bindVisibility(el("div", { class: "webui-bridge-style-row" }, [
            styleSelect,
            el("div", { class: "webui-bridge-style-edit" }, [
                styleName,
                createToolButton("套", "套用选中的起手式到当前 prompt", materializeSelectedStyles),
                createToolButton("提", "从当前 prompt 中识别并提取已套用的起手式", extractAppliedStyles),
                createToolButton("编", "打开起手式编辑器", showStyleEditorDialog),
                createToolButton("+", "保存当前 prompt 为起手式", saveStyle),
                createToolButton("-", "删除选中或输入的起手式", deleteStyle),
            ]),
        ]), "styles"),
    ]);
    actionResizeGrip = createSidebarWidthGrip(() => topRow, actionWidthKey, actionWidthOptions);
    topRow = el("div", { class: "webui-bridge-toprow" }, [
        promptsColumn,
        actionResizeGrip,
        actionColumn,
    ]);
    topRow.__webuiBridgeSidebarGrip = actionResizeGrip;

    const applyUiVisibility = () => {
        const visibility = normalizeBridgeSettings(state.settings).ui_visibility;
        for (const target of visibilityTargets) {
            const key = target.dataset.visibilityKey;
            target.classList.toggle("webui-bridge-ui-hidden", visibility[key] === false);
        }
        for (const target of regionalModuleSection.querySelectorAll("[data-visibility-key]")) {
            const key = target.dataset.visibilityKey;
            target.classList.toggle("webui-bridge-ui-hidden", visibility[key] === false);
        }
        const anyModuleVisible = MODULE_VISIBILITY_OPTIONS.some(([key]) => visibility[key] !== false);
        regionalModuleSection.classList.toggle("webui-bridge-ui-hidden", !anyModuleVisible);
        if (visibility.lora_browser === false && loraOverlayOpen) closeLoraOverlay();
        scheduleAdaptiveLayout();
    };
    topRow.__webuiBridgeSidebarWidthKey = actionWidthKey;
    topRow.__webuiBridgeSidebarWidthOptions = actionWidthOptions;
    applyStoredSidebarWidth(topRow, actionWidthKey, actionWidthOptions);
    applyActionCollapsedState();
    topRow.__webuiBridgeHeightKey = topRowHeightKey;
    topRow.__webuiBridgeMinHeight = 220;
    topRow.__webuiBridgeMaxHeight = Math.max(520, PANEL_MAX_HEIGHT - EXTRA_NETWORKS_MIN_HEIGHT - 140);
    const getTopRowVisibleMinHeight = () => {
        if (!topRow?.classList?.contains("negative-collapsed")) return topRow.__webuiBridgeMinHeight || 220;
        const promptStyle = promptsColumn ? getComputedStyle(promptsColumn) : null;
        const gap = Number.parseFloat(promptStyle?.rowGap || promptStyle?.gap) || 6;
        const positiveInputMin = promptRowBottomTarget(positive.row)?.__webuiBridgeMinHeight || 48;
        const positiveTagsMin = positiveTagPanel?.__webuiBridgeMinHeight || AIO_POSITIVE_MIN_HEIGHT;
        const collapsedNegativeHeight = Math.max(38, negative.row?.offsetHeight || 0);
        return Math.ceil(positiveInputMin + positiveTagsMin + COLLAPSED_NEGATIVE_SPLIT_GRIP_HEIGHT + collapsedNegativeHeight + gap * 3);
    };
    const getExtraVisibleFloor = () => extraCollapsed ? 42 : EXTRA_NETWORKS_MIN_HEIGHT;
    const getExtraResizeComfortHeight = () => extraCollapsed
        ? 42
        : Math.max(getExtraVisibleFloor(), EXTRA_NETWORKS_CARD_ROW_MIN_HEIGHT + 96);
    const seedFreshInitialLayout = () => {
        if (!freshInitialLayoutPending() || node.__webuiBridgeFreshInitialLayoutSeeded) return;
        node.__webuiBridgeFreshInitialLayoutSeeded = true;
        node.__webuiBridgeFreshLayoutStabilizeUntil = Math.max(
            node.__webuiBridgeFreshLayoutStabilizeUntil || 0,
            (performance?.now?.() || Date.now()) + 1800,
        );
        setLayoutPresetClass("default");
        promptLoraSplitManual = true;
        setResizeTargetHeight(topRow, topRowHeightKey, 620, {
            min: getTopRowVisibleMinHeight(),
            max: topRow.__webuiBridgeMaxHeight,
        });
        setResizeTargetHeight(extraSection, extraHeightKey, Math.max(452, getExtraResizeComfortHeight()), {
            min: getExtraVisibleFloor(),
            max: extraSection.__webuiBridgeMaxHeight || EXTRA_NETWORKS_MAX_HEIGHT,
        });
        extraSection.style.flex = "0 0 auto";
    };
    const getPanelSplitterHeight = () => panel?.querySelector?.(".webui-bridge-panel-splitter")?.offsetHeight || PANEL_SPLIT_GRIP_HEIGHT;
    const getPanelTopControlsHeight = () => topControls && !resizeTargetHidden(topControls) ? resizeTargetLayoutHeight(topControls) : 0;
    const getTopRowVisibleMaxHeight = () => {
        const topMin = getTopRowVisibleMinHeight();
        const panelHeight = panel ? resizeTargetLayoutHeight(panel) : 0;
        if (!panelHeight) return topRow.__webuiBridgeMaxHeight;
        const panelStyle = getComputedStyle(panel);
        const paddingY = (Number.parseFloat(panelStyle.paddingTop) || 0) + (Number.parseFloat(panelStyle.paddingBottom) || 0);
        const rowGap = Number.parseFloat(panelStyle.rowGap || panelStyle.gap) || 0;
        const visibleMax = panelHeight - paddingY - getPanelTopControlsHeight() - rowGap * 3 - getPanelSplitterHeight() - getExtraVisibleFloor() - 4;
        return Math.max(topMin, Math.min(topRow.__webuiBridgeMaxHeight, Math.floor(visibleMax)));
    };
    resizePanelSectionsWithNode = (deltaHeight, startSections = capturePanelSectionHeights()) => {
        if (!deltaHeight || extraCollapsed || loraOverlayOpen || !topRow?.isConnected || !extraSection?.isConnected) {
            resizeExtraWithNode(deltaHeight);
            return;
        }
        promptLoraSplitManual = true;
        holdPanelAutoFit();
        const topMin = getTopRowVisibleMinHeight();
        const topMax = topRow.__webuiBridgeMaxHeight || PANEL_MAX_HEIGHT;
        const extraMin = getExtraVisibleFloor();
        const extraMax = extraSection.__webuiBridgeMaxHeight || EXTRA_NETWORKS_MAX_HEIGHT;
        const startTop = clampNumber(startSections?.top || resizeTargetLayoutHeight(topRow) || topMin, topMin, topMax);
        const startExtra = clampNumber(startSections?.extra || resizeTargetLayoutHeight(extraSection) || extraMin, extraMin, extraMax);
        const startTotal = Math.max(topMin + extraMin, startTop + startExtra);
        const targetTotal = clampNumber(startTotal + deltaHeight, topMin + extraMin, topMax + extraMax);
        const extraShare = clampNumber(startExtra / Math.max(startTotal, 1), 0.12, 0.55);
        const extraComfortHeight = getExtraResizeComfortHeight();
        const comfortableExtraFloor = Math.min(
            Math.max(extraMin, extraComfortHeight, startExtra > extraMin + 12 ? startExtra : extraMin),
            Math.max(extraMin, targetTotal - topMin),
        );
        const maxExtraForTotal = Math.max(extraMin, Math.min(extraMax, targetTotal - topMin));
        let nextExtra = clampNumber(
            Math.max(targetTotal * extraShare, comfortableExtraFloor),
            extraMin,
            maxExtraForTotal,
        );
        const maxTopForTotal = Math.max(topMin, Math.min(topMax, targetTotal - extraMin));
        let nextTop = clampNumber(targetTotal - nextExtra, topMin, maxTopForTotal);
        nextExtra = clampNumber(targetTotal - nextTop, extraMin, extraMax);
        setResizeTargetHeight(topRow, topRowHeightKey, nextTop, {
            min: topMin,
            max: topMax,
        });
        setResizeTargetHeight(extraSection, extraHeightKey, nextExtra, {
            min: extraMin,
            max: extraMax,
        });
        extraSection.style.flex = "0 0 auto";
    };
    applyStoredHeight(topRow, topRowHeightKey, { min: topRow.__webuiBridgeMinHeight, max: topRow.__webuiBridgeMaxHeight });
    applyTopRowCollapsedState(topRow, negative.row.classList.contains("collapsed"));

    const panel = el("div", { class: "webui-bridge-panel" }, [
        topControls,
        topRow,
        createHeightSplitGrip(topRow, extraSection, topRowHeightKey, extraHeightKey, {
            className: "webui-bridge-panel-splitter",
            beforeMin: getTopRowVisibleMinHeight,
            beforeMax: getTopRowVisibleMaxHeight,
            afterMin: getExtraVisibleFloor,
            afterMax: EXTRA_NETWORKS_MAX_HEIGHT,
            afterFlex: "0 0 auto",
            label: "提示词 / LoRA",
            title: "上下拖动分配提示词区域和 Extra Networks 高度，双击恢复",
            onDragStart: () => {
                releaseFreshInitialLayout();
                promptLoraSplitManual = true;
                holdPanelAutoFit();
            },
            onDragMove: () => {
                promptLoraSplitManual = true;
                holdPanelAutoFit();
            },
            onDragEnd: holdPanelAutoFit,
        }),
        extraSection,
        resizeGrip,
    ]);
    node.__webuiBridgeHandleExternalNodeResize = ({ previousHeight, height } = {}) => {
        if (!panel?.isConnected) return;
        releaseFreshInitialLayout();
        const beforeHeight = Number(previousHeight || 0);
        const afterHeight = Number(height || 0);
        const deltaHeight = Number.isFinite(beforeHeight) && Number.isFinite(afterHeight)
            ? afterHeight - beforeHeight
            : 0;
        if (Math.abs(deltaHeight) >= 1) {
            const startSections = capturePanelSectionHeights();
            promptLoraSplitManual = true;
            resizePanelSectionsWithNode(deltaHeight, startSections);
            scheduleManualResizeSettle();
        } else {
            holdPanelAutoFit();
            scheduleAdaptiveLayout();
        }
        syncNodeSizeInputs();
    };
    installBridgePanelCanvasEventGuards(panel);
    node.__webuiBridgeMinNodeHeight = () => {
        const splitter = panel.querySelector?.(".webui-bridge-panel-splitter");
        const splitterHeight = splitter?.offsetHeight || PANEL_SPLIT_GRIP_HEIGHT;
        const extraHeadHeight = extraSection.querySelector?.(".webui-bridge-extra-head")?.offsetHeight || 44;
        const extraFloor = extraCollapsed ? 42 : Math.max(EXTRA_NETWORKS_MIN_HEIGHT, splitterHeight + extraHeadHeight + 10);
        return Math.max(PANEL_MIN_HEIGHT, DOM_WIDGET_LAYOUT_PAD + getPanelTopControlsHeight() + getTopRowVisibleMinHeight() + splitterHeight + extraFloor + 24);
    };
    applyPanelFontSize(panel);
    seedFreshInitialLayout();
    const refreshSidebarWidth = () => setSidebarWidth(
        topRow,
        "",
        readLocalNumber(actionWidthKey, actionWidthOptions.defaultWidth),
        actionWidthOptions,
    );
    if (typeof ResizeObserver !== "undefined") {
        const sidebarResizeObserver = new ResizeObserver(refreshSidebarWidth);
        sidebarResizeObserver.observe(topRow);
        panel.__webuiBridgeSidebarResizeObserver = sidebarResizeObserver;
    }
    window.requestAnimationFrame?.(refreshSidebarWidth);
    networkPane.append(cards);

    const fitLoraSectionToVisibleRows = (rows = 1, { force = false, fillAvailable = false } = {}) => {
        if (extraCollapsed || loraOverlayOpen || !extraSection?.isConnected) return;
        if (!force && sectionAutoFitSuspended()) return;
        if (!force && !fillAvailable && (performance?.now?.() || Date.now()) < suppressNodeBottomFitUntil) return;
        const extraRect = extraSection.getBoundingClientRect();
        const headHeight = extraSection.querySelector(".webui-bridge-extra-head")?.offsetHeight || 44;
        const grid = extraSection.querySelector(".webui-bridge-card-grid");
        const gridStyle = grid ? getComputedStyle(grid) : null;
        const firstCard = grid?.querySelector(".webui-bridge-card, .webui-bridge-empty");
        const cardScale = extraRect.height && extraSection.offsetHeight ? extraRect.height / extraSection.offsetHeight : 1;
        const cardRect = firstCard?.getBoundingClientRect?.();
        const visibleCardHeight = cardRect?.height && cardScale ? cardRect.height / cardScale : 0;
        const cardHeight = visibleCardHeight || firstCard?.offsetHeight || Number.parseFloat(gridStyle?.gridAutoRows) || 142;
        const rowGap = Number.parseFloat(gridStyle?.rowGap || gridStyle?.gap) || 8;
        const paddingY = gridStyle ? (Number.parseFloat(gridStyle.paddingTop) || 0) + (Number.parseFloat(gridStyle.paddingBottom) || 0) : 16;
        const borderY = 4;
        const nextHeight = Math.ceil(headHeight + paddingY + cardHeight * rows + rowGap * Math.max(0, rows - 1) + borderY);
        const panelHeight = panel ? resizeTargetLayoutHeight(panel) : 0;
        const splitter = panel?.querySelector?.(".webui-bridge-panel-splitter");
        const splitterHeight = splitter && !resizeTargetHidden(splitter) ? resizeTargetLayoutHeight(splitter) : 0;
        const bottomGap = getExtraSectionBottomGapMetrics();
        let availableExtraHeight = nextHeight;
        if (panelHeight) {
            const panelRect = panel.getBoundingClientRect();
            const topRect = topRow.getBoundingClientRect();
            const splitterRect = splitter?.getBoundingClientRect?.();
            const extraRectForGap = extraSection.getBoundingClientRect();
            const viewportScale = bottomGap.viewportScale || 1;
            const paddingTop = Math.max(0, (topRect.top - panelRect.top) / viewportScale) || (Number.parseFloat(getComputedStyle(panel).paddingTop) || 0);
            const gapBeforeSplitter = splitterRect ? Math.max(0, (splitterRect.top - topRect.bottom) / viewportScale) : 0;
            const gapBeforeExtra = splitterRect ? Math.max(0, (extraRectForGap.top - splitterRect.bottom) / viewportScale) : 0;
            availableExtraHeight = panelHeight - paddingTop - resizeTargetLayoutHeight(topRow) - gapBeforeSplitter - splitterHeight - gapBeforeExtra - bottomGap.targetGapLayout;
        }
        const hasLargeBottomBlank = panelHeight && panel ? bottomGap.largeBottomBlank : false;
        const shouldFillAvailable = fillAvailable &&
            ((!promptLoraSplitManual && !promptInnerSplitManual) || hasLargeBottomBlank);
        const cappedHeight = shouldFillAvailable
            ? Math.max(nextHeight, availableExtraHeight || nextHeight)
            : Math.min(nextHeight, Math.max(EXTRA_NETWORKS_MIN_HEIGHT, availableExtraHeight || nextHeight));
        const targetHeight = Math.max(EXTRA_NETWORKS_CARD_ROW_MIN_HEIGHT, cappedHeight);
        const currentHeight = resizeTargetLayoutHeight(extraSection) || 0;
        const availableHeight = Math.max(EXTRA_NETWORKS_MIN_HEIGHT, availableExtraHeight || targetHeight);
        let nextExtraHeight = force ? targetHeight : currentHeight;
        if (!force && currentHeight < targetHeight - 2) {
            nextExtraHeight = targetHeight;
        } else if (!force && currentHeight > availableHeight + 2) {
            nextExtraHeight = availableHeight;
        }
        if (!force && Math.abs(nextExtraHeight - currentHeight) < 2) return;
        setResizeTargetHeight(extraSection, extraHeightKey, nextExtraHeight, {
            min: EXTRA_NETWORKS_CARD_ROW_MIN_HEIGHT,
            max: extraSection.__webuiBridgeMaxHeight,
        });
        extraSection.style.flex = "0 0 auto";
    };

    const fitNodeBottomToVisibleContent = () => {
        if (loraOverlayOpen || !panel?.isConnected || !extraSection?.isConnected) return;
        if (nodeSizeAutoFitLocked()) return;
        if ((performance?.now?.() || Date.now()) < suppressNodeBottomFitUntil) return;
        const currentWidth = node.size?.[0] || node.__webuiBridgeDesiredSize?.[0] || DEFAULT_PANEL_WIDTH;
        const currentHeight = node.size?.[1] || node.__webuiBridgeDesiredSize?.[1] || DEFAULT_PANEL_HEIGHT;
        const activePreset = state.settings?.layout_preset || "default";
        let shrinkFloor = Math.max(node.__webuiBridgeMinNodeHeight?.() || PANEL_MIN_HEIGHT, PANEL_MIN_HEIGHT);
        if (!extraCollapsed) {
            const targetRows = activePreset === "default" ? 2 : 1;
            const extraRect = extraSection.getBoundingClientRect();
            const headHeight = extraSection.querySelector(".webui-bridge-extra-head")?.offsetHeight || 44;
            const grid = extraSection.querySelector(".webui-bridge-card-grid");
            const gridStyle = grid ? getComputedStyle(grid) : null;
            const firstCard = grid?.querySelector(".webui-bridge-card, .webui-bridge-empty");
            const scale = extraRect.height && extraSection.offsetHeight ? extraRect.height / extraSection.offsetHeight : 1;
            const cardRect = firstCard?.getBoundingClientRect?.();
            const visibleCardHeight = cardRect?.height && scale ? cardRect.height / scale : 0;
            const cardHeight = visibleCardHeight || firstCard?.offsetHeight || Number.parseFloat(gridStyle?.gridAutoRows) || 142;
            const rowGap = Number.parseFloat(gridStyle?.rowGap || gridStyle?.gap) || 8;
            const paddingY = gridStyle ? (Number.parseFloat(gridStyle.paddingTop) || 0) + (Number.parseFloat(gridStyle.paddingBottom) || 0) : 16;
            const desiredExtraHeight = Math.ceil(headHeight + paddingY + cardHeight * targetRows + rowGap * Math.max(0, targetRows - 1) + 4);
            const splitter = panel.querySelector?.(".webui-bridge-panel-splitter");
            const splitterHeight = splitter && !resizeTargetHidden(splitter) ? resizeTargetLayoutHeight(splitter) : 0;
            const viewportScale = resizeTargetViewportScale(panel) || 1;
            const panelRect = panel.getBoundingClientRect();
            const topRect = topRow.getBoundingClientRect();
            const splitterRect = splitter?.getBoundingClientRect?.();
            const extraRectForGap = extraSection.getBoundingClientRect();
            const paddingTop = Math.max(0, (topRect.top - panelRect.top) / viewportScale) || (Number.parseFloat(getComputedStyle(panel).paddingTop) || 0);
            const gapBeforeSplitter = splitterRect ? Math.max(0, (splitterRect.top - topRect.bottom) / viewportScale) : 0;
            const gapBeforeExtra = splitterRect ? Math.max(0, (extraRectForGap.top - splitterRect.bottom) / viewportScale) : 0;
            const panelChrome = Math.max(0, currentHeight - resizeTargetLayoutHeight(panel));
            const requiredHeight = paddingTop + resizeTargetLayoutHeight(topRow) + gapBeforeSplitter + splitterHeight + gapBeforeExtra + desiredExtraHeight + 12 + panelChrome;
            shrinkFloor = Math.max(shrinkFloor, Math.ceil(requiredHeight));
        }
        if (currentHeight < shrinkFloor - 2) {
            setNodeSize(currentWidth, shrinkFloor, { remember: false });
            return;
        }
    };

    const getExtraSectionBottomGapMetrics = () => {
        if (!panel?.isConnected || !extraSection?.isConnected) {
            return {
                viewportScale: 1,
                targetGapLayout: 8,
                blank: 0,
                settleTolerance: 0,
                largeBottomBlank: false,
            };
        }
        const panelRect = panel.getBoundingClientRect();
        const extraRect = extraSection.getBoundingClientRect();
        const viewportScale = resizeTargetViewportScale(panel) || 1;
        const targetGapLayout = 8;
        const targetGap = targetGapLayout * viewportScale;
        const blank = panelRect.bottom - extraRect.bottom - targetGap;
        const settleTolerance = Math.max(24 * viewportScale, panelRect.height * 0.015);
        const largeBottomBlankThreshold = Math.max(96 * viewportScale, panelRect.height * 0.08);
        return {
            viewportScale,
            targetGapLayout,
            blank,
            settleTolerance,
            largeBottomBlank: blank > largeBottomBlankThreshold,
        };
    };

    const fillExtraSectionToPanelBottom = () => {
        if (extraCollapsed || loraOverlayOpen || !panel?.isConnected || !extraSection?.isConnected) return;
        if (sectionAutoFitSuspended()) return;
        const activePreset = state.settings?.layout_preset || "default";
        const canGrow = !promptLoraSplitManual && (activePreset === "default" || activePreset === "roomy");
        const bottomGap = getExtraSectionBottomGapMetrics();
        if (bottomGap.blank > bottomGap.settleTolerance && !canGrow && !bottomGap.largeBottomBlank) return;
        if (Math.abs(bottomGap.blank) <= bottomGap.settleTolerance && !bottomGap.largeBottomBlank) return;
        const currentHeight = resizeTargetLayoutHeight(extraSection) || EXTRA_NETWORKS_MIN_HEIGHT;
        const nextHeight = currentHeight + bottomGap.blank / bottomGap.viewportScale;
        setResizeTargetHeight(extraSection, extraHeightKey, nextHeight, {
            min: EXTRA_NETWORKS_MIN_HEIGHT,
            max: extraSection.__webuiBridgeMaxHeight || EXTRA_NETWORKS_MAX_HEIGHT,
        });
        extraSection.style.flex = "0 0 auto";
    };

    const ensurePanelSplitterVisible = () => {
        if (!panel?.isConnected || !topRow?.isConnected || !extraSection?.isConnected) return;
        const topMin = getTopRowVisibleMinHeight();
        const topMax = getTopRowVisibleMaxHeight();
        const currentTop = resizeTargetLayoutHeight(topRow) || 0;
        if (currentTop > topMax + 1 || currentTop < topMin - 1) {
            setResizeTargetHeight(topRow, topRowHeightKey, clampNumber(currentTop || topMin, topMin, topMax), {
                min: topMin,
                max: topMax,
            });
        }
        const extraFloor = getExtraVisibleFloor();
        const currentExtra = resizeTargetLayoutHeight(extraSection) || 0;
        if (currentExtra < extraFloor - 1) {
            setResizeTargetHeight(extraSection, extraHeightKey, extraFloor, {
                min: extraFloor,
                max: extraSection.__webuiBridgeMaxHeight || EXTRA_NETWORKS_MAX_HEIGHT,
            });
            extraSection.style.flex = "0 0 auto";
        }
    };

    const fitPromptColumnToContent = () => {
        if (!panel?.isConnected) return;
        const activePreset = state.settings?.layout_preset || "default";
        const positiveFocus = activePreset === "positive_focus";
        const minimal = activePreset === "minimal_lora";
        const negativeCollapsed = negative.row?.classList?.contains("collapsed");
        const textareaTarget = positive.textarea;
        if (textareaTarget && !resizeTargetHidden(textareaTarget)) {
            const nextTextHeight = clampNumber(
                textareaTarget.scrollHeight + 4,
                positiveFocus ? 94 : 68,
                positiveFocus ? 150 : (minimal ? 130 : 112),
            );
            setResizeTargetHeight(textareaTarget, textareaTarget.__webuiBridgeHeightKey, nextTextHeight, {
                min: 48,
                max: textareaTarget.__webuiBridgeMaxHeight,
            });
        }
        const chipTarget = positive.row?.chips;
        if (chipTarget && !resizeTargetHidden(chipTarget) && !chipTarget.classList.contains("empty")) {
            const nextChipHeight = clampNumber(chipTarget.scrollHeight + 4, PROMPT_CHIPS_MIN_HEIGHT, positiveFocus ? 150 : 132);
            setResizeTargetHeight(chipTarget, chipTarget.__webuiBridgeHeightKey, nextChipHeight, {
                min: PROMPT_CHIPS_MIN_HEIGHT,
                max: chipTarget.__webuiBridgeMaxHeight,
            });
        }
        const promptInnerManualActive = promptInnerSplitManual || (performance?.now?.() || Date.now()) < suppressPromptInnerFitUntil;
        if (positiveTagPanel && !resizeTargetHidden(positiveTagPanel) && !promptInnerManualActive) {
            const nextTagHeight = minimal ? 190 : (positiveFocus ? 240 : (activePreset === "roomy" ? 360 : (activePreset === "compact" ? 150 : 190)));
            setResizeTargetHeight(positiveTagPanel, positiveTagPanel.__webuiBridgeHeightKey, nextTagHeight, {
                min: positiveTagPanel.__webuiBridgeMinHeight,
                max: positiveTagPanel.__webuiBridgeMaxHeight,
            });
        }
        window.requestAnimationFrame?.(() => {
            if (!topRow || resizeTargetHidden(topRow)) return;
            if (freshInitialLayoutPending()) return;
            if (nodeHasSavedUserBridgePanelSize(node) || bridgeConfiguredSizeLockActive(node)) return;
            if (promptLoraSplitManual || (performance?.now?.() || Date.now()) < suppressPromptSplitFitUntil) return;
            const presetTopTargets = {
                compact: 420,
                roomy: 840,
                positive_focus: 500,
                minimal_lora: 460,
                default: negativeCollapsed ? 560 : 620,
            };
            const preferredTop = presetTopTargets[activePreset] || presetTopTargets.default;
            const panelHeight = resizeTargetLayoutHeight(panel) || panel.getBoundingClientRect().height || 0;
            const splitter = panel.querySelector?.(".webui-bridge-panel-splitter");
            const panelStyle = getComputedStyle(panel);
            const paddingY = (Number.parseFloat(panelStyle.paddingTop) || 0) + (Number.parseFloat(panelStyle.paddingBottom) || 0);
            const rowGap = Number.parseFloat(panelStyle.rowGap || panelStyle.gap) || 0;
            const splitterHeight = splitter && !resizeTargetHidden(splitter) ? resizeTargetLayoutHeight(splitter) : 0;
            const extraHeight = !extraCollapsed && extraSection ? resizeTargetLayoutHeight(extraSection) : 42;
            const availableTop = panelHeight
                ? panelHeight - paddingY - getPanelTopControlsHeight() - splitterHeight - extraHeight - rowGap * (extraCollapsed ? 2 : 3)
                : preferredTop;
            const topMin = getTopRowVisibleMinHeight();
            const hardMax = Math.max(topMin, Math.min(getTopRowVisibleMaxHeight(), availableTop || preferredTop));
            const nextTopHeight = Math.ceil(clampNumber(preferredTop, topMin, hardMax));
            setResizeTargetHeight(topRow, topRowHeightKey, nextTopHeight, {
                min: topMin,
                max: topRow.__webuiBridgeMaxHeight,
            });
        });
    };

    let adaptiveLayoutScheduled = false;
    scheduleAdaptiveLayout = () => {
        if (adaptiveLayoutScheduled) return;
        adaptiveLayoutScheduled = true;
        window.requestAnimationFrame?.(() => {
            window.requestAnimationFrame?.(() => {
                adaptiveLayoutScheduled = false;
                ensurePanelSplitterVisible();
                fitPromptColumnToContent();
                ensurePanelSplitterVisible();
                const activePreset = state.settings?.layout_preset || "default";
                fitLoraSectionToVisibleRows(activePreset === "default" ? 2 : 1, {
                    fillAvailable: activePreset === "default" || activePreset === "roomy",
                });
                window.requestAnimationFrame?.(() => {
                    fitNodeBottomToVisibleContent();
                    window.requestAnimationFrame?.(fillExtraSectionToPanelBottom);
                });
            });
        });
    };
    panel.__webuiBridgeScheduleAdaptiveLayout = scheduleAdaptiveLayout;
    panel.__webuiBridgeSettleManualResizeLayout = settleManualResizeLayout;

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
        panel.__webuiBridgeDataLoaded = true;
        state.loras = data.loras;
        state.styles = data.styles;
        state.models = data.models;
        state.promptAllInOne = data.promptAllInOne;
        const shouldApplyFreshDefaults = node.__webuiBridgeFreshNode && !node.__webuiBridgeWasConfigured && !nodeHasSavedUserBridgePanelSize(node);
        state.settings = shouldApplyFreshDefaults
            ? { ...data.settings, layout_preset: "default" }
            : data.settings;
        state.customTagCount = data.customTagCount;
        state.assets = data.assets;
        renderStyles();
        renderModelSwitch();
        renderTree();
        renderCards();
        importUpstreamLoras();
        updateCounters();
        updateLayoutPresetControls();
        if (!node.__webuiBridgeInitialLayoutApplied) {
            node.__webuiBridgeInitialLayoutApplied = true;
            if (shouldApplyFreshDefaults) {
                applyLayoutPreset(state.settings?.layout_preset || "default", { preserveNodeSize: true });
            } else {
                setLayoutPresetClass(state.settings?.layout_preset || "default");
                scheduleAdaptiveLayout();
            }
        } else {
            setLayoutPresetClass(state.settings?.layout_preset || "default");
        }
        if (shouldApplyFreshDefaults && !node.__webuiBridgeFreshLayoutApplied) {
            node.__webuiBridgeFreshLayoutApplied = true;
        }
        positiveTagPanel.__webuiBridgeRender?.();
        negativeTagPanel.__webuiBridgeRender?.();
        const showedNodeTutorial = maybeShowNodeTutorial();
        if (!showedNodeTutorial) maybeShowStartupWizard();
        repairBridgePanelLayoutAfterWorkflow(node, "data-loaded");
    });

    renderModelSwitch();
    importUpstreamLoras();
    updateCounters();
    applyUiVisibility();
    panel.__webuiBridgeResetNodeLayoutCache = resetNodeLayoutCache;
    panel.__webuiBridgeImportUpstreamLoras = () => {
        const added = importUpstreamLoras();
        if (added) updateCounters();
        renderPromptPanels();
    };
    return panel;
}

function installWebUIPanel(node) {
    repairComfyCorePackageMetadata();
    repairBridgeNodeWidgetDefaults(node);
    if (node.__webuiBridgePanel) {
        const existingWidget = node.widgets?.find((widget) => widget.name === "webui_prompt_frontend");
        const usablePanel = existingWidget?.element === node.__webuiBridgePanel &&
            node.__webuiBridgePanel.querySelector?.(".webui-bridge-toprow, .webui-bridge-panel-error");
        if (usablePanel) {
            repairBridgeNodeWidgetDefaults(node);
            node.__webuiBridgePanel.style.display = "";
            const desired = resolveBridgePanelSizeForLiveState(node, { clearConfiguredLock: true });
            pinBridgeDomWidgetToTop(node, existingWidget);
            node.__webuiBridgeApplyDomWidgetSize?.(desired[0], desired[1]);
            if (Math.round(Number(node.size?.[0] || 0)) !== desired[0] ||
                Math.round(Number(node.size?.[1] || 0)) !== desired[1]) {
                node.setSize?.(desired);
            }
            if (shouldRepairBridgePanelSize(node.size)) {
                node.__webuiBridgePanel.__webuiBridgeResetNodeLayoutCache?.();
            }
            scheduleBridgeDomWidgetPin(node, existingWidget, node.__webuiBridgePanel);
            repairBridgePanelLayoutAfterWorkflow(node, "reuse-panel");
            return;
        }
        node.__webuiBridgePanel.__webuiBridgeSidebarResizeObserver?.disconnect?.();
        node.__webuiBridgePanel.remove?.();
        node.__webuiBridgePanel = null;
    }
    removeBridgeDomWidgets(node);
    repairBridgeNodeWidgetDefaults(node);
    if (!node.__webuiBridgeSetSizeWrapped && typeof node.setSize === "function") {
        const originalSetSize = node.setSize.bind(node);
        node.setSize = function (size) {
            if (Array.isArray(size) && Number.isFinite(size[0]) && Number.isFinite(size[1])) {
                const requestedNeedsRepair = shouldRepairBridgePanelSize(size);
                const currentWidth = Math.round(Number(node.size?.[0] || 0));
                const currentHeight = Math.round(Number(node.size?.[1] || 0));
                const desiredWidth = Math.round(Number(node.__webuiBridgeDesiredSize?.[0] || 0));
                const desiredHeight = Math.round(Number(node.__webuiBridgeDesiredSize?.[1] || 0));
                const desiredSize = node.__webuiBridgeDesiredSize
                    ? clampPanelSize(node.__webuiBridgeDesiredSize[0], node.__webuiBridgeDesiredSize[1])
                    : null;
                const repairFallback = desiredSize || clampPanelSize(
                    currentWidth || DEFAULT_PANEL_WIDTH,
                    currentHeight || DEFAULT_PANEL_HEIGHT,
                );
                const clamped = requestedNeedsRepair
                    ? [...repairFallback]
                    : clampPanelSize(size[0], size[1]);
                const rememberSize = Boolean(node.__webuiBridgeRememberNextSetSize);
                const managedSetSize = Boolean(node.__webuiBridgeManagedSetSize);
                const applyingConfiguredSize = Boolean(node.__webuiBridgeApplyingConfiguredSize);
                const managedSizeWrite = rememberSize ||
                    managedSetSize ||
                    applyingConfiguredSize ||
                    (desiredSize && bridgePanelSizesMatch(clamped, desiredSize, 1));
                const externalUserSize = !managedSizeWrite && !requestedNeedsRepair;
                if (currentWidth === clamped[0] && currentHeight === clamped[1] &&
                    desiredWidth === clamped[0] && desiredHeight === clamped[1]) {
                    node.__webuiBridgeApplyDomWidgetSize?.(clamped[0], clamped[1]);
                    window.requestAnimationFrame?.(() => node.__webuiBridgePanel?.__webuiBridgeScheduleAdaptiveLayout?.());
                    return node;
                }
                node.__webuiBridgeDesiredSize = clamped;
                if ((rememberSize || externalUserSize) && !applyingConfiguredSize) {
                    node.__webuiBridgeSavedPanelSize = [...clamped];
                    if (node.__webuiBridgeSetSizeIsUser || externalUserSize) {
                        node.__webuiBridgeUserSized = true;
                        node.__webuiBridgeFreshLayoutReleased = true;
                        node.__webuiBridgeFreshLayoutStabilizeUntil = 0;
                    }
                    node.__webuiBridgePreferConfiguredPanelSizeUntil = 0;
                }
                node.__webuiBridgeHoldNodeBottomFit?.();
                node.size = [...clamped];
                const result = originalSetSize(clamped);
                if (Math.round(Number(node.size?.[0] || 0)) !== clamped[0] ||
                    Math.round(Number(node.size?.[1] || 0)) !== clamped[1]) {
                    node.size = [...clamped];
                }
                node.__webuiBridgeApplyDomWidgetSize?.(clamped[0], clamped[1]);
                if (externalUserSize) {
                    node.__webuiBridgeHandleExternalNodeResize?.({
                        previousWidth: currentWidth,
                        previousHeight: currentHeight,
                        width: clamped[0],
                        height: clamped[1],
                    });
                } else {
                    window.requestAnimationFrame?.(() => node.__webuiBridgePanel?.__webuiBridgeScheduleAdaptiveLayout?.());
                }
                return result;
            }
            return originalSetSize(size);
        };
        node.__webuiBridgeSetSizeWrapped = true;
    }
    hideNativeWidgets(node);
    const hadRepairablePanelSize = shouldRepairBridgePanelSize(node.size);
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
            repairBridgeNodeWidgetDefaults(node);
            const desired = resolveBridgePanelSizeForLiveState(node, { clearConfiguredLock: true });
            data.size = [...desired];
            data.widgets_values = bridgePromptWidgetValuesFromNode(node);
        });
        node.__webuiBridgeSerializeWrapped = true;
    }
    if (nodeHasSavedUserBridgePanelSize(node)) {
        node.__webuiBridgeDesiredSize = normalizeBridgePanelSize(node.size);
    } else if (!node.__webuiBridgeDesiredSize) {
        node.__webuiBridgeDesiredSize = node.__webuiBridgeFreshNode && !node.__webuiBridgeWasConfigured
            ? clampPanelSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT)
            : looksLikeLegacyDefaultSize(node.size)
                ? clampPanelSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT)
            : shouldRepairBridgePanelSize(node.size)
                ? clampPanelSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT)
            : normalizeBridgePanelSize(node.size);
    } else if (shouldRepairBridgePanelSize(node.__webuiBridgeDesiredSize)) {
        node.__webuiBridgeDesiredSize = shouldRepairBridgePanelSize(node.size)
            ? clampPanelSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT)
            : normalizeBridgePanelSize(node.size);
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
        getMaxHeight: () => Math.max(280, PANEL_MAX_HEIGHT - DOM_WIDGET_PANEL_PAD),
    });
    installWidgetSerializationFallback(domWidget, () => null);
    pinBridgeDomWidgetToTop(node, domWidget);
    for (const widget of node.widgets || []) installWidgetSerializationFallback(widget);
    ensureGraphLinksSerializableCompatibility();
    const applyDomWidgetSize = (nodeWidth, nodeHeight) => {
        const [, clampedNodeHeight] = clampPanelSize(nodeWidth, nodeHeight);
        pinBridgeDomWidgetToTop(node, domWidget);
        const widgetWidth = Math.max(PANEL_MIN_WIDTH, nodeWidth - 20);
        const widgetHeight = Math.max(280, clampedNodeHeight - DOM_WIDGET_PANEL_PAD);
        panel.style.width = `${widgetWidth}px`;
        panel.style.height = `${widgetHeight}px`;
        syncBridgeDomWidgetWrapper(panel, widgetWidth, widgetHeight);
        window.requestAnimationFrame?.(() => syncBridgeDomWidgetWrapper(panel, widgetWidth, widgetHeight));
        return [widgetWidth, widgetHeight];
    };
    node.__webuiBridgeApplyDomWidgetSize = applyDomWidgetSize;
    domWidget.computeSize = (width) => {
        const desired = node.__webuiBridgeDesiredSize || node.size || [width || 1040, 820];
        const nodeWidth = desired[0] || width || 1040;
        const nodeHeight = desired[1] || 820;
        return applyDomWidgetSize(nodeWidth, nodeHeight);
    };
    applyDomWidgetSize(node.__webuiBridgeDesiredSize[0], node.__webuiBridgeDesiredSize[1]);
    node.__webuiBridgePanel = panel;
    scheduleBridgeDomWidgetPin(node, domWidget, panel);
    repairBridgePanelLayoutAfterWorkflow(node, "install-panel");
    node.resizable = true;
    if (nodeHasSavedUserBridgePanelSize(node)) {
        const savedSize = resolveBridgePanelSizeForLiveState(node, { clearConfiguredLock: true });
        const currentWidth = Math.round(Number(node.size?.[0] || 0));
        const currentHeight = Math.round(Number(node.size?.[1] || 0));
        if (currentWidth !== savedSize[0] || currentHeight !== savedSize[1]) {
            node.__webuiBridgeDesiredSize = [...savedSize];
            node.__webuiBridgeSavedPanelSize = [...savedSize];
            node.setSize(savedSize);
            applyDomWidgetSize(savedSize[0], savedSize[1]);
        }
    }
    if (hadRepairablePanelSize || node.__webuiBridgeRepairedPanelSize) {
        window.requestAnimationFrame?.(() => {
            panel.__webuiBridgeResetNodeLayoutCache?.();
            node.__webuiBridgeRepairedPanelSize = false;
        });
    }
    if (node.__webuiBridgeFreshNode && !node.__webuiBridgeWasConfigured && !nodeHasSavedUserBridgePanelSize(node) && !node.__webuiBridgeFreshSizeApplied) {
        const freshSize = shouldRepairBridgePanelSize(node.size)
            ? clampPanelSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT)
            : normalizeBridgePanelSize(node.size || node.__webuiBridgeDesiredSize);
        node.__webuiBridgeDesiredSize = [...freshSize];
        node.__webuiBridgeFreshSizeApplied = true;
        if (shouldRepairBridgePanelSize(node.size)) {
            node.setSize(freshSize);
        } else {
            applyDomWidgetSize(freshSize[0], freshSize[1]);
        }
    } else if (looksLikeLegacyDefaultSize(node.size)) {
        node.__webuiBridgeDesiredSize = clampPanelSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT);
        node.setSize(node.__webuiBridgeDesiredSize);
    } else if (!node.size || node.size[0] < PANEL_MIN_WIDTH || node.size[1] < PANEL_MIN_HEIGHT) {
        node.__webuiBridgeDesiredSize = clampPanelSize(node.size?.[0] || DEFAULT_PANEL_WIDTH, node.size?.[1] || DEFAULT_PANEL_HEIGHT);
        node.setSize(node.__webuiBridgeDesiredSize);
    } else if (node.size[0] > PANEL_MAX_WIDTH || node.size[1] > PANEL_MAX_HEIGHT) {
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
            width: 100% !important;
            min-width: 0;
            height: 100% !important;
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
        .webui-bridge-top-controls {
            flex: 0 0 auto;
            display: flex;
            align-items: center;
            flex-wrap: wrap;
            gap: 6px;
            min-height: 36px;
            padding: 5px;
            box-sizing: border-box;
            border: 1px solid rgba(105, 146, 205, .7);
            border-radius: 6px;
            background:
                linear-gradient(180deg, rgba(31, 48, 72, .96), rgba(20, 29, 43, .98));
            box-shadow:
                inset 0 0 0 1px rgba(166, 196, 255, .08),
                0 2px 10px rgba(0, 0, 0, .28);
            overflow: visible;
        }
        .webui-bridge-top-control,
        .webui-bridge-side-toggle,
        .webui-bridge-node-width-resizer {
            flex: 0 0 auto;
            min-width: 76px;
            height: 28px;
            margin: 0;
            padding: 0 10px;
            border: 1px solid rgba(116, 164, 238, .78);
            border-radius: 5px;
            background: #17365d;
            color: #f4f8ff;
            font-size: 12px;
            font-weight: 700;
            line-height: 1;
            cursor: pointer;
            box-shadow:
                inset 0 0 0 1px rgba(255, 255, 255, .08),
                0 2px 8px rgba(0, 0, 0, .32);
            touch-action: manipulation;
        }
        .webui-bridge-node-width-resizer {
            min-width: 96px;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            user-select: none;
            touch-action: none;
        }
        .webui-bridge-node-width-resizer.dragging {
            cursor: ew-resize;
            border-color: #d5e5ff;
            background: #28517f;
            box-shadow:
                0 0 0 2px rgba(128, 180, 255, .28),
                inset 0 0 0 1px rgba(255, 255, 255, .14),
                0 2px 8px rgba(0, 0, 0, .32);
        }
        .webui-bridge-node-width-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 14px;
        }
        .webui-bridge-top-control.primary {
            border-color: rgba(164, 198, 255, .95);
            background: linear-gradient(180deg, #265f9e, #174473);
        }
        .webui-bridge-top-control.help {
            border-color: rgba(193, 165, 255, .9);
            background: linear-gradient(180deg, #5a3f95, #33285d);
        }
        .webui-bridge-top-control:hover,
        .webui-bridge-side-toggle:hover {
            border-color: #d5e5ff;
            background: #28517f;
        }
        .webui-bridge-panel button:focus-visible,
        .webui-bridge-panel input:focus-visible,
        .webui-bridge-panel select:focus-visible,
        .webui-bridge-panel textarea:focus-visible,
        .webui-bridge-node-width-resizer:focus-visible,
        .webui-bridge-resize-grip:focus-visible,
        .webui-bridge-section-resizer:focus-visible {
            outline: 2px solid rgba(132, 184, 255, .95);
            outline-offset: 2px;
            box-shadow: 0 0 0 4px rgba(54, 112, 190, .28);
        }
        .webui-bridge-top-field,
        .webui-bridge-top-check {
            flex: 0 0 auto;
            display: inline-flex;
            align-items: center;
            gap: 5px;
            min-height: 26px;
            padding: 0 7px;
            box-sizing: border-box;
            border: 1px solid rgba(87, 112, 150, .78);
            border-radius: 5px;
            background: rgba(11, 17, 27, .55);
            color: #e8f0fb;
            font-size: 11px;
            white-space: nowrap;
        }
        .webui-bridge-top-field input[type="number"] {
            width: 58px;
            height: 22px;
            padding: 0 6px;
            box-sizing: border-box;
            border: 1px solid #566a85;
            border-radius: 4px;
            background: #111823;
            color: #f4f7fb;
        }
        .webui-bridge-top-check input[type="checkbox"] {
            width: 14px;
            height: 14px;
        }
        .lg-node:has(.webui-bridge-panel) .lg-node-widgets {
            position: absolute;
            left: 8px;
            right: 12px;
            top: 34px;
            bottom: 10px;
            width: auto;
            height: auto;
            padding-right: 0;
            display: block;
            z-index: 1;
        }
        .lg-node:has(.webui-bridge-panel) .lg-slot--output {
            position: relative;
            z-index: 20;
            pointer-events: auto;
            overflow: visible;
        }
        .lg-node:has(.webui-bridge-panel) .lg-slot--output > .relative {
            overflow: visible;
        }
        .lg-node:has(.webui-bridge-panel) .lg-slot--output .text-node-component-slot-text {
            position: absolute;
            z-index: 21;
            left: calc(100% + 18px);
            top: 50%;
            transform: translateY(-50%);
            max-width: none;
            padding: 0 4px;
            border-radius: 4px;
            background: rgba(17, 22, 32, .82);
            color: #eaf1fb;
            text-shadow: 0 1px 2px rgba(0, 0, 0, .9);
            overflow: visible;
            pointer-events: none;
            white-space: nowrap;
        }
        .lg-node:has(.webui-bridge-panel) .lg-slot--output .slot-dot {
            position: relative;
            z-index: 22;
        }
        .lg-node:has(.webui-bridge-panel) .lg-node-widgets > .lg-node-widget:not(:has(.webui-bridge-panel)) {
            display: none !important;
        }
        .lg-node:has(.webui-bridge-panel) .lg-node-widget:has(.webui-bridge-panel),
        .lg-node:has(.webui-bridge-panel) .lg-node-widget:has(.webui-bridge-panel) > div {
            width: 100%;
            height: 100%;
        }
        .lg-node:has(.webui-bridge-panel) .lg-node-widget:has(.webui-bridge-panel) {
            grid-template-rows: minmax(0, 1fr) !important;
        }
        .lg-node:has(.webui-bridge-panel) .lg-node-widget:has(.webui-bridge-panel) > div:not(:has(.webui-bridge-panel)) {
            display: none !important;
        }
        .lg-node:has(.webui-bridge-panel) .lg-node-widget:has(.webui-bridge-panel) > div:has(.webui-bridge-panel) {
            grid-column: 1 / -1 !important;
            grid-row: 1 !important;
        }
        .webui-bridge-dom-widget-shell {
            box-sizing: border-box !important;
            min-width: 0 !important;
            max-width: none !important;
            min-height: 0 !important;
            overflow: hidden !important;
        }
        .lg-node-widgets.webui-bridge-dom-widget-shell {
            position: absolute !important;
            left: 8px !important;
            right: 12px !important;
            top: 34px !important;
            bottom: 10px !important;
            width: auto !important;
            height: auto !important;
            padding-right: 0 !important;
            z-index: 1;
        }
        .lg-node-widget.webui-bridge-dom-widget-shell {
            display: grid !important;
            grid-template-rows: minmax(0, 1fr) !important;
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
            right: 8px;
            bottom: 8px;
            width: 38px;
            height: 38px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 1px solid #8ab8ff;
            border-radius: 8px;
            background:
                linear-gradient(135deg, rgba(47, 115, 217, .96), rgba(18, 36, 58, .96));
            color: #f7fbff;
            cursor: nwse-resize;
            touch-action: none;
            pointer-events: auto;
            user-select: none;
            z-index: 70;
            font-size: 19px;
            font-weight: 900;
            line-height: 1;
            text-shadow: 0 1px 2px rgba(0, 0, 0, .7);
            box-shadow:
                0 0 0 2px rgba(118, 172, 255, .2),
                0 8px 20px rgba(0, 0, 0, .36),
                inset 0 0 0 1px rgba(255, 255, 255, .16);
        }
        .webui-bridge-resize-grip::before {
            content: "";
            position: absolute;
            right: 7px;
            bottom: 7px;
            width: 15px;
            height: 15px;
            border-right: 3px solid rgba(255, 255, 255, .88);
            border-bottom: 3px solid rgba(255, 255, 255, .88);
            border-radius: 0 0 3px 0;
            pointer-events: none;
        }
        .webui-bridge-resize-grip:hover,
        .webui-bridge-resize-grip.dragging {
            border-color: #c7dcff;
            background:
                linear-gradient(135deg, rgba(61, 134, 240, 1), rgba(28, 64, 106, 1));
            box-shadow:
                0 0 0 3px rgba(118, 172, 255, .32),
                0 10px 24px rgba(0, 0, 0, .42),
                inset 0 0 0 1px rgba(255, 255, 255, .22);
        }
        .webui-bridge-section-resizer {
            flex: 0 0 8px;
            min-height: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: ns-resize;
            touch-action: none;
            background:
                linear-gradient(to bottom, rgba(255, 255, 255, 0.02), rgba(0, 0, 0, 0.12)),
                repeating-linear-gradient(90deg, transparent 0 7px, rgba(134, 156, 190, .32) 7px 9px, transparent 9px 16px);
            border-top: 1px solid rgba(84, 99, 124, .5);
            border-bottom: 1px solid rgba(0, 0, 0, .22);
            box-sizing: border-box;
            user-select: none;
        }
        .webui-bridge-section-resizer:hover,
        .webui-bridge-section-resizer.dragging {
            background:
                linear-gradient(to bottom, rgba(106, 163, 255, 0.14), rgba(20, 47, 82, 0.16)),
                repeating-linear-gradient(90deg, transparent 0 7px, rgba(156, 194, 255, .72) 7px 9px, transparent 9px 16px);
            box-shadow:
                inset 0 0 0 1px rgba(148, 194, 255, .22),
                0 0 0 1px rgba(84, 142, 230, .18);
        }
        .webui-bridge-split-resizer {
            position: relative;
            z-index: 2;
        }
        .webui-bridge-split-resizer.has-label {
            flex-basis: 14px;
            min-height: 14px;
        }
        .webui-bridge-resizer-label {
            pointer-events: none;
            max-width: calc(100% - 20px);
            height: 12px;
            padding: 0 7px;
            border: 1px solid rgba(106, 132, 170, .62);
            border-radius: 999px;
            background: rgba(21, 29, 42, .94);
            color: #cbd7ea;
            font-size: 9px;
            font-weight: 700;
            line-height: 12px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            box-shadow: 0 1px 4px rgba(0, 0, 0, .22);
        }
        .webui-bridge-section-resizer:hover .webui-bridge-resizer-label {
            border-color: rgba(136, 181, 255, .92);
            color: #eef6ff;
            background: rgba(28, 48, 78, .96);
        }
        .webui-bridge-negative-main-resizer .webui-bridge-resizer-label {
            border-color: rgba(164, 132, 211, .6);
            background: rgba(40, 31, 58, .94);
            color: #eadcff;
        }
        .webui-bridge-negative-main-resizer {
            flex: 0 0 ${COLLAPSED_NEGATIVE_SPLIT_GRIP_HEIGHT}px;
            min-height: ${COLLAPSED_NEGATIVE_SPLIT_GRIP_HEIGHT}px;
            position: sticky;
            bottom: 0;
            z-index: 18;
            border: 1px solid rgba(154, 120, 218, .66);
            border-radius: 4px;
            background:
                linear-gradient(to bottom, rgba(74, 52, 112, .32), rgba(27, 22, 40, .9)),
                repeating-linear-gradient(90deg, transparent 0 7px, rgba(205, 178, 248, .5) 7px 9px, transparent 9px 16px);
            box-shadow:
                0 -3px 10px rgba(0, 0, 0, .2),
                inset 0 0 0 1px rgba(234, 220, 255, .1);
        }
        .webui-bridge-negative-detail-resizer .webui-bridge-resizer-label {
            border-color: rgba(205, 131, 143, .62);
            background: rgba(55, 29, 38, .94);
            color: #ffdce3;
        }
        .webui-bridge-panel-splitter {
            flex: 0 0 ${PANEL_SPLIT_GRIP_HEIGHT}px;
            min-height: ${PANEL_SPLIT_GRIP_HEIGHT}px;
            margin: -2px 0 -2px;
            border-top: 2px solid rgba(112, 143, 190, .8);
            border-bottom: 2px solid rgba(30, 38, 52, .95);
            border-radius: 4px;
            z-index: 20;
            box-shadow:
                0 -3px 10px rgba(0, 0, 0, .22),
                0 3px 10px rgba(0, 0, 0, .18),
                inset 0 0 0 1px rgba(142, 183, 255, .12);
        }
        .webui-bridge-panel-splitter.has-label {
            flex-basis: ${PANEL_SPLIT_GRIP_HEIGHT}px;
            min-height: ${PANEL_SPLIT_GRIP_HEIGHT}px;
        }
        .webui-bridge-panel-splitter .webui-bridge-resizer-label {
            border-color: rgba(117, 163, 255, .75);
            background: rgba(22, 48, 82, .96);
            color: #dbeafe;
        }
        .webui-bridge-size-controls {
            display: grid;
            grid-template-columns: repeat(2, minmax(72px, 1fr)) 32px 32px 32px minmax(56px, 1fr);
            gap: 5px;
        }
        .webui-bridge-size-field {
            min-width: 0;
            height: 28px;
            display: grid;
            grid-template-columns: auto minmax(0, 1fr);
            align-items: center;
            gap: 4px;
            padding: 0 5px;
            box-sizing: border-box;
            border: 1px solid #4d5666;
            border-radius: 5px;
            background: #141b26;
            color: #dce7f5;
            font-size: 11px;
        }
        .webui-bridge-size-field input {
            width: 100%;
            min-width: 0;
            height: 22px;
            padding: 0 4px;
            box-sizing: border-box;
            border: 1px solid #566a85;
            border-radius: 4px;
            background: #0d131d;
            color: #f4f7fb;
            font-size: 11px;
        }
        .webui-bridge-size-controls button {
            height: 28px;
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
            grid-template-columns: repeat(auto-fit, minmax(58px, 1fr));
            gap: 4px;
            padding: 5px;
            border: 1px solid #3d4a5d;
            border-radius: 6px;
            background: #151c27;
        }
        .webui-bridge-layout-preset {
            min-width: 0;
            min-height: 30px;
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
            --webui-bridge-sidebar-width: ${ACTION_SIDEBAR_DEFAULT_WIDTH}px;
            --webui-bridge-sidebar-grip-width: 30px;
            grid-template-columns: minmax(0, 1fr) var(--webui-bridge-sidebar-grip-width) var(--webui-bridge-sidebar-width);
            gap: 6px;
            flex: 1 1 auto;
            min-height: 0;
            max-height: none;
            overflow: hidden;
        }
        .webui-bridge-toprow.action-collapsed {
            grid-template-columns: minmax(0, 1fr);
        }
        .webui-bridge-toprow.negative-collapsed {
            align-items: stretch;
            flex: 0 0 auto;
            min-height: 0;
            overflow: hidden;
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
            overflow: hidden auto;
        }
        .webui-bridge-prompts.negative-collapsed .webui-bridge-negative-main-resizer {
            z-index: 18;
            margin: -2px 0 0;
            border: 1px solid rgba(154, 120, 218, .78);
            border-radius: 4px;
            background:
                linear-gradient(to bottom, rgba(96, 69, 145, .45), rgba(36, 27, 54, .92)),
                repeating-linear-gradient(90deg, transparent 0 7px, rgba(214, 188, 255, .72) 7px 9px, transparent 9px 16px);
            box-shadow:
                0 -4px 12px rgba(0, 0, 0, .25),
                inset 0 0 0 1px rgba(234, 220, 255, .12);
        }
        .webui-bridge-prompts.negative-collapsed .webui-bridge-negative-detail-resizer,
        .webui-bridge-prompts.negative-collapsed .webui-bridge-aio-negative {
            display: none;
        }
        .webui-bridge-prompts.negative-collapsed .webui-bridge-aio-positive {
            flex: 0 0 auto;
        }
        .webui-bridge-side-resizer {
            position: relative;
            align-self: stretch;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            width: var(--webui-bridge-sidebar-grip-width);
            min-width: var(--webui-bridge-sidebar-grip-width);
            padding-top: 10px;
            box-sizing: border-box;
            border: 1px solid #46658f;
            border-radius: 6px;
            cursor: ew-resize;
            touch-action: none;
            user-select: none;
            background:
                linear-gradient(to right, rgba(12, 18, 28, .68), rgba(28, 45, 68, .94), rgba(12, 18, 28, .68));
            box-shadow:
                inset 0 0 0 1px rgba(128, 171, 236, .12),
                0 1px 8px rgba(0, 0, 0, .25);
            z-index: 4;
        }
        .webui-bridge-side-resizer::after {
            content: "";
            position: absolute;
            top: 52px;
            bottom: 10px;
            left: 50%;
            width: 2px;
            transform: translateX(-50%);
            border-radius: 2px;
            background: repeating-linear-gradient(
                to bottom,
                rgba(164, 191, 232, .45) 0 8px,
                transparent 8px 14px
            );
        }
        .webui-bridge-side-resizer-handle {
            position: sticky;
            top: 8px;
            z-index: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 2px;
            width: 24px;
            height: 42px;
            padding: 4px 2px;
            box-sizing: border-box;
            border: 1px solid #6f9fe4;
            border-radius: 6px;
            background: #203a61;
            color: #eff6ff;
            box-shadow: 0 2px 8px rgba(0, 0, 0, .32);
            cursor: ew-resize;
            pointer-events: auto;
        }
        .webui-bridge-side-resizer-icon {
            flex: 0 0 auto;
            font-size: 13px;
            line-height: 1;
        }
        .webui-bridge-side-resizer-text {
            display: none;
        }
        .webui-bridge-side-resizer:hover,
        .webui-bridge-side-resizer.dragging {
            background:
                linear-gradient(to right, rgba(28, 48, 78, .95), rgba(58, 102, 164, .96), rgba(28, 48, 78, .95));
            border-color: #7db2ff;
        }
        .webui-bridge-side-resizer:hover .webui-bridge-side-resizer-handle,
        .webui-bridge-side-resizer.dragging .webui-bridge-side-resizer-handle {
            background: #2f5f9e;
            border-color: #b8d5ff;
        }
        .webui-bridge-side-resizer.collapsed {
            display: none !important;
        }
        body.webui-bridge-resizing-sidebar {
            cursor: ew-resize !important;
            user-select: none !important;
        }
        .webui-bridge-sidebar-width-button {
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 7px;
            min-width: 0;
            border: 1px solid #7db2ff;
            border-radius: 6px;
            background: #2f73d9;
            color: #f7fbff;
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, .12);
            cursor: ew-resize;
            font-weight: 700;
        }
        .webui-bridge-sidebar-width-button:hover,
        .webui-bridge-sidebar-width-button.dragging {
            border-color: #b8d5ff;
            background: #3d86f0;
        }
        .webui-bridge-sidebar-width-icon {
            flex: 0 0 auto;
            font-size: 15px;
            line-height: 1;
        }
        .webui-bridge-sidebar-width-text {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            letter-spacing: 0;
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
        .webui-bridge-collapse-btn {
            min-width: 66px;
            border-color: #9b75dc;
            background: #3b2760;
            color: #f5eaff;
            font-weight: 800;
            box-shadow:
                inset 0 0 0 1px rgba(255, 255, 255, .08),
                0 0 0 1px rgba(155, 117, 220, .28);
        }
        .webui-bridge-collapse-btn:hover {
            border-color: #d4b7ff;
            background: #56378d;
            color: #fff;
            box-shadow:
                inset 0 0 0 1px rgba(255, 255, 255, .12),
                0 0 0 2px rgba(155, 117, 220, .28);
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
        .webui-bridge-prompt-separator-chip {
            min-width: 54px;
            max-width: 86px;
            border-color: #355d91;
            background: #182940;
            color: #d6e9ff;
            cursor: pointer;
        }
        .webui-bridge-prompt-separator-chip:hover {
            border-color: #78b8ff;
            background: #20395b;
        }
        .webui-bridge-separator-main,
        .webui-bridge-separator-label {
            display: block;
            height: 19px;
            padding: 2px 6px;
            box-sizing: border-box;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .webui-bridge-separator-main {
            color: #8fc4ff;
            text-align: center;
            font: 700 12px/15px Consolas, Monaco, monospace;
            font-weight: 700;
        }
        .webui-bridge-separator-label {
            color: #a9cfff;
            text-align: center;
            background: rgba(119, 181, 255, .12);
            font-size: 11px;
            line-height: 15px;
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
        .webui-bridge-chip-tools-toggle {
            position: absolute;
            z-index: 34;
            right: 3px;
            bottom: 3px;
            width: 18px;
            height: 18px;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 0;
            border: 1px solid rgba(139, 185, 255, .72);
            border-radius: 4px;
            background: rgba(17, 24, 36, .9);
            color: #eef6ff;
            cursor: pointer;
            font: 700 13px/1 Arial, sans-serif;
            box-shadow: 0 2px 7px rgba(0, 0, 0, .32);
        }
        .webui-bridge-prompt-chip:hover .webui-bridge-chip-tools-toggle,
        .webui-bridge-prompt-chip.show-tools .webui-bridge-chip-tools-toggle {
            display: flex;
        }
        .webui-bridge-chip-tools-toggle:hover {
            border-color: #c7dcff;
            background: #24466f;
        }
        .webui-bridge-chip-tools {
            position: absolute;
            z-index: 80;
            left: -1px;
            top: calc(100% + 2px);
            display: none;
            align-items: center;
            flex-wrap: nowrap;
            gap: 2px;
            max-width: 420px;
            padding: 3px;
            box-sizing: border-box;
            border: 1px solid #465267;
            border-radius: 4px;
            background: #101620;
            box-shadow: 0 7px 18px rgba(0, 0, 0, 0.34);
            white-space: nowrap;
            overflow-x: auto;
            overflow-y: hidden;
            scrollbar-width: thin;
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
        .webui-bridge-prompt-chip.show-tools .webui-bridge-chip-tools {
            display: flex;
        }
        .webui-bridge-chip-tool {
            flex: 0 0 auto;
            min-width: 20px;
            height: 20px;
            padding: 0 3px;
            border: 1px solid #3a4658;
            border-radius: 3px;
            background: #202837;
            color: #d9e4f5;
            font: 11px/17px Arial, sans-serif;
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
            flex: 0 0 42px;
            width: 42px;
            height: 20px;
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
            width: 100%;
            justify-self: stretch;
            min-width: 0;
            min-height: 0;
            box-sizing: border-box;
            padding-right: 2px;
            overflow: auto;
        }
        .webui-bridge-action-column > * {
            min-width: 0;
        }
        .webui-bridge-action-column.collapsed {
            display: none !important;
        }
        .webui-bridge-generate {
            height: 52px;
            min-height: 48px;
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
        .webui-bridge-regional-section {
            border: 1px solid #3e4654;
            border-radius: 5px;
            background: #171a20;
            color: #cbd4e1;
            font-size: 11px;
        }
        .webui-bridge-regional-section summary {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 6px;
            cursor: pointer;
            font-weight: 700;
        }
        .webui-bridge-regional-section summary input {
            width: 14px;
            height: 14px;
            margin: 0;
            accent-color: #2f73d9;
        }
        .webui-bridge-regional-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 5px;
            padding: 0 6px 6px;
        }
        .webui-bridge-regional-grid label {
            display: flex;
            align-items: center;
            gap: 5px;
            min-width: 0;
        }
        .webui-bridge-regional-grid input[type="number"],
        .webui-bridge-regional-grid input[type="text"],
        .webui-bridge-regional-grid select,
        .webui-bridge-regional-ratios,
        .webui-bridge-regional-select {
            min-width: 0;
            width: 100%;
            height: 24px;
            padding: 2px 5px;
            box-sizing: border-box;
            border: 1px solid #4d5666;
            border-radius: 4px;
            background: #111318;
            color: #f2f4f8;
        }
        .webui-bridge-regional-canvas-row {
            grid-column: 1 / -1;
            display: grid !important;
            grid-template-columns: auto auto auto minmax(0, 1fr) auto minmax(0, 1fr) 28px;
            align-items: center;
            gap: 5px;
        }
        .webui-bridge-regional-canvas-row input[type="checkbox"] {
            width: 14px;
            height: 14px;
            margin: 0;
            accent-color: #2f73d9;
        }
        .webui-bridge-regional-canvas-size {
            text-align: center;
        }
        .webui-bridge-regional-canvas-times,
        .webui-bridge-regional-canvas-source {
            color: #94a3b8;
            font-size: var(--webui-bridge-font-size-mini, 10px);
            white-space: nowrap;
        }
        .webui-bridge-regional-detect {
            width: 28px;
            height: 24px;
            padding: 0;
            border: 1px solid #4d5666;
            border-radius: 4px;
            background: #202633;
            color: #dbeafe;
            cursor: pointer;
            line-height: 1;
        }
        .webui-bridge-regional-detect:hover {
            border-color: #6aa3ff;
            background: #26344a;
        }
        .webui-bridge-regional-actions {
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 0 6px 6px;
            min-width: 0;
        }
        .webui-bridge-regional-status {
            flex: 1 1 auto;
            min-width: 0;
            color: #aeb8c8;
            line-height: 1.25;
        }
        .webui-bridge-regional-status.error {
            color: #ff9aa2;
        }
        .webui-bridge-regional-preview-frame {
            margin: 0 6px 6px;
            padding: 4px;
            border: 1px solid #323946;
            border-radius: 4px;
            background: #101318;
        }
        .webui-bridge-regional-preview-meta {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            margin: 0 1px 4px;
            color: #aeb8c8;
            font-size: var(--webui-bridge-font-size-mini, 10px);
            line-height: 1.2;
            min-width: 0;
        }
        .webui-bridge-regional-preview-meta span:last-child {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            text-align: right;
        }
        .webui-bridge-regional-preview {
            display: flex;
            flex-direction: column;
            gap: 2px;
            width: auto;
            height: 112px;
            max-width: 100%;
            margin: 0 auto;
            padding: 3px;
            border: 1px solid #323946;
            border-radius: 4px;
            background: #101318;
            aspect-ratio: var(--webui-bridge-regional-aspect, 1 / 1);
        }
        .webui-bridge-regional-preview-row {
            display: flex;
            flex: 1 1 0;
            gap: 2px;
            min-height: 0;
        }
        .webui-bridge-regional-preview-cell {
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 12px;
            border: 1px solid #5073a6;
            border-radius: 3px;
            background: #1d395e;
            color: #dbeafe;
            font-size: 10px;
            overflow: hidden;
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
            grid-template-columns: minmax(0, 1fr) repeat(5, 28px);
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
        .webui-bridge-style-edit .webui-bridge-tool {
            width: 28px;
            height: 30px;
            font-size: 13px;
            font-weight: 700;
        }
        .webui-bridge-style-dialog {
            width: min(760px, calc(100vw - 48px));
        }
        .webui-bridge-style-dialog .webui-bridge-config-body {
            grid-template-columns: 1fr;
        }
        .webui-bridge-style-dialog-textarea {
            min-height: 92px;
            resize: vertical;
            box-sizing: border-box;
            padding: 9px 10px;
            border: 1px solid #40506a;
            border-radius: 6px;
            background: #090e16;
            color: #f3f6fb;
            font: 13px/1.45 Consolas, Monaco, monospace;
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
        .webui-bridge-status.warning {
            color: #ffd58a;
        }
        .webui-bridge-status.warning.visible {
            border-color: #8a6a30;
            background: #2a2112;
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
            align-items: stretch;
            height: 0;
            min-height: 0;
            flex: 1 1 0;
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
            height: 0;
            flex: 1 1 0;
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
            height: 100%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        .webui-bridge-network-tree {
            min-width: 0;
            min-height: 0;
            height: 100%;
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
            .webui-bridge-top-controls {
                align-items: stretch;
            }
            .webui-bridge-top-control,
            .webui-bridge-side-toggle {
                flex: 1 1 110px;
            }
            .webui-bridge-top-field,
            .webui-bridge-top-check {
                flex: 1 1 120px;
                justify-content: center;
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
            width: min(860px, calc(100vw - 48px));
            max-height: calc(100vh - 48px);
            display: grid;
            grid-template-rows: auto minmax(0, 1fr) auto;
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
            padding: 18px 22px;
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
            gap: 16px;
            max-height: none;
            overflow: auto;
            padding: 22px;
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
        .webui-bridge-ui-hidden {
            display: none !important;
        }
        .webui-bridge-settings-section {
            display: grid;
            gap: 14px;
            min-width: 0;
            padding: 18px;
            border: 1px solid #33435a;
            border-radius: 6px;
            background: #0d121b;
        }
        .webui-bridge-settings-title {
            display: grid;
            gap: 4px;
        }
        .webui-bridge-settings-title small {
            color: #aebed4;
            font-size: 12px;
            font-weight: 500;
        }
        .webui-bridge-settings-hero {
            display: grid;
            grid-template-columns: minmax(220px, 1fr) minmax(360px, 1.3fr);
            gap: 16px;
            align-items: stretch;
            padding: 18px;
            border: 1px solid #3d536f;
            border-radius: 8px;
            background: #162130;
        }
        .webui-bridge-settings-hero > div:first-child {
            display: grid;
            gap: 8px;
            align-content: center;
        }
        .webui-bridge-settings-hero b {
            color: #ffffff;
            font-size: 18px;
        }
        .webui-bridge-settings-hero span {
            color: #c6d5e8;
            font-size: 13px;
            line-height: 1.55;
        }
        .webui-bridge-settings-preset-row {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
        }
        .webui-bridge-settings-preset {
            display: grid;
            gap: 5px;
            min-width: 0;
            min-height: 74px;
            padding: 12px;
            border: 1px solid #506684;
            border-radius: 8px;
            background: #101826;
            color: #f3f6fb;
            text-align: left;
            cursor: pointer;
        }
        .webui-bridge-settings-preset:hover {
            border-color: #70a7ff;
            background: #172437;
        }
        .webui-bridge-settings-preset.active {
            border-color: #7fb4ff;
            background: #1d2d43;
            box-shadow: inset 0 0 0 1px rgba(127, 180, 255, 0.45);
        }
        .webui-bridge-settings-preset b {
            font-size: 14px;
        }
        .webui-bridge-settings-preset span {
            color: #abc0d8;
            font-size: 12px;
            line-height: 1.35;
        }
        .webui-bridge-settings-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
        }
        .webui-bridge-settings-section-title {
            display: grid;
            gap: 5px;
        }
        .webui-bridge-settings-section h3 {
            margin: 0;
            color: #f3f6fb;
            font-size: 16px;
            line-height: 1.25;
        }
        .webui-bridge-settings-section-title p {
            margin: 0;
            color: #aebed4;
            font-size: 12px;
            line-height: 1.45;
        }
        .webui-bridge-visibility-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
        }
        .webui-bridge-config-body label.webui-bridge-visibility-check {
            min-width: 0;
            min-height: 38px;
            padding: 8px 10px;
            border: 1px solid #28384d;
            border-radius: 6px;
            background: #101a28;
            font-weight: 600;
        }
        .webui-bridge-config-body label.webui-bridge-visibility-check span {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .webui-bridge-settings-asset-tools {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 10px;
        }
        .webui-bridge-settings-asset-tools button,
        .webui-bridge-settings-asset-card button {
            min-height: 38px;
            min-width: 0;
            padding: 8px 10px;
            border: 1px solid #40506a;
            border-radius: 7px;
            background: #243146;
            color: #f3f6fb;
            cursor: pointer;
            font-weight: 700;
        }
        .webui-bridge-settings-asset-tools button:hover,
        .webui-bridge-settings-asset-card button:hover {
            border-color: #70a7ff;
            filter: brightness(1.06);
        }
        .webui-bridge-settings-asset-tools button:disabled,
        .webui-bridge-settings-asset-card button:disabled {
            cursor: default;
            opacity: .58;
            filter: none;
        }
        .webui-bridge-settings-asset-tools button.downloading,
        .webui-bridge-settings-asset-card button.downloading,
        .webui-bridge-module-button.downloading {
            border-color: #f5bf4f;
            background: #614719;
            color: #fff5d6;
            opacity: 1;
            box-shadow: 0 0 0 3px rgba(245, 191, 79, .18);
            animation: webui-bridge-download-pulse 1.1s ease-in-out infinite;
        }
        .webui-bridge-settings-assets {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
        }
        .webui-bridge-settings-asset-card {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 112px;
            gap: 12px;
            align-items: center;
            min-width: 0;
            padding: 12px;
            border: 1px solid #2d3d52;
            border-radius: 8px;
            background: #111b29;
        }
        .webui-bridge-settings-asset-card.downloading {
            border-color: #f5bf4f;
            background: #1f1a10;
            box-shadow: 0 0 0 3px rgba(245, 191, 79, .14);
        }
        .webui-bridge-settings-asset-card b {
            display: block;
            margin-bottom: 4px;
            color: #f4f8ff;
            font-size: 13px;
        }
        .webui-bridge-settings-asset-card p {
            margin: 0 0 7px;
            color: #aebed4;
            font-size: 12px;
            line-height: 1.45;
        }
        .webui-bridge-settings-asset-status {
            display: block;
            color: #b6d0ff;
            font-size: 12px;
            line-height: 1.35;
        }
        .webui-bridge-modules {
            display: grid;
            gap: 8px;
        }
        .webui-bridge-module-section {
            padding: 8px;
            border: 1px solid rgba(83, 112, 156, .8);
            border-radius: 6px;
            background: #121b29;
        }
        .webui-bridge-module-section summary {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            color: #e7f0ff;
            font-weight: 800;
            line-height: 1.3;
        }
        .webui-bridge-module-section summary input {
            width: 18px;
            height: 18px;
        }
        .webui-bridge-module-badge {
            padding: 2px 7px;
            border: 1px solid #40506a;
            border-radius: 999px;
            color: #b6d0ff;
            font-size: 10px;
            font-weight: 800;
        }
        .webui-bridge-module-body {
            display: grid;
            gap: 8px;
            margin-top: 8px;
        }
        .webui-bridge-module-body label {
            display: grid;
            grid-template-columns: 52px minmax(0, 1fr);
            gap: 8px;
            align-items: center;
            color: #cbd7e9;
            font-weight: 700;
        }
        .webui-bridge-module-body label.webui-bridge-module-check {
            display: flex;
            grid-template-columns: none;
        }
        .webui-bridge-module-grid,
        .webui-bridge-module-actions {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
        }
        .webui-bridge-module-grid label {
            grid-template-columns: 48px minmax(0, 1fr);
        }
        .webui-bridge-module-input {
            width: 100%;
            min-width: 0;
            min-height: 32px;
            box-sizing: border-box;
            padding: 6px 8px;
            border: 1px solid #40506a;
            border-radius: 6px;
            background: #0d121b;
            color: #f3f6fb;
        }
        .webui-bridge-module-note {
            color: #a9bdd8;
            font-size: 11px;
            line-height: 1.45;
        }
        .webui-bridge-module-button,
        .webui-bridge-preset-list button {
            min-height: 30px;
            min-width: 0;
            padding: 6px 8px;
            border: 1px solid #40506a;
            border-radius: 6px;
            background: #243146;
            color: #f3f6fb;
            cursor: pointer;
            font-weight: 700;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .webui-bridge-module-button:hover,
        .webui-bridge-preset-list button:hover {
            border-color: #5d9bff;
            filter: brightness(1.08);
        }
        .webui-bridge-module-button-secondary {
            background: #182236;
            color: #c9d6ea;
        }
        .webui-bridge-module-button:disabled {
            cursor: default;
            opacity: .48;
            filter: none;
        }
        .webui-bridge-module-button.downloading:disabled {
            opacity: 1;
        }
        .webui-bridge-settings-panel {
            width: min(1040px, calc(100vw - 48px));
        }
        .webui-bridge-settings-panel .webui-bridge-config-body {
            gap: 18px;
            padding: 24px;
        }
        .webui-bridge-settings-panel .webui-bridge-config-input {
            min-height: 40px;
            font-size: 14px;
        }
        .webui-bridge-settings-panel .webui-bridge-config-status {
            min-height: 24px;
            font-size: 13px;
        }
        .webui-bridge-settings-panel .webui-bridge-config-actions {
            padding: 18px 24px 22px;
            grid-template-columns: repeat(6, minmax(0, 1fr));
        }
        .webui-bridge-settings-panel .webui-bridge-config-actions button {
            min-height: 44px;
            font-size: 14px;
        }
        .webui-bridge-module-dialog {
            width: min(760px, calc(100vw - 48px));
        }
        .webui-bridge-region-table {
            display: grid;
            grid-template-columns: 72px minmax(0, 1fr) minmax(0, 1fr);
            gap: 8px;
            align-items: start;
        }
        .webui-bridge-region-table b {
            padding-top: 8px;
            color: #dce6f5;
        }
        .webui-bridge-preset-list {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
        }
        .webui-bridge-tutorial-panel {
            width: min(1040px, calc(100vw - 42px));
        }
        .webui-bridge-tutorial-hero {
            display: grid;
            gap: 10px;
            padding: 16px;
            border: 1px solid #48658b;
            border-radius: 8px;
            background: #162130;
        }
        .webui-bridge-tutorial-hero b {
            color: #ffffff;
            font-size: 18px;
            line-height: 1.25;
        }
        .webui-bridge-tutorial-hero span {
            color: #c6d5e8;
            font-size: 13px;
            line-height: 1.5;
        }
        .webui-bridge-tutorial-flow {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 8px;
        }
        .webui-bridge-tutorial-flow b {
            padding: 7px 10px;
            border: 1px solid #5f789f;
            border-radius: 7px;
            background: #0f1826;
            color: #eaf3ff;
            font-size: 12px;
        }
        .webui-bridge-tutorial-arrow {
            color: #8db7f3;
            font-weight: 900;
        }
        .webui-bridge-tutorial-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 10px;
        }
        .webui-bridge-tutorial-grid section {
            min-width: 0;
            padding: 10px;
            border: 1px solid rgba(88, 123, 174, .72);
            border-radius: 6px;
            background: linear-gradient(180deg, rgba(23, 34, 50, .98), rgba(14, 20, 31, .98));
        }
        .webui-bridge-tutorial-card-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            margin-bottom: 7px;
        }
        .webui-bridge-tutorial-card-head span {
            flex: 0 0 auto;
            padding: 2px 6px;
            border: 1px solid #5d779d;
            border-radius: 999px;
            background: #101a28;
            color: #bcd6ff;
            font-size: 10px;
            font-weight: 800;
        }
        .webui-bridge-tutorial-grid h3 {
            margin: 0;
            color: #f2f7ff;
            font-size: 13px;
            line-height: 1.25;
        }
        .webui-bridge-tutorial-grid ul {
            margin: 0;
            padding-left: 17px;
        }
        .webui-bridge-tutorial-grid li {
            margin: 0 0 5px;
            color: #c6d3e7;
            font-size: 12px;
            line-height: 1.5;
        }
        .webui-bridge-tutorial-grid li:last-child {
            margin-bottom: 0;
        }
        .webui-bridge-prompt-settings .webui-bridge-config-actions {
            grid-template-columns: 1fr;
        }
        .webui-bridge-settings-panel .webui-bridge-config-actions {
            grid-template-columns: repeat(6, minmax(0, 1fr));
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
        .webui-bridge-image-input-panel {
            box-sizing: border-box;
            display: grid;
            gap: 10px;
            width: 100%;
            height: 100%;
            padding: 12px;
            border: 1px solid #31445d;
            border-radius: 8px;
            background: #111a26;
            color: #edf4ff;
            font-size: 12px;
            overflow: hidden;
        }
        .webui-bridge-image-input-head {
            display: grid;
            gap: 2px;
        }
        .webui-bridge-image-input-head strong {
            font-size: 14px;
        }
        .webui-bridge-image-input-head small,
        .webui-bridge-image-input-status {
            color: #aebed4;
            line-height: 1.35;
        }
        .webui-bridge-image-input-preview {
            position: relative;
            display: grid;
            place-items: center;
            min-height: 190px;
            border: 1px dashed #58708e;
            border-radius: 8px;
            background: #0b111a;
            color: #8fa6c4;
            overflow: hidden;
        }
        .webui-bridge-module-body .webui-bridge-image-input-panel {
            height: auto;
            padding: 10px;
            border-color: #2b3a50;
        }
        .webui-bridge-module-body .webui-bridge-image-input-preview {
            min-height: 170px;
        }
        .webui-bridge-image-input-preview.dragging {
            border-color: #79b8ff;
            background: #122139;
        }
        .webui-bridge-image-input-preview.disabled {
            opacity: .56;
            filter: grayscale(.45);
        }
        .webui-bridge-image-input-enable {
            padding: 7px 9px;
            border: 1px solid #2b3a50;
            border-radius: 7px;
            background: #0d1622;
        }
        .webui-bridge-image-input-preview img {
            width: 100%;
            height: 100%;
            object-fit: contain;
        }
        .webui-bridge-image-input-preview span {
            position: absolute;
            left: 8px;
            bottom: 8px;
            padding: 4px 6px;
            border-radius: 5px;
            background: rgba(9, 14, 22, .78);
            color: #e8f2ff;
            font-weight: 700;
        }
        .webui-bridge-image-input-controls {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
        }
        .webui-bridge-image-input-controls button,
        .webui-bridge-image-editor-toolbar button {
            min-height: 34px;
            border: 1px solid #40506a;
            border-radius: 7px;
            background: #243146;
            color: #f3f6fb;
            cursor: pointer;
            font-weight: 800;
        }
        .webui-bridge-image-input-panel label,
        .webui-bridge-image-editor-toolbar label {
            display: grid;
            gap: 5px;
            min-width: 0;
            color: #dce8f8;
            font-weight: 700;
        }
        .webui-bridge-image-input-denoise {
            grid-template-columns: auto minmax(0, 1fr) 42px;
            align-items: center;
        }
        .webui-bridge-image-editor-panel {
            width: min(1080px, calc(100vw - 48px));
        }
        .webui-bridge-image-editor-toolbar {
            display: grid;
            grid-template-columns: minmax(180px, 1fr) auto auto;
            gap: 10px;
            padding: 14px 18px 0;
            align-items: end;
        }
        .webui-bridge-image-editor-stage {
            position: relative;
            margin: 14px auto;
            border: 1px solid #415777;
            border-radius: 8px;
            background: #070b10;
            overflow: hidden;
        }
        .webui-bridge-image-editor-stage canvas {
            position: absolute;
            inset: 0;
            display: block;
        }
        .webui-bridge-image-editor-stage canvas + canvas {
            opacity: .46;
            mix-blend-mode: screen;
            filter: drop-shadow(0 0 2px rgba(255, 60, 70, .8));
        }
        .webui-bridge-image-editor-cursor {
            position: absolute;
            display: none;
            pointer-events: none;
            translate: -50% -50%;
            border: 2px solid #fff4cf;
            border-radius: 999px;
            box-shadow: 0 0 0 1px rgba(0, 0, 0, .8);
        }
        .webui-bridge-image-editor-cursor.visible {
            display: block;
        }
        .webui-bridge-image-editor-panel .webui-bridge-image-input-status {
            padding: 0 18px 12px;
        }
        .webui-bridge-config-status.download-active,
        .webui-bridge-config-status.success,
        .webui-bridge-config-status.error,
        .webui-bridge-config-status.warning {
            padding: 10px 12px;
            border-radius: 7px;
            font-weight: 800;
        }
        .webui-bridge-config-status.download-active,
        .webui-bridge-config-status.warning {
            border: 1px solid #f5bf4f;
            background: rgba(97, 71, 25, .92);
            color: #fff5d6;
            box-shadow: 0 0 0 3px rgba(245, 191, 79, .12);
        }
        .webui-bridge-config-status.success {
            border: 1px solid #51c878;
            background: rgba(24, 75, 45, .86);
            color: #dcffe7;
        }
        .webui-bridge-config-status.error {
            border: 1px solid #ff6b6b;
            background: rgba(93, 31, 37, .9);
            color: #ffe5e5;
        }
        @keyframes webui-bridge-download-pulse {
            0%, 100% { box-shadow: 0 0 0 3px rgba(245, 191, 79, .14); }
            50% { box-shadow: 0 0 0 5px rgba(245, 191, 79, .28); }
        }
        .webui-bridge-config-actions {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
            padding: 16px 22px 20px;
            border-top: 1px solid #313b4c;
            background: #141d2b;
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
        .webui-bridge-panel textarea {
            touch-action: manipulation;
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
            .webui-bridge-tutorial-grid {
                grid-template-columns: 1fr;
            }
            .webui-bridge-prompt-market-source,
            .webui-bridge-prompt-market-actions,
            .webui-bridge-custom-editor,
            .webui-bridge-custom-filters,
            .webui-bridge-settings-hero,
            .webui-bridge-settings-grid,
            .webui-bridge-settings-preset-row,
            .webui-bridge-settings-asset-tools,
            .webui-bridge-settings-assets,
            .webui-bridge-settings-asset-card,
            .webui-bridge-visibility-grid,
            .webui-bridge-module-body label,
            .webui-bridge-module-grid,
            .webui-bridge-module-actions,
            .webui-bridge-region-table,
            .webui-bridge-preset-list {
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
        installWorkflowLoadSanitizer();
        scheduleGraphToPromptWidgetRepairInstall();
        addStyles();
        scheduleComfyCorePackageMetadataRepair();
        scheduleStaleMissingNodeWarningClear("init");
    },
    beforeRegisterNodeDef(nodeType, nodeData) {
        installWorkflowLoadSanitizer();
        if (nodeData.name === IMAGE_INPUT_NODE) {
            chainCallback(nodeType.prototype, "onNodeCreated", function () {
                installBridgeImageInputPanel(this);
            });
            chainCallback(nodeType.prototype, "onConfigure", function () {
                installBridgeImageInputPanel(this);
            });
            return;
        }
        if (nodeData.name !== TARGET_NODE) return;
        chainCallback(nodeType.prototype, "onNodeCreated", function () {
            this.color = "#2f3a4a";
            this.bgcolor = "#1b222d";
            this.__webuiBridgeFreshNode = true;
            this.__webuiBridgeUserSized = false;
            this.__webuiBridgeFreshLayoutStabilizeUntil = (performance?.now?.() || Date.now()) + 2200;
            this.__webuiBridgeDesiredSize = clampPanelSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT);
            this.__webuiBridgeSavedPanelSize = null;
            this.size = [...this.__webuiBridgeDesiredSize];
            this.setSize?.([...this.__webuiBridgeDesiredSize]);
            scheduleBridgePanelInstall(this);
        });
        chainCallback(nodeType.prototype, "onConfigure", function (data) {
            this.__webuiBridgeWasConfigured = true;
            this.__webuiBridgeFreshLayoutStabilizeUntil = 0;
            if (Array.isArray(data?.widgets_values)) {
                const repaired = sanitizeBridgeWidgetsValues(data.widgets_values);
                if (repaired.changed) data.widgets_values = repaired.values;
                this.__webuiBridgeUnknownWidgetValues = data.widgets_values.slice(PROMPT_WIDGET_NAMES.length);
            } else {
                this.__webuiBridgeUnknownWidgetValues = [];
            }
            const repairConfiguredSize = shouldRepairBridgePanelSize(data?.size);
            if (looksLikeSavedUserBridgePanelSize(data?.size) || repairConfiguredSize) {
                this.__webuiBridgeSavedPanelSize = normalizeBridgePanelSize(data.size);
                this.__webuiBridgeDesiredSize = [...this.__webuiBridgeSavedPanelSize];
                this.__webuiBridgeRepairedPanelSize = repairConfiguredSize;
                this.__webuiBridgePreferConfiguredPanelSizeUntil = (performance?.now?.() || Date.now()) + WORKFLOW_CONFIGURED_SIZE_LOCK_MS;
                if (Math.round(Number(this.size?.[0] || 0)) !== this.__webuiBridgeSavedPanelSize[0] ||
                    Math.round(Number(this.size?.[1] || 0)) !== this.__webuiBridgeSavedPanelSize[1]) {
                    this.__webuiBridgeApplyingConfiguredSize = true;
                    try {
                        this.size = [...this.__webuiBridgeSavedPanelSize];
                        this.setSize?.([...this.__webuiBridgeSavedPanelSize]);
                    } finally {
                        this.__webuiBridgeApplyingConfiguredSize = false;
                    }
                }
            } else {
                this.__webuiBridgeSavedPanelSize = null;
                this.__webuiBridgeRepairedPanelSize = false;
                this.__webuiBridgePreferConfiguredPanelSizeUntil = 0;
                this.__webuiBridgeDesiredSize = clampPanelSize(DEFAULT_PANEL_WIDTH, DEFAULT_PANEL_HEIGHT);
            }
            repairBridgeNodeWidgetDefaults(this);
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
    beforeConfigureGraph(graphData, missingNodes) {
        sanitizeComfyCorePackageMetadataInWorkflowData(graphData);
        filterComfyCoreMissingNodeWarnings(missingNodes);
    },
    afterConfigureGraph(missingNodes) {
        filterComfyCoreMissingNodeWarnings(missingNodes);
        repairComfyCorePackageMetadata();
        scheduleStaleMissingNodeWarningClear("afterConfigureGraph");
        scheduleBridgePanelLayoutRepairForGraph("afterConfigureGraph");
    },
});
