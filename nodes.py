import csv
import datetime
import hashlib
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import uuid
import urllib.request
import zipfile
from pathlib import Path
from urllib.parse import quote, unquote

import comfy.sd
import comfy.utils
import folder_paths
import yaml


NODE_DIR = Path(__file__).resolve().parent
DATA_DIR = NODE_DIR / "data"
LOCAL_CONFIG_PATH = NODE_DIR / "config.local.json"
PROMPT_ALL_IN_ONE_HISTORY_MAX = 100
MAX_PROMPT_TEXT_LENGTH = 50000
MAX_SHORT_TEXT_LENGTH = 2000
MAX_STYLE_NAME_LENGTH = 120
MAX_WEBUI_ROOT_LENGTH = 500
_TAG_AUTOCOMPLETE_CACHE = None
_LORA_METADATA_CACHE = {}
_LORA_RAW_METADATA_CACHE = {}
_LORA_HASH_CACHE = {}
_LORA_LINK_ALIAS_CACHE = {}
_TRANSLATION_MAP_CACHE = {}
_NETWORK_TRANSLATE_CACHE = {}
_TAG_TRANSLATION_MAP_CACHE = None
_LORA_PREVIEW_EXTENSIONS = (".preview.png", ".preview.jpg", ".preview.jpeg", ".preview.webp", ".png", ".jpg", ".jpeg", ".webp")
_LORA_DESCRIPTION_EXTENSIONS = (".txt", ".description.txt", ".desc.txt")
_REGIONAL_SEPARATOR_RE = re.compile(r"\b(ADDCOMM|ADDBASE|ADDCOL|ADDROW|BREAK|AND)\b", re.IGNORECASE)
_REGIONAL_GRID_SEPARATORS = {"ADDCOL", "ADDROW"}
_IMAGE_SIGNATURES = {
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".webp": (b"RIFF",),
}
DEFAULT_BRIDGE_SETTINGS = {
    "data_source": "auto",
    "translation_source": "auto",
    "tag_translation_source": "auto",
    "show_startup_wizard": True,
    "layout_preset": "default",
    "tag_display": "local_first",
    "lora_card_size": "normal",
}
_SETTING_CHOICES = {
    "data_source": {"auto", "webui", "builtin"},
    "translation_source": {"auto", "webui", "online", "ai", "builtin"},
    "tag_translation_source": {"auto", "local", "online", "off"},
    "layout_preset": {"default", "compact", "roomy", "positive_focus", "minimal_lora"},
    "tag_display": {"local_first", "prompt_first", "compact"},
    "lora_card_size": {"compact", "normal", "large"},
}
EXTENSION_ASSETS = {
    "prompt_all_in_one": {
        "label": "Prompt All in One",
        "directory": "sd-webui-prompt-all-in-one",
        "repo_url": "https://github.com/Physton/sd-webui-prompt-all-in-one.git",
        "zip_url": "https://github.com/Physton/sd-webui-prompt-all-in-one/archive/refs/heads/main.zip",
    },
    "tagcomplete": {
        "label": "TagComplete",
        "directory": "a1111-sd-webui-tagcomplete",
        "repo_url": "https://github.com/DominikDoom/a1111-sd-webui-tagcomplete.git",
        "zip_url": "https://github.com/DominikDoom/a1111-sd-webui-tagcomplete/archive/refs/heads/main.zip",
    },
}
PROMPT_MARKET_SOURCES = {
    "current_webui_library": {
        "label": "当前 WebUI / 本地词库",
        "description": "优先读已连接 WebUI / 本地数据包；没有时联网下载 WebUI 生态词库补导入。",
        "license": "Local / MIT",
        "open_url": "",
        "format": "current_bridge_library",
        "limit": 2000,
        "importable": True,
    },
    "prompt_all_in_one_zh_cn": {
        "label": "Prompt All in One 中文分类词库",
        "description": "免费开源分组 tag，适合直接扩充提示词面板。",
        "license": "MIT",
        "open_url": "https://github.com/Physton/sd-webui-prompt-all-in-one/tree/main/group_tags",
        "download_url": "https://raw.githubusercontent.com/Physton/sd-webui-prompt-all-in-one/main/group_tags/zh_CN.yaml",
        "format": "prompt_all_in_one_yaml",
        "importable": True,
    },
    "tagcomplete_danbooru_top": {
        "label": "TagComplete Danbooru 热门 Tags",
        "description": "免费开源补全词库；导入前 1200 个高频 tag，并按类型自动分组。",
        "license": "MIT",
        "open_url": "https://github.com/DominikDoom/a1111-sd-webui-tagcomplete/tree/main/tags",
        "download_url": "https://raw.githubusercontent.com/DominikDoom/a1111-sd-webui-tagcomplete/main/tags/danbooru.csv",
        "format": "tagcomplete_csv",
        "group": "Danbooru",
        "limit": 1200,
        "importable": True,
    },
    "tagcomplete_quality": {
        "label": "TagComplete 质量词",
        "description": "常用质量相关 tag，体积小，适合作为基础增强/反向词补充。",
        "license": "MIT",
        "open_url": "https://github.com/DominikDoom/a1111-sd-webui-tagcomplete/blob/main/tags/extra-quality-tags.csv",
        "download_url": "https://raw.githubusercontent.com/DominikDoom/a1111-sd-webui-tagcomplete/main/tags/extra-quality-tags.csv",
        "format": "tagcomplete_csv",
        "group": "质量",
        "limit": 200,
        "importable": True,
    },
    "public_prompts": {
        "label": "Public Prompts",
        "description": "免费提示词案例站，适合打开后挑选完整 prompt；暂不做批量抓取。",
        "license": "Free website",
        "open_url": "https://www.publicprompts.art/",
        "importable": False,
    },
    "diffusiondb": {
        "label": "DiffusionDB",
        "description": "Hugging Face 上的 CC0 大型 prompt 数据集，适合研究和抽样，不建议整库导入。",
        "license": "CC0",
        "open_url": "https://huggingface.co/datasets/poloclub/diffusiondb",
        "importable": False,
    },
}
TAGCOMPLETE_TYPE_LABELS = {
    "0": "通用",
    "1": "画师",
    "3": "作品",
    "4": "角色",
    "5": "元信息/质量",
}
ONLINE_TAG_TRANSLATION_URLS = (
    "https://raw.githubusercontent.com/byzod/a1111-sd-webui-tagcomplete-CN/main/tags/Tags-zh-full-pack.csv",
)
TAG_TRANSLATION_CACHE_FILE = DATA_DIR / EXTENSION_ASSETS["tagcomplete"]["directory"] / "tags" / "Tags-zh-full-pack.csv"
BUILTIN_GROUP_TAGS = [
    {
        "name": "人物",
        "groups": [
            {
                "name": "基础",
                "color": "#6ea8fe",
                "tags": {
                    "1girl": "单个女孩",
                    "1boy": "单个男孩",
                    "solo": "单人",
                    "multiple girls": "多个女孩",
                    "portrait": "肖像",
                    "full body": "全身",
                    "upper body": "上半身",
                    "looking at viewer": "看向观众",
                },
            },
            {
                "name": "头发五官",
                "color": "#9ed06e",
                "tags": {
                    "long hair": "长发",
                    "short hair": "短发",
                    "bangs": "刘海",
                    "blue eyes": "蓝眼睛",
                    "red eyes": "红眼睛",
                    "silver hair": "银发",
                    "white hair": "白发",
                    "black hair": "黑发",
                },
            },
        ],
    },
    {
        "name": "服饰",
        "groups": [
            {
                "name": "常用服装",
                "color": "#f2b56b",
                "tags": {
                    "dress": "连衣裙",
                    "school uniform": "校服",
                    "sailor collar": "水手领",
                    "shirt": "衬衫",
                    "skirt": "裙子",
                    "jacket": "外套",
                    "thighhighs": "过膝袜",
                    "boots": "靴子",
                },
            },
        ],
    },
    {
        "name": "表情动作",
        "groups": [
            {
                "name": "表情",
                "color": "#f48fb1",
                "tags": {
                    "smile": "微笑",
                    "blush": "脸红",
                    "open mouth": "张嘴",
                    "closed eyes": "闭眼",
                    "crying": "哭泣",
                    "serious": "严肃",
                },
            },
            {
                "name": "动作",
                "color": "#ce93d8",
                "tags": {
                    "standing": "站立",
                    "sitting": "坐着",
                    "walking": "行走",
                    "running": "奔跑",
                    "arms behind back": "手背在身后",
                    "hand on hip": "手叉腰",
                },
            },
        ],
    },
    {
        "name": "画面",
        "groups": [
            {
                "name": "质量",
                "color": "#ffd166",
                "tags": {
                    "masterpiece": "杰作",
                    "best quality": "最佳质量",
                    "high quality": "高质量",
                    "very aesthetic": "非常美观",
                    "detailed": "细节丰富",
                    "sharp focus": "清晰聚焦",
                },
            },
            {
                "name": "构图",
                "color": "#80cbc4",
                "tags": {
                    "close-up": "特写",
                    "cowboy shot": "牛仔景",
                    "wide shot": "远景",
                    "from above": "俯视",
                    "from below": "仰视",
                    "dynamic angle": "动态角度",
                },
            },
        ],
    },
    {
        "name": "环境光照",
        "groups": [
            {
                "name": "场景",
                "color": "#90caf9",
                "tags": {
                    "outdoors": "户外",
                    "indoors": "室内",
                    "city": "城市",
                    "forest": "森林",
                    "sea": "海边",
                    "sky": "天空",
                    "night": "夜晚",
                    "sunset": "日落",
                },
            },
            {
                "name": "光照",
                "color": "#fff176",
                "tags": {
                    "soft lighting": "柔和光照",
                    "rim light": "轮廓光",
                    "backlighting": "逆光",
                    "cinematic lighting": "电影感光照",
                    "warm light": "暖光",
                    "cool light": "冷光",
                },
            },
        ],
    },
    {
        "name": "反向提示词",
        "groups": [
            {
                "name": "质量问题",
                "color": "#ef9a9a",
                "tags": {
                    "worst quality": "最差质量",
                    "low quality": "低质量",
                    "lowres": "低分辨率",
                    "blurry": "模糊",
                    "jpeg artifacts": "JPEG压缩痕迹",
                    "watermark": "水印",
                    "text": "文字",
                    "artist name": "作者名",
                },
            },
            {
                "name": "人体问题",
                "color": "#ef5350",
                "tags": {
                    "bad anatomy": "错误人体",
                    "bad hands": "坏手",
                    "extra fingers": "多余手指",
                    "missing fingers": "缺少手指",
                    "extra arms": "多余手臂",
                    "extra legs": "多余腿",
                    "bad feet": "坏脚",
                    "deformed": "变形",
                    "ugly face": "丑脸",
                },
            },
        ],
    },
]


def _load_local_config():
    try:
        if LOCAL_CONFIG_PATH.exists():
            data = json.loads(LOCAL_CONFIG_PATH.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
    except Exception:
        pass
    return {}


LOCAL_CONFIG = _load_local_config()


def _bridge_settings():
    raw = LOCAL_CONFIG.get("settings") if isinstance(LOCAL_CONFIG, dict) else {}
    settings = dict(DEFAULT_BRIDGE_SETTINGS)
    if isinstance(raw, dict):
        for key, value in raw.items():
            if key not in settings:
                continue
            if key == "show_startup_wizard":
                settings[key] = bool(value)
            elif key in _SETTING_CHOICES:
                value = str(value or "").strip()
                if value in _SETTING_CHOICES[key]:
                    settings[key] = value
    return settings


def _write_local_config(config):
    LOCAL_CONFIG_PATH.write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8")


def _data_source_mode():
    return _bridge_settings().get("data_source", "auto")


def _translation_source_mode():
    return _bridge_settings().get("translation_source", "auto")


def _tag_translation_source_mode():
    return _bridge_settings().get("tag_translation_source", "auto")


def _should_read_webui_data():
    return _data_source_mode() != "builtin"


def _should_use_builtin_prompt_data(webui_groups=None):
    mode = _data_source_mode()
    if mode == "builtin":
        return True
    if mode == "webui":
        return False
    return not webui_groups


def _path_text(path):
    return str(path).replace("\\", "/") if path else ""


def _existing_path(path):
    path = Path(str(path)).expanduser() if path else None
    return path if path and path.exists() else None


def _first_existing(*paths):
    for path in paths:
        found = _existing_path(path)
        if found:
            return found
    return None


def _truncate_text(value, limit):
    return str(value or "")[:limit]


def _validate_kind(kind):
    return "negative" if kind == "negative" else "positive"


def _looks_like_webui_root(root):
    return root.is_dir() and (root / "models").is_dir() and ((root / "webui.py").exists() or (root / "launch.py").exists() or (root / "modules").is_dir())


def _build_webui_config(webui_root):
    root_text = _truncate_text(webui_root, MAX_WEBUI_ROOT_LENGTH)
    root = _existing_path(root_text)
    if not root or not _looks_like_webui_root(root):
        raise ValueError("WebUI 根目录不存在或结构不完整，请选择包含 models 且带 webui.py、launch.py 或 modules 的 WebUI 根目录")
    extensions = root / "extensions"
    detected = _detect_webui_paths(root)
    model_paths = {
        key: _path_text(path)
        for key, path in detected.items()
        if key in ("loras", "checkpoints", "vae", "embeddings", "controlnet", "upscale_models", "hypernetworks") and path
    }
    return {
        "webui_root": _path_text(root),
        "prompt_all_in_one_dir": _path_text(extensions / "sd-webui-prompt-all-in-one"),
        "tagcomplete_dir": _path_text(extensions / "a1111-sd-webui-tagcomplete"),
        "webui_python_site_packages": _path_text(root / "python" / "Lib" / "site-packages"),
        "styles_file": _path_text(root / "styles.csv"),
        "model_paths": model_paths,
    }


def _detect_webui_paths(root):
    root = Path(str(root)).expanduser()
    models = root / "models"
    extensions = root / "extensions"
    return {
        "root": root,
        "styles_file": root / "styles.csv",
        "prompt_all_in_one_dir": extensions / "sd-webui-prompt-all-in-one",
        "tagcomplete_dir": extensions / "a1111-sd-webui-tagcomplete",
        "webui_python_site_packages": root / "python" / "Lib" / "site-packages",
        "loras": _first_existing(models / "Lora", models / "lora", models / "loras"),
        "checkpoints": _first_existing(models / "Stable-diffusion", models / "checkpoints"),
        "vae": _first_existing(models / "VAE", models / "vae"),
        "embeddings": _first_existing(root / "embeddings", models / "embeddings"),
        "controlnet": _first_existing(models / "ControlNet", models / "controlnet"),
        "upscale_models": _first_existing(models / "ESRGAN", models / "RealESRGAN", models / "SwinIR"),
        "hypernetworks": _first_existing(models / "hypernetworks", models / "Hypernetwork"),
    }


def _apply_webui_model_paths(webui_root):
    detected = _detect_webui_paths(webui_root)
    for key, value in (LOCAL_CONFIG.get("model_paths") or {}).items():
        if key not in detected or not detected.get(key):
            detected[key] = _existing_path(value)
    mapping = {
        "loras": "loras",
        "checkpoints": "checkpoints",
        "vae": "vae",
        "embeddings": "embeddings",
        "controlnet": "controlnet",
        "upscale_models": "upscale_models",
        "hypernetworks": "hypernetworks",
    }
    added = []
    for key, folder_name in mapping.items():
        path = detected.get(key)
        if not path:
            continue
        try:
            folder_paths.add_model_folder_path(folder_name, str(path))
            added.append({"kind": folder_name, "path": _path_text(path)})
            if folder_name == "loras":
                added.extend(_apply_linked_lora_targets(path))
        except Exception:
            pass
    try:
        folder_paths.filename_list_cache.clear()
    except Exception:
        pass
    return added


def _resolve_windows_shortcut(shortcut_path):
    if os.name != "nt" or not shortcut_path:
        return None
    path = Path(shortcut_path)
    if path.suffix.casefold() != ".lnk" or not path.exists():
        return None
    script = (
        "$ErrorActionPreference='Stop';"
        "$s=(New-Object -ComObject WScript.Shell).CreateShortcut($args[0]);"
        "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;"
        "Write-Output $s.TargetPath"
    )
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", script, str(path)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=3,
            check=False,
        )
    except Exception:
        return None
    target = (result.stdout or "").strip().splitlines()
    if result.returncode != 0 or not target:
        return None
    resolved = Path(target[-1]).expanduser()
    return resolved if resolved.exists() else None


def _apply_linked_lora_targets(lora_root):
    root = _existing_path(lora_root)
    if not root:
        return []
    added = []
    aliases = {}
    try:
        shortcuts = list(root.rglob("*.lnk"))[:500]
    except Exception:
        shortcuts = []
    for shortcut in shortcuts:
        target = _resolve_windows_shortcut(shortcut)
        if not target or target.suffix.casefold() not in {".safetensors", ".ckpt", ".pt"}:
            continue
        try:
            folder_paths.add_model_folder_path("loras", str(target.parent))
            added.append({"kind": "loras", "path": _path_text(target.parent), "source": _path_text(shortcut)})
            aliases[_lora_key(shortcut.stem)] = target.name
            aliases[_lora_key(shortcut.name)] = target.name
        except Exception:
            pass
    if aliases:
        _LORA_LINK_ALIAS_CACHE.update(aliases)
        try:
            folder_paths.filename_list_cache.clear()
        except Exception:
            pass
    return added


def _apply_configured_model_paths():
    added = []
    configured_paths = LOCAL_CONFIG.get("model_paths") if isinstance(LOCAL_CONFIG, dict) else {}
    if WEBUI_ROOT:
        added.extend(_apply_webui_model_paths(WEBUI_ROOT))
    elif isinstance(configured_paths, dict):
        mapping = {
            "loras": "loras",
            "checkpoints": "checkpoints",
            "vae": "vae",
            "embeddings": "embeddings",
            "controlnet": "controlnet",
            "upscale_models": "upscale_models",
            "hypernetworks": "hypernetworks",
        }
        for key, folder_name in mapping.items():
            path = _existing_path(configured_paths.get(key))
            if not path:
                continue
            try:
                folder_paths.add_model_folder_path(folder_name, str(path))
                added.append({"kind": folder_name, "path": _path_text(path)})
                if folder_name == "loras":
                    added.extend(_apply_linked_lora_targets(path))
            except Exception:
                pass
        try:
            folder_paths.filename_list_cache.clear()
        except Exception:
            pass
    return added


def _apply_local_config(config):
    global LOCAL_CONFIG, WEBUI_ROOT, PROMPT_ALL_IN_ONE_DIR, TAGCOMPLETE_DIR, WEBUI_PYTHON_SITE_PACKAGES, STORAGE_DIR, STYLES_FILE
    global _TAG_AUTOCOMPLETE_CACHE, _LORA_METADATA_CACHE, _LORA_RAW_METADATA_CACHE, _LORA_HASH_CACHE, _LORA_LINK_ALIAS_CACHE, _TRANSLATION_MAP_CACHE, _NETWORK_TRANSLATE_CACHE
    LOCAL_CONFIG = config if isinstance(config, dict) else {}
    WEBUI_ROOT = _discover_webui_root()
    PROMPT_ALL_IN_ONE_DIR = (
        _configured_path("prompt_all_in_one_dir", "WEBUI_PROMPT_BRIDGE_PROMPT_ALL_IN_ONE_DIR")
        or (WEBUI_ROOT / "extensions" / "sd-webui-prompt-all-in-one" if WEBUI_ROOT else DATA_DIR / "sd-webui-prompt-all-in-one")
    )
    TAGCOMPLETE_DIR = (
        _configured_path("tagcomplete_dir", "WEBUI_PROMPT_BRIDGE_TAGCOMPLETE_DIR")
        or (WEBUI_ROOT / "extensions" / "a1111-sd-webui-tagcomplete" if WEBUI_ROOT else DATA_DIR / "a1111-sd-webui-tagcomplete")
    )
    WEBUI_PYTHON_SITE_PACKAGES = (
        _configured_path("webui_python_site_packages", "WEBUI_PROMPT_BRIDGE_WEBUI_SITE_PACKAGES")
        or (WEBUI_ROOT / "python" / "Lib" / "site-packages" if WEBUI_ROOT else None)
    )
    STORAGE_DIR = (
        _configured_path("storage_dir", "WEBUI_PROMPT_BRIDGE_STORAGE_DIR")
        or DATA_DIR / "storage"
    )
    STYLES_FILE = (
        _configured_path("styles_file", "WEBUI_PROMPT_BRIDGE_STYLES_FILE")
        or (WEBUI_ROOT / "styles.csv" if WEBUI_ROOT else DATA_DIR / "styles.csv")
    )
    _TAG_AUTOCOMPLETE_CACHE = None
    _LORA_METADATA_CACHE.clear()
    _LORA_RAW_METADATA_CACHE.clear()
    _LORA_HASH_CACHE.clear()
    _LORA_LINK_ALIAS_CACHE.clear()
    _TRANSLATION_MAP_CACHE.clear()
    _NETWORK_TRANSLATE_CACHE.clear()
    _apply_configured_model_paths()


def _webui_integration_status(webui_root=None):
    root = _existing_path(webui_root) or WEBUI_ROOT
    config = {}
    error = ""
    if root:
        try:
            config = _build_webui_config(root)
        except ValueError as exc:
            error = str(exc)
            root = None
    detected = _detect_webui_paths(root) if root else {}
    checks = {}
    for key in ("styles_file", "prompt_all_in_one_dir", "tagcomplete_dir", "webui_python_site_packages", "loras", "checkpoints", "vae", "embeddings", "controlnet"):
        path = detected.get(key) if detected else config.get(key)
        checks[key] = {"path": _path_text(path), "exists": bool(_existing_path(path))}
    return {
        "configured": bool(root),
        "webui_root": _path_text(root),
        "config_path": _path_text(LOCAL_CONFIG_PATH),
        "error": error,
        "checks": checks,
    }


def _guess_webui_roots():
    candidates = []
    for value in (
        LOCAL_CONFIG.get("webui_root"),
        os.environ.get("WEBUI_PROMPT_BRIDGE_WEBUI_ROOT"),
        "H:/sd-webui-aki-v4.9",
        "D:/sd-webui-aki-v4.9",
        "D:/stable-diffusion-webui",
        "H:/stable-diffusion-webui",
    ):
        if value:
            candidates.append(value)
    for drive in "CDEFGHIJKLMNOPQRSTUVWXYZ":
        for name in ("sd-webui-aki-v4.9", "stable-diffusion-webui", "sd-webui"):
            candidates.append(f"{drive}:/{name}")
    seen = set()
    found = []
    for candidate in candidates:
        path = _existing_path(candidate)
        key = _path_text(path).lower() if path else ""
        if not path or key in seen:
            continue
        if (path / "webui.py").exists() or (path / "launch.py").exists() or (path / "models").exists():
            seen.add(key)
            found.append(_path_text(path))
    return found[:12]


def _configured_path(config_key, env_key):
    value = os.environ.get(env_key) or LOCAL_CONFIG.get(config_key)
    if not value:
        return None
    path = Path(str(value)).expanduser()
    return path if path.exists() else None


def _discover_webui_root():
    configured = _configured_path("webui_root", "WEBUI_PROMPT_BRIDGE_WEBUI_ROOT")
    if configured:
        return configured
    prompt_dir = _configured_path("prompt_all_in_one_dir", "WEBUI_PROMPT_BRIDGE_PROMPT_ALL_IN_ONE_DIR")
    if prompt_dir:
        try:
            root = prompt_dir.parents[1]
            if _looks_like_webui_root(root):
                return root
        except IndexError:
            pass
    tag_dir = _configured_path("tagcomplete_dir", "WEBUI_PROMPT_BRIDGE_TAGCOMPLETE_DIR")
    if tag_dir:
        try:
            root = tag_dir.parents[1]
            if _looks_like_webui_root(root):
                return root
        except IndexError:
            pass
    return None


WEBUI_ROOT = _discover_webui_root()
PROMPT_ALL_IN_ONE_DIR = (
    _configured_path("prompt_all_in_one_dir", "WEBUI_PROMPT_BRIDGE_PROMPT_ALL_IN_ONE_DIR")
    or (WEBUI_ROOT / "extensions" / "sd-webui-prompt-all-in-one" if WEBUI_ROOT else DATA_DIR / "sd-webui-prompt-all-in-one")
)
TAGCOMPLETE_DIR = (
    _configured_path("tagcomplete_dir", "WEBUI_PROMPT_BRIDGE_TAGCOMPLETE_DIR")
    or (WEBUI_ROOT / "extensions" / "a1111-sd-webui-tagcomplete" if WEBUI_ROOT else DATA_DIR / "a1111-sd-webui-tagcomplete")
)
WEBUI_PYTHON_SITE_PACKAGES = (
    _configured_path("webui_python_site_packages", "WEBUI_PROMPT_BRIDGE_WEBUI_SITE_PACKAGES")
    or (WEBUI_ROOT / "python" / "Lib" / "site-packages" if WEBUI_ROOT else None)
)
STORAGE_DIR = (
    _configured_path("storage_dir", "WEBUI_PROMPT_BRIDGE_STORAGE_DIR")
    or DATA_DIR / "storage"
)
STYLES_FILE = (
    _configured_path("styles_file", "WEBUI_PROMPT_BRIDGE_STYLES_FILE")
    or (WEBUI_ROOT / "styles.csv" if WEBUI_ROOT else DATA_DIR / "styles.csv")
)

_apply_configured_model_paths()


def _find_webui_styles_file():
    candidates = [
        STYLES_FILE,
    ]
    for path in candidates:
        if path.exists():
            return path
    return STYLES_FILE


def _readonly_prompt_all_in_one_storage():
    return PROMPT_ALL_IN_ONE_DIR.exists() and STORAGE_DIR == DATA_DIR / "storage"


def _prompt_all_in_one_path(*parts):
    return PROMPT_ALL_IN_ONE_DIR.joinpath(*parts)


def _read_text_if_exists(path):
    try:
        if path.exists():
            return path.read_text(encoding="utf-8")
    except Exception:
        pass
    return ""


def _validate_same_origin_request(request):
    host = request.headers.get("Host", "").split(",", 1)[0].strip().lower()
    if not host:
        return True
    for header in ("Origin", "Referer"):
        value = request.headers.get(header, "")
        if not value:
            continue
        match = re.match(r"^https?://([^/]+)", value, flags=re.IGNORECASE)
        if not match:
            return False
        if match.group(1).lower() != host:
            return False
    return True


def _validate_preview_image(image_bytes, extension):
    signatures = _IMAGE_SIGNATURES.get(extension)
    if not signatures:
        raise ValueError("Unsupported preview image type")
    if not any(image_bytes.startswith(signature) for signature in signatures):
        raise ValueError("Preview image content does not match its file type")
    if extension == ".webp" and image_bytes[8:12] != b"WEBP":
        raise ValueError("Preview image content does not match its file type")


def _normalize_prompt_group_data(data, key_prefix="groupTags"):
    normalized = []
    for group_index, group in enumerate(data or []):
        if not isinstance(group, dict):
            continue
        group_name = str(group.get("name") or "")
        if not group_name:
            continue
        groups = []
        for sub_index, sub_group in enumerate(group.get("groups") or []):
            if not isinstance(sub_group, dict):
                continue
            if sub_group.get("type") == "wrap":
                groups.append({"type": "wrap"})
                continue
            tags = []
            raw_tags = sub_group.get("tags") or {}
            if isinstance(raw_tags, dict):
                for prompt, local in raw_tags.items():
                    prompt = "" if prompt is None else str(prompt)
                    local = "" if local is None else str(local)
                    if prompt:
                        tags.append({"prompt": prompt, "local": local})
            groups.append({
                "name": str(sub_group.get("name") or ""),
                "color": sub_group.get("color") or "",
                "type": sub_group.get("type") or "tags",
                "tabKey": f"{key_prefix}-{group_index}-{sub_index}",
                "tags": tags,
            })
        normalized.append({
            "name": group_name,
            "tabKey": f"{key_prefix}-{group_index}",
            "type": group.get("type") or "tags",
            "groups": groups,
        })
    return normalized


def _builtin_prompt_all_in_one_group_tags(lang="zh_CN"):
    return _normalize_prompt_group_data(BUILTIN_GROUP_TAGS, "builtinTags")


def _custom_prompt_all_in_one_group_tags():
    raw_items = LOCAL_CONFIG.get("custom_tags") if isinstance(LOCAL_CONFIG, dict) else []
    if not isinstance(raw_items, list):
        return []
    grouped = {}
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        prompt = _truncate_text(item.get("prompt") or item.get("text") or "", MAX_STYLE_NAME_LENGTH).strip()
        if not prompt:
            continue
        local = _truncate_text(item.get("local") or item.get("name") or "", MAX_STYLE_NAME_LENGTH).strip()
        group_name = _truncate_text(item.get("group") or "", MAX_STYLE_NAME_LENGTH).strip()
        sub_name = _truncate_text(item.get("subgroup") or item.get("category") or "", MAX_STYLE_NAME_LENGTH).strip()
        kind = _validate_kind(item.get("kind") or item.get("type") or "positive")
        if kind == "negative":
            group_name = group_name or "反向提示词"
            sub_name = sub_name or "导入词库"
        else:
            group_name = group_name or "导入词库"
            sub_name = sub_name or "提示词"
        grouped.setdefault(group_name, {}).setdefault(sub_name, {})[prompt] = local
    data = []
    for group_name, subgroups in grouped.items():
        data.append({
            "name": group_name,
            "groups": [
                {"name": sub_name, "color": "#8ab4f8", "tags": tags}
                for sub_name, tags in subgroups.items()
            ],
        })
    return _normalize_prompt_group_data(data, "customTags")


def _custom_prompt_override_keys():
    raw_items = LOCAL_CONFIG.get("custom_tags") if isinstance(LOCAL_CONFIG, dict) else []
    if not isinstance(raw_items, list):
        return set()
    keys = set()
    for item in raw_items:
        if not isinstance(item, dict):
            continue
        prompt = str(item.get("prompt") or item.get("text") or "").strip().casefold()
        if not prompt:
            continue
        kind = _validate_kind(item.get("kind") or item.get("type") or "positive")
        keys.add((kind, prompt))
    return keys


def _filter_prompt_group_overrides(groups, override_keys):
    if not override_keys:
        return groups
    filtered = []
    for group in groups:
        if not isinstance(group, dict):
            continue
        kind = "negative" if group.get("name") == "反向提示词" else "positive"
        next_groups = []
        for sub_group in group.get("groups") or []:
            if not isinstance(sub_group, dict) or sub_group.get("type") == "wrap":
                next_groups.append(sub_group)
                continue
            tags = [
                tag for tag in sub_group.get("tags") or []
                if (kind, str(tag.get("prompt") or "").strip().casefold()) not in override_keys
            ]
            if tags:
                next_sub_group = dict(sub_group)
                next_sub_group["tags"] = tags
                next_groups.append(next_sub_group)
        if next_groups:
            next_group = dict(group)
            next_group["groups"] = next_groups
            filtered.append(next_group)
    return filtered


def _load_webui_prompt_all_in_one_group_tags(lang="zh_CN"):
    if not _should_read_webui_data():
        return []
    base = _prompt_all_in_one_path("group_tags")
    custom = base / "custom.yaml"
    if custom.exists() and _read_text_if_exists(custom).strip():
        main_file = custom
    else:
        main_file = base / f"{lang}.yaml"
        if not main_file.exists():
            main_file = base / "default.yaml"

    content = ""
    content += _read_text_if_exists(base / "prepend.yaml") + "\n\n"
    content += _read_text_if_exists(main_file) + "\n\n"
    content += _read_text_if_exists(base / "append.yaml") + "\n\n"
    if not content.strip():
        return []

    data = yaml.safe_load(content) or []
    return _normalize_prompt_group_data(data, "groupTags")


def _load_prompt_all_in_one_group_tags(lang="zh_CN"):
    webui_groups = _load_webui_prompt_all_in_one_group_tags(lang)
    groups = list(webui_groups)
    if _should_use_builtin_prompt_data(webui_groups):
        groups.extend(_builtin_prompt_all_in_one_group_tags(lang))
    groups = _filter_prompt_group_overrides(groups, _custom_prompt_override_keys())
    groups.extend(_custom_prompt_all_in_one_group_tags())
    return groups


def _read_tag_translation_csv(text, zh_map):
    for row in csv.reader(text.splitlines()):
        if len(row) >= 2 and row[0].strip():
            zh_map.setdefault(row[0].strip().casefold(), row[1].strip())


def _load_tag_translation_map():
    global _TAG_TRANSLATION_MAP_CACHE
    if _TAG_TRANSLATION_MAP_CACHE is not None:
        return _TAG_TRANSLATION_MAP_CACHE

    zh_map = {}
    mode = _tag_translation_source_mode()
    if mode == "off":
        _TAG_TRANSLATION_MAP_CACHE = zh_map
        return zh_map

    if mode in {"auto", "local"} and _should_read_webui_data():
        candidates = [
            TAGCOMPLETE_DIR / "tags" / "danbooru.zh_CN_SFW.csv",
            TAGCOMPLETE_DIR / "tags" / "danbooru.zh_CN.csv",
            TAGCOMPLETE_DIR / "tags" / "Tags-zh-full-pack.csv",
            TAGCOMPLETE_DIR / "tags" / "tags-zh-full-pack.csv",
        ]
        for path in candidates:
            try:
                if path.exists():
                    _read_tag_translation_csv(path.read_text(encoding="utf-8-sig"), zh_map)
            except Exception:
                pass
    try:
        if mode in {"auto", "local"} and TAG_TRANSLATION_CACHE_FILE.exists():
            _read_tag_translation_csv(TAG_TRANSLATION_CACHE_FILE.read_text(encoding="utf-8-sig"), zh_map)
    except Exception:
        pass

    if mode == "online" or (mode == "auto" and not zh_map):
        for url in ONLINE_TAG_TRANSLATION_URLS:
            try:
                request = urllib.request.Request(
                    url,
                    headers={"User-Agent": "ComfyUI-WebUI-Prompt-Bridge"},
                )
                with urllib.request.urlopen(request, timeout=20) as response:
                    content = response.read(5 * 1024 * 1024 + 1)
                if len(content) <= 5 * 1024 * 1024:
                    text = content.decode("utf-8-sig", errors="replace")
                    _read_tag_translation_csv(text, zh_map)
                    try:
                        TAG_TRANSLATION_CACHE_FILE.parent.mkdir(parents=True, exist_ok=True)
                        if not TAG_TRANSLATION_CACHE_FILE.exists():
                            TAG_TRANSLATION_CACHE_FILE.write_text(text, encoding="utf-8")
                    except Exception:
                        pass
                if zh_map:
                    break
            except Exception:
                pass

    _TAG_TRANSLATION_MAP_CACHE = zh_map
    return zh_map


def _load_tag_autocomplete_items():
    global _TAG_AUTOCOMPLETE_CACHE
    if _TAG_AUTOCOMPLETE_CACHE is not None:
        return _TAG_AUTOCOMPLETE_CACHE

    zh_map = _load_tag_translation_map()

    items = []
    item_by_key = {}
    if _should_read_webui_data():
        tag_file = TAGCOMPLETE_DIR / "tags" / "danbooru.csv"
        try:
            with tag_file.open("r", encoding="utf-8-sig", newline="") as f:
                for row in csv.reader(f):
                    if not row or not row[0].strip():
                        continue
                    tag = row[0].strip()
                    try:
                        count = int(row[2]) if len(row) > 2 and row[2] else 0
                    except ValueError:
                        count = 0
                    aliases = []
                    if len(row) > 3 and row[3]:
                        aliases = [x.strip() for x in row[3].split(",") if x.strip()]
                    item = {
                        "text": tag,
                        "local": zh_map.get(tag.casefold(), ""),
                        "count": count,
                        "aliases": aliases[:12],
                        "type": "tag",
                    }
                    items.append(item)
                    item_by_key[tag.casefold()] = item
        except Exception:
            pass

    # Prompt All-in-One grouped tags should also participate even if they are
    # absent from tagcomplete's frequency database.
    seen = {item["text"].casefold() for item in items}
    for group in _load_prompt_all_in_one_group_tags("zh_CN"):
        for sub_group in group.get("groups", []):
            for tag in sub_group.get("tags", []):
                prompt = str(tag.get("prompt") or "").strip()
                prompt_key = prompt.casefold()
                if not prompt:
                    continue
                local = str(tag.get("local") or "")
                if prompt_key in seen:
                    existing = item_by_key.get(prompt_key)
                    if existing is not None and local and not existing.get("local"):
                        existing["local"] = local
                    continue
                seen.add(prompt_key)
                local = local or zh_map.get(prompt_key, "")
                items.append({
                    "text": prompt,
                    "local": local,
                    "count": 0,
                    "aliases": [],
                    "type": "group",
                })

    _TAG_AUTOCOMPLETE_CACHE = items
    return items


def _autocomplete_prompt_tags(query, limit=12):
    query = (query or "").strip().casefold().replace(" ", "_")
    if not query:
        return []
    scored = []
    for item in _load_tag_autocomplete_items():
        text = item["text"]
        key = text.casefold()
        aliases = item.get("aliases") or []
        score = None
        if key.startswith(query):
            score = 0
        elif any(alias.casefold().startswith(query) for alias in aliases):
            score = 1
        elif query in key:
            score = 2
        elif item.get("local") and query in str(item.get("local")).casefold():
            score = 3
        if score is None:
            continue
        scored.append((score, -int(item.get("count") or 0), item))
    scored.sort(key=lambda x: (x[0], x[1], x[2]["text"]))
    return [item for _, __, item in scored[: max(1, min(int(limit or 12), 30))]]


def _lora_metadata_summary(lora_name):
    resolved = _resolve_lora_name(lora_name)
    if resolved is None:
        return {"requested": lora_name, "found": False}
    lora_path = folder_paths.get_full_path("loras", resolved)
    cached = _LORA_METADATA_CACHE.get(lora_path)
    if cached is not None:
        return cached

    summary = {
        "requested": lora_name,
        "name": resolved,
        "found": True,
        "base_model": "",
        "network_module": "",
        "architecture": "",
        "title": _strip_extension(Path(resolved).name),
        "trigger_words": [],
        "family": "unknown",
        "warning": "",
    }
    try:
        from safetensors import safe_open

        with safe_open(lora_path, framework="pt", device="cpu") as f:
            keys = list(f.keys())[:80]
            metadata = f.metadata() or {}
        summary["base_model"] = metadata.get("ss_base_model_version") or metadata.get("ss_sd_model_name") or ""
        summary["network_module"] = metadata.get("ss_network_module") or ""
        summary["architecture"] = metadata.get("modelspec.architecture") or ""
        summary["title"] = metadata.get("modelspec.title") or summary["title"]

        key_blob = "\n".join(keys).casefold()
        meta_blob = " ".join(str(summary.get(k) or "") for k in ("base_model", "network_module", "architecture")).casefold()
        if "lora_anima" in meta_blob or "anima" in str(summary["base_model"]).casefold() or "lora_unet_blocks_" in key_blob:
            summary["family"] = "anima"
        elif "sdxl" in meta_blob or "noob" in meta_blob or "lora_unet_down_blocks" in key_blob:
            summary["family"] = "sdxl/noob"
        elif "sd_v1" in meta_blob or "stable-diffusion-v1" in meta_blob:
            summary["family"] = "sd1"

        raw_frequency = metadata.get("ss_tag_frequency")
        if raw_frequency:
            try:
                freq = json.loads(raw_frequency)
                counts = {}
                for bucket in freq.values():
                    if isinstance(bucket, dict):
                        for tag, count in bucket.items():
                            counts[tag] = counts.get(tag, 0) + int(count or 0)
                summary["trigger_words"] = [tag for tag, _ in sorted(counts.items(), key=lambda x: x[1], reverse=True)[:12]]
            except Exception:
                pass
        if summary["family"] not in ("anima", "unknown"):
            summary["warning"] = "This LoRA does not look like an Anima LoRA; it may load but have little or no effect on anima_baseV10."
    except Exception as exc:
        summary["warning"] = f"Could not read LoRA metadata: {exc}"

    _LORA_METADATA_CACHE[lora_path] = summary
    return summary


def _prompt_all_in_one_item_prompt(item):
    if not isinstance(item, dict):
        return ""
    prompt = item.get("prompt")
    if prompt:
        return str(prompt)
    tags = []
    for tag in item.get("tags") or []:
        if not isinstance(tag, dict) or tag.get("disabled"):
            continue
        value = tag.get("value")
        if value:
            tags.append(str(value))
    return ", ".join(tags)


def _prompt_all_in_one_item_id(item, index):
    if not isinstance(item, dict):
        return ""
    item_id = str(item.get("id") or "").strip()
    if item_id:
        return item_id
    payload = {
        "index": index,
        "time": item.get("time"),
        "name": item.get("name") or "",
        "prompt": _prompt_all_in_one_item_prompt(item),
    }
    digest = hashlib.sha256(json.dumps(payload, ensure_ascii=True, sort_keys=True).encode("utf-8")).hexdigest()
    return f"legacy-{digest[:16]}"


def _load_prompt_all_in_one_favorites(kind):
    data = _storage_get(_storage_key("favorite", kind), [])
    items = []
    for index, item in enumerate(data if isinstance(data, list) else []):
        if not isinstance(item, dict):
            continue
        tags = []
        for tag in item.get("tags") or []:
            if not isinstance(tag, dict) or tag.get("disabled"):
                continue
            value = tag.get("value")
            if value:
                tags.append({"prompt": str(value), "local": str(tag.get("localValue") or "")})
        prompt = _prompt_all_in_one_item_prompt(item) or ", ".join(tag["prompt"] for tag in tags)
        if prompt:
            items.append({
                "id": _prompt_all_in_one_item_id(item, index),
                "name": item.get("name") or prompt,
                "prompt": prompt,
                "tags": tags or [{"prompt": prompt, "local": item.get("name") or ""}],
            })
    return items


def _storage_key(collection, kind):
    prompt_type = "txt2img_neg" if kind == "negative" else "txt2img"
    return f"{collection}.{prompt_type}"


def _storage_path(key):
    prompt_all_in_one_path = _prompt_all_in_one_path("storage", f"{key}.json")
    if prompt_all_in_one_path.exists():
        return prompt_all_in_one_path
    return STORAGE_DIR / f"{key}.json"


def _storage_get(key, default=None):
    path = _storage_path(key)
    try:
        if path.exists() and path.stat().st_size > 0:
            return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        pass
    return default


def _load_webui_translate_apis():
    path = PROMPT_ALL_IN_ONE_DIR / "translate_apis.json"
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {"default": "alibaba_free", "apis": []}


def _find_webui_translate_api(api_key):
    for group in _load_webui_translate_apis().get("apis", []):
        for item in group.get("children", []):
            if item.get("key") == api_key:
                return item
    return None


def _webui_translate_api_config(api_key):
    config = {}
    item = _find_webui_translate_api(api_key) or {}
    stored = _storage_get(f"translate_api.{api_key}", {})
    if isinstance(stored, dict):
        config.update(stored)
    for field in item.get("config", []) or []:
        key = field.get("key")
        if key and key not in config and "default" in field:
            config[key] = field.get("default")
    if api_key == "alibaba_free":
        config.setdefault("region", "EN")
    if item.get("concurrent"):
        config.setdefault("concurrent", item.get("concurrent"))
    return config


def _webui_network_translate(text, from_lang="zh_CN", to_lang="en_US"):
    text = str(text or "").strip()
    if not text:
        return ""
    if _translation_source_mode() == "builtin":
        return ""
    api_data = _load_webui_translate_apis()
    api_key = _storage_get("translateApi", api_data.get("default") or "alibaba_free")
    if not api_key:
        api_key = "alibaba_free"
    cache_key = (api_key, from_lang, to_lang, text)
    if cache_key in _NETWORK_TRANSLATE_CACHE:
        return _NETWORK_TRANSLATE_CACHE[cache_key]

    translate_script = PROMPT_ALL_IN_ONE_DIR / "scripts" / "physton_prompt" / "translate.py"
    if not translate_script.exists() and _translation_source_mode() == "online":
        try:
            _install_extension_asset("prompt_all_in_one", DATA_DIR)
        except Exception:
            pass
        translate_script = PROMPT_ALL_IN_ONE_DIR / "scripts" / "physton_prompt" / "translate.py"
    if not translate_script.exists():
        return ""

    added_paths = []
    import_paths = [PROMPT_ALL_IN_ONE_DIR]
    if WEBUI_PYTHON_SITE_PACKAGES and WEBUI_ROOT and WEBUI_PYTHON_SITE_PACKAGES.is_relative_to(WEBUI_ROOT):
        import_paths.append(WEBUI_PYTHON_SITE_PACKAGES)
    for raw_path in import_paths:
        path = str(raw_path)
        if path and path not in sys.path:
            if WEBUI_PYTHON_SITE_PACKAGES and path == str(WEBUI_PYTHON_SITE_PACKAGES):
                sys.path.append(path)
            else:
                sys.path.insert(0, path)
            added_paths.append(path)
    try:
        from scripts.physton_prompt.translate import translate

        result = translate(text, from_lang, to_lang, api_key, _webui_translate_api_config(api_key))
        if result.get("success"):
            translated = result.get("translated_text") or ""
            if isinstance(translated, list):
                translated = translated[0] if translated else ""
            translated = str(translated).strip().replace("\n", ", ")
            _NETWORK_TRANSLATE_CACHE[cache_key] = translated
            return translated
    except Exception:
        pass
    return ""


def _ai_translate_prompt(text, from_lang="zh_CN", to_lang="en_US"):
    text = str(text or "").strip()
    if not text:
        return ""
    config = _ai_config_raw()
    if not config.get("enabled"):
        return ""
    api_key = str(config.get("api_key") or "").strip()
    if not api_key:
        return ""
    base_url = str(config.get("base_url") or "https://api.siliconflow.cn/v1").strip().rstrip("/")
    model = str(config.get("model") or "deepseek-ai/DeepSeek-V4-Flash").strip()
    if not base_url or not model:
        return ""
    cache_key = ("ai", base_url, model, from_lang, to_lang, text)
    if cache_key in _NETWORK_TRANSLATE_CACHE:
        return _NETWORK_TRANSLATE_CACHE[cache_key]
    direction = "Chinese to concise English Stable Diffusion tags" if to_lang == "en_US" else "English tags to concise Chinese labels"
    system_prompt = str(config.get("system_prompt") or "You are a Stable Diffusion prompt assistant. Return concise tags separated by commas.").strip()
    user_prompt = f"Translate this prompt from {direction}. Return only the translated tags, separated by commas:\n{text}"
    body = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": _truncate_text(user_prompt, MAX_SHORT_TEXT_LENGTH)},
        ],
        "temperature": 0.2,
        "max_tokens": 256,
    }).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "ComfyUI-WebUI-Prompt-Bridge",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=45) as response:
            data = json.loads(response.read().decode("utf-8"))
        content = (((data.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
        content = _normalize_network_prompt(content).strip("`")
        content = re.sub(r"^(translated tags?|tags?)\s*[:：]\s*", "", content, flags=re.I).strip()
        _NETWORK_TRANSLATE_CACHE[cache_key] = content
        return content
    except Exception:
        _NETWORK_TRANSLATE_CACHE[cache_key] = ""
        return ""


def _storage_set(key, data):
    path = _storage_path(key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=True, indent=4), encoding="utf-8")


def _prompt_to_storage_tags(prompt, lang="zh_CN"):
    translated = _translate_prompt_all_in_one_text(prompt, to="english", lang=lang)
    tags = []
    for item in translated:
        value = item.get("prompt")
        if not value:
            continue
        if value == "\n":
            tags.append({
                "id": str(int(time.time() * 1000)) + uuid.uuid4().hex[:6],
                "value": "\n",
                "localValue": "\n",
                "disabled": False,
                "type": "wrap",
            })
            continue
        tags.append({
            "id": str(int(time.time() * 1000)) + uuid.uuid4().hex[:6],
            "value": value,
            "localValue": item.get("local", ""),
            "disabled": False,
            "type": "text",
            "weightNum": 1,
            "incWeight": 0,
            "decWeight": 0,
            "originalValue": value,
        })
    return tags


def _make_prompt_item(prompt, name="", lang="zh_CN"):
    return {
        "id": str(uuid.uuid1()),
        "time": int(time.time()),
        "name": name or prompt[:60],
        "tags": _prompt_to_storage_tags(prompt, lang),
        "prompt": prompt,
    }


def _push_prompt_all_in_one_item(collection, kind, prompt, name="", lang="zh_CN"):
    key = _storage_key(collection, kind)
    items = _storage_get(key, [])
    if not isinstance(items, list):
        items = []
    if collection == "history" and len(items) >= PROMPT_ALL_IN_ONE_HISTORY_MAX:
        items = items[-(PROMPT_ALL_IN_ONE_HISTORY_MAX - 1):]
    item = _make_prompt_item(prompt, name, lang)
    items.append(item)
    _storage_set(key, items)
    return item


def _delete_prompt_all_in_one_item(collection, kind, item_id="", prompt=""):
    key = _storage_key(collection, kind)
    items = _storage_get(key, [])
    if not isinstance(items, list):
        return False
    item_id = str(item_id or "")
    prompt = str(prompt or "").strip()
    remove_index = None
    if item_id:
        for index, item in enumerate(items):
            if _prompt_all_in_one_item_id(item, index) == item_id:
                remove_index = index
                break
    elif prompt:
        matches = [
            index for index, item in enumerate(items)
            if _prompt_all_in_one_item_prompt(item).strip() == prompt
        ]
        if len(matches) == 1:
            remove_index = matches[0]
    if remove_index is None:
        return False
    next_items = list(items)
    del next_items[remove_index]
    _storage_set(key, next_items)
    return True


def _get_prompt_all_in_one_items(collection, kind):
    items = _storage_get(_storage_key(collection, kind), [])
    return items if isinstance(items, list) else []


def _latest_prompt_all_in_one_history(kind):
    items = _get_prompt_all_in_one_items("history", kind)
    return items[-1] if items else None


def _split_prompt_all_in_one_tags(text):
    text = (text or "").strip()
    if not text:
        return []
    for src in ("，", "。", "、", "；", "．", ";"):
        text = text.replace(src, ",")
    text = text.replace("\t", "\n").replace("\r", "\n")
    text = re.sub(r"\n+", "\n", text)

    brackets = {"(": ")", "[": "]", "<": ">", "{": "}"}
    result = []
    temp = ""
    start_bracket = ""
    end_bracket = ""
    bracket_count = 0

    for char in text:
        if char == "\n" and not start_bracket:
            if temp.strip():
                result.append(temp.strip())
            result.append("\n")
            temp = ""
        elif char == "," and not start_bracket:
            if temp.strip():
                result.append(temp.strip())
            temp = ""
        else:
            if not start_bracket and char in brackets:
                start_bracket = char
                end_bracket = brackets[char]
                bracket_count = 1
            elif start_bracket and char == start_bracket:
                bracket_count += 1
            elif start_bracket and char == end_bracket:
                bracket_count -= 1
                if bracket_count == 0:
                    start_bracket = ""
                    end_bracket = ""
            temp += " " if char == "\n" and start_bracket else char

    if temp.strip():
        result.append(temp.strip())
    return [item for item in result if item]


def _normalize_lookup_key(value):
    return re.sub(r"\s+", " ", str(value or "").strip()).casefold()


def _lookup_variants(value):
    raw = str(value or "").strip()
    base = _normalize_lookup_key(raw)
    variants = [base]
    swapped_space = _normalize_lookup_key(raw.replace("_", " "))
    swapped_under = _normalize_lookup_key(raw.replace(" ", "_"))
    for item in (swapped_space, swapped_under):
        if item and item not in variants:
            variants.append(item)
    return variants


def _build_prompt_all_in_one_translation_maps(lang="zh_CN"):
    cached = _TRANSLATION_MAP_CACHE.get(lang)
    if cached is not None:
        return cached

    local_to_prompt = {}
    prompt_to_local = {}

    def add_pair(prompt, local):
        prompt = str(prompt or "").strip()
        local = str(local or "").strip()
        if not prompt:
            return
        prompt_key = _normalize_lookup_key(prompt)
        if local:
            prompt_to_local.setdefault(prompt_key, local)
            for alias in re.split(r"[|,，、;/；]+", local):
                alias = alias.strip()
                if alias:
                    local_to_prompt.setdefault(_normalize_lookup_key(alias), prompt)
            local_to_prompt.setdefault(_normalize_lookup_key(local), prompt)
        # English tags should be stable if the user enters them already.
        local_to_prompt.setdefault(prompt_key, prompt)

    # TagComplete's Chinese CSV is the broad Danbooru translation source used
    # by WebUI autocomplete. Merge it before group tags; group tags may override
    # local labels but should not remove the much larger dictionary.
    for prompt, local in _load_tag_translation_map().items():
        add_pair(prompt, local)

    # Also use the main autocomplete CSV aliases so shorthand/alternate English
    # spellings normalize to the canonical Danbooru tag.
    if _should_read_webui_data():
        tag_file = TAGCOMPLETE_DIR / "tags" / "danbooru.csv"
        try:
            with tag_file.open("r", encoding="utf-8-sig", newline="") as f:
                for row in csv.reader(f):
                    if not row:
                        continue
                    prompt = row[0].strip()
                    if prompt:
                        prompt_to_local.setdefault(_normalize_lookup_key(prompt), prompt_to_local.get(_normalize_lookup_key(prompt), ""))
                        if len(row) > 3 and row[3]:
                            for alias in row[3].split(","):
                                alias = alias.strip()
                                if alias:
                                    local_to_prompt.setdefault(_normalize_lookup_key(alias), prompt)
        except Exception:
            pass

    for group in _load_prompt_all_in_one_group_tags(lang):
        for sub_group in group.get("groups") or []:
            for tag in sub_group.get("tags") or []:
                prompt = tag.get("prompt") or ""
                local = tag.get("local") or ""
                add_pair(prompt, local)
    manual_aliases = {
        "女孩": "1girl",
        "女孩子": "1girl",
        "少女": "1girl",
        "美少女": "bishoujo",
        "16岁": "teen",
        "16岁少女": "teen",
        "16岁少女身材": "teen, 1girl, slender",
        "身材": "slender",
        "少女身材": "teen, 1girl, slender",
        "单人": "solo",
        "神里绫华": "kamisato_ayaka",
        "神里凌华": "kamisato_ayaka",
        "绫华": "kamisato_ayaka",
        "凌华": "kamisato_ayaka",
        "闭眼": "eyes_closed",
        "闭上眼睛": "eyes_closed",
        "微笑": "smile",
        "长发": "long_hair",
        "短发": "short_hair",
        "蓝眼睛": "blue_eyes",
        "银发": "silver_hair",
        "白发": "white_hair",
        "艺术家签名": "artist_name",
        "作者名": "artist_name",
        "丑脸": "ugly_face",
    }
    manual_locals = {
        "pussy": "阴部",
        "artist_name": "作者名",
        "artist name": "作者名",
        "ugly_face": "丑脸",
        "ugly face": "丑脸",
        "bad_feet": "坏脚",
        "bad feet": "坏脚",
        "malformed_feet": "畸形脚",
        "malformed feet": "畸形脚",
        "jpeg_artifacts": "JPEG压缩痕迹",
        "jpeg artifacts": "JPEG压缩痕迹",
        "extra_arms": "多余的手臂",
        "extra arms": "多余的手臂",
        "extra_legs": "多余的腿",
        "extra legs": "多余的腿",
        "footworship": "足部崇拜",
    }
    for local, prompt in manual_aliases.items():
        local_to_prompt[_normalize_lookup_key(local)] = prompt
        for key in _lookup_variants(prompt):
            prompt_to_local.setdefault(key, local)
    for prompt, local in manual_locals.items():
        for key in _lookup_variants(prompt):
            prompt_to_local[key] = local
    _TRANSLATION_MAP_CACHE[lang] = (local_to_prompt, prompt_to_local)
    return local_to_prompt, prompt_to_local


def _lookup_map(mapping, value):
    for key in _lookup_variants(value):
        found = mapping.get(key)
        if found:
            return found
    return None


def _translate_local_phrase_to_prompts(item, local_to_prompt):
    text = str(item or "").strip()
    if not text or not re.search(r"[\u3400-\u9fff]", text):
        return None

    direct = _lookup_map(local_to_prompt, text)
    if direct and direct != text:
        return direct

    result = []
    lowered = text.casefold()
    age_match = re.search(r"(\d{1,2})\s*岁", text)
    if age_match:
        age = int(age_match.group(1))
        if 13 <= age <= 19:
            result.append("teen")
        elif 11 <= age <= 15:
            result.append("early_teen")

    phrase_rules = [
        ("神里绫华", "kamisato_ayaka"),
        ("神里凌华", "kamisato_ayaka"),
        ("少女", "1girl"),
        ("女孩", "1girl"),
        ("女孩子", "1girl"),
        ("美少女", "bishoujo"),
        ("身材", "slender"),
        ("瘦", "slender"),
        ("苗条", "slender"),
        ("丰满", "curvy"),
        ("魔鬼身材", "curvy"),
        ("蓝色裙子", "blue_dress"),
        ("蓝裙子", "blue_dress"),
        ("站在", "standing"),
        ("站着", "standing"),
        ("站立", "standing"),
        ("海边", "sea"),
        ("闭眼", "eyes_closed"),
        ("微笑", "smile"),
        ("蓝眼", "blue_eyes"),
        ("银发", "silver_hair"),
        ("白发", "white_hair"),
    ]
    for needle, prompt in phrase_rules:
        if needle in text or needle in lowered:
            result.append(prompt)

    deduped = []
    for prompt in result:
        if prompt and prompt not in deduped:
            deduped.append(prompt)
    return ", ".join(deduped) if deduped else None


def _normalize_network_prompt(text):
    text = html.unescape(str(text or "")).strip()
    if not text:
        return ""
    text = re.sub(r"[。.!！]+$", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _merge_prompt_texts(*values):
    merged = []
    for value in values:
        for item in _split_prompt_all_in_one_tags(value or ""):
            if not item or item == "\n":
                continue
            if item not in merged:
                merged.append(item)
    return ", ".join(merged)


def _translate_prompt_all_in_one_text(text, to="english", lang="zh_CN"):
    local_to_prompt, prompt_to_local = _build_prompt_all_in_one_translation_maps(lang)
    translated = []
    for item in _split_prompt_all_in_one_tags(text):
        if item == "\n":
            translated.append({"input": item, "prompt": item, "local": item, "matched": True})
            continue
        key = _normalize_lookup_key(item)
        if to == "local":
            local = _lookup_map(prompt_to_local, item) or ""
            source = "local"
            if not local and re.search(r"[A-Za-z]", item):
                mode = _translation_source_mode()
                if mode in ("auto", "ai"):
                    local = _ai_translate_prompt(item, "en_US", lang)
                    source = "ai" if local else source
                if not local and mode != "ai":
                    local = _webui_network_translate(item, "en_US", lang)
                    source = "network" if local else source
            translated.append({
                "input": item,
                "prompt": item,
                "local": local or item,
                "matched": bool(local),
                "source": source,
            })
        else:
            prompt = _lookup_map(local_to_prompt, item)
            exact_or_alias = prompt is not None
            network_used = False
            ai_used = False
            if not exact_or_alias and re.search(r"[\u3400-\u9fff]", item):
                mode = _translation_source_mode()
                network_prompt = None
                if mode in ("auto", "ai"):
                    network_prompt = _normalize_network_prompt(_ai_translate_prompt(item, lang, "en_US")) or None
                    ai_used = bool(network_prompt)
                if not network_prompt and mode != "ai":
                    network_prompt = _normalize_network_prompt(_webui_network_translate(item, lang, "en_US")) or None
                    network_used = bool(network_prompt)
                if network_prompt:
                    prompt = network_prompt
            if prompt is None:
                prompt = _translate_local_phrase_to_prompts(item, local_to_prompt)
            if prompt is None:
                prompt = item
            local = _lookup_map(prompt_to_local, prompt) or item
            translated.append({
                "input": item,
                "prompt": prompt,
                "local": local,
                "matched": prompt != item,
                "source": "ai" if ai_used else ("network" if network_used else "local"),
            })
    return translated


def _load_webui_styles():
    styles = []
    path = _find_webui_styles_file()
    if path is not None:
        try:
            with path.open("r", encoding="utf-8-sig", newline="") as f:
                for row in csv.DictReader(f):
                    styles.append({
                        "name": row.get("name", "").strip(),
                        "prompt": row.get("prompt", ""),
                        "negative_prompt": row.get("negative_prompt", ""),
                    })
        except Exception:
            styles = []
    return [x for x in styles if x["name"]]


def _save_webui_styles(styles):
    path = _find_webui_styles_file()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["name", "prompt", "negative_prompt"])
        writer.writeheader()
        for style in styles:
            writer.writerow({
                "name": style.get("name", ""),
                "prompt": style.get("prompt", ""),
                "negative_prompt": style.get("negative_prompt", ""),
            })


def _strip_extension(name):
    lowered = name.casefold()
    for ext in (".safetensors", ".ckpt", ".pt"):
        if lowered.endswith(ext):
            return name[: -len(ext)]
    return name


def _lora_key(name):
    return _strip_extension(name).replace("\\", "/").casefold()


def _parse_lora_tags(prompt):
    loras = []

    def replace(match):
        name = match.group(1).strip()
        raw_model = (match.group(2) or "1").strip()
        raw_clip = match.group(3)
        try:
            strength_model = float(raw_model)
        except ValueError:
            strength_model = 1.0
        if raw_clip is None:
            strength_clip = None
        else:
            try:
                strength_clip = float(raw_clip.strip())
            except ValueError:
                strength_clip = None
        if name:
            loras.append((name, strength_model, strength_clip))
        return ""

    cleaned = re.sub(
        r"<\s*(?:lora|lyco):([^:>]+)(?::([^:>]+))?(?::([^:>]+))?\s*>",
        replace,
        prompt or "",
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(r"\s*,\s*,+", ", ", cleaned)
    cleaned = re.sub(r"(^\s*,\s*)|(\s*,\s*$)", "", cleaned).strip()
    return cleaned, loras


def _collect_upstream_loras_from_prompt(prompt, unique_id):
    if not isinstance(prompt, dict) or unique_id is None:
        return set()

    graph = {str(node_id): node_def for node_id, node_def in prompt.items() if isinstance(node_def, dict)}
    seen = set()
    loras = set()

    def normalize(name):
        return _lora_key(str(name or ""))

    def visit(node_id):
        key = str(node_id)
        if key in seen:
            return
        seen.add(key)
        node_def = graph.get(key)
        if not isinstance(node_def, dict):
            return
        inputs = node_def.get("inputs") or {}
        class_type = str(node_def.get("class_type") or "").casefold()
        title = str(node_def.get("_meta", {}).get("title") or "").casefold()
        lora_name = inputs.get("lora_name")
        if lora_name and ("lora" in class_type or "lora" in title):
            loras.add(normalize(lora_name))
        for value in inputs.values():
            if isinstance(value, (list, tuple)) and value:
                visit(value[0])

    bridge = graph.get(str(unique_id))
    if not isinstance(bridge, dict):
        return set()
    for input_name in ("model", "clip"):
        link = (bridge.get("inputs") or {}).get(input_name)
        if isinstance(link, (list, tuple)) and link:
            visit(link[0])
    return loras


def _prompt_output_has_consumers(prompt, unique_id, output_index):
    if not isinstance(prompt, dict) or unique_id is None:
        return True
    source_id = str(unique_id)
    for node_def in prompt.values():
        if not isinstance(node_def, dict):
            continue
        for value in (node_def.get("inputs") or {}).values():
            try:
                linked_output = int(value[1]) if isinstance(value, (list, tuple)) and len(value) >= 2 else None
            except (TypeError, ValueError):
                linked_output = None
            if (
                isinstance(value, (list, tuple))
                and len(value) >= 2
                and str(value[0]) == source_id
                and linked_output == output_index
            ):
                return True
    return False


_RE_PARAM = re.compile(r"\s*([\w \-/]+):\s*(\"(?:\\.|[^\"])*\"|[^,]+)(?:,|$)")
_RE_IMAGE_SIZE = re.compile(r"^(\d+)[xX](\d+)$")


def _parse_generation_parameters(text):
    """Parse A1111/WebUI infotext into a field dict.

    This mirrors the important behavior of modules.infotext_utils without
    importing WebUI's runtime, which would pull in Gradio/global model state.
    """
    text = (text or "").strip()
    if not text:
        return {}

    result = {}
    prompt = ""
    negative_prompt = ""
    done_with_prompt = False
    parts = text.split("\n")
    lines = parts[:-1]
    lastline = parts[-1] if parts else ""

    if len(_RE_PARAM.findall(lastline)) < 3:
        lines.append(lastline)
        lastline = ""

    for line in lines:
        line = line.strip()
        if line.startswith("Negative prompt:"):
            done_with_prompt = True
            line = line[16:].strip()
        if done_with_prompt:
            negative_prompt += ("" if negative_prompt == "" else "\n") + line
        else:
            prompt += ("" if prompt == "" else "\n") + line

    for key, value in _RE_PARAM.findall(lastline):
        key = key.strip()
        value = value.strip()
        try:
            if len(value) >= 2 and value[0] == '"' and value[-1] == '"':
                value = unquote(value[1:-1])
            size_match = _RE_IMAGE_SIZE.match(value)
            if size_match is not None:
                result[f"{key}-1"] = size_match.group(1)
                result[f"{key}-2"] = size_match.group(2)
            else:
                result[key] = value
        except Exception:
            result[key] = value

    result["Prompt"] = prompt
    result["Negative prompt"] = negative_prompt
    if "Clip skip" not in result:
        result["Clip skip"] = "1"
    if "Hires resize-1" not in result:
        result["Hires resize-1"] = 0
        result["Hires resize-2"] = 0
    if "Hires sampler" not in result:
        result["Hires sampler"] = "Use same sampler"
    if "Hires schedule type" not in result:
        result["Hires schedule type"] = "Use same scheduler"
    if "Hires prompt" not in result:
        result["Hires prompt"] = ""
    if "Hires negative prompt" not in result:
        result["Hires negative prompt"] = ""
    return result


def _resolve_lora_name(requested):
    available = folder_paths.get_filename_list("loras")
    if requested in available:
        return requested

    candidates = {}
    for alias, target in list(_LORA_LINK_ALIAS_CACHE.items()):
        if target in available:
            candidates.setdefault(alias, target)
    basename_candidates = {}
    for name in available:
        candidates.setdefault(_lora_key(name), name)
        candidates.setdefault(_lora_key(name.replace("/", "\\")), name)
        basename_key = _lora_key(Path(str(name).replace("\\", "/")).name)
        if basename_key:
            basename_candidates.setdefault(basename_key, set()).add(name)
        try:
            lora_path = folder_paths.get_full_path("loras", name)
            metadata = _read_lora_raw_metadata(lora_path)
            for alias in (
                metadata.get("ss_output_name"),
                metadata.get("modelspec.title"),
            ):
                alias_key = _lora_key(str(alias or "").strip())
                if alias_key:
                    candidates.setdefault(alias_key, name)
        except Exception:
            pass

    key = _lora_key(requested)
    if key in candidates:
        return candidates[key]
    basename_matches = basename_candidates.get(key)
    if basename_matches and len(basename_matches) == 1:
        return next(iter(basename_matches))

    with_ext = requested if requested.casefold().endswith(".safetensors") else f"{requested}.safetensors"
    with_ext_key = _lora_key(with_ext)
    if with_ext_key in candidates:
        return candidates[with_ext_key]
    basename_matches = basename_candidates.get(with_ext_key)
    if basename_matches and len(basename_matches) == 1:
        return next(iter(basename_matches))
    return None


def _lora_folder_and_base(name):
    normalized = str(name or "").replace("\\", "/")
    folder, filename = os.path.split(normalized)
    stem = _strip_extension(filename)
    return folder, filename, stem


def _find_lora_preview_path(lora_path):
    if not lora_path:
        return None
    path = Path(lora_path)
    base = path.with_suffix("")
    for suffix in _LORA_PREVIEW_EXTENSIONS:
        candidate = Path(str(base) + suffix)
        if candidate.exists() and candidate.is_file():
            return candidate
    return None


def _find_lora_description(lora_path):
    if not lora_path:
        return ""
    path = Path(lora_path)
    base = path.with_suffix("")
    for suffix in _LORA_DESCRIPTION_EXTENSIONS:
        candidate = Path(str(base) + suffix)
        if candidate.exists() and candidate.is_file():
            try:
                return candidate.read_text(encoding="utf-8", errors="ignore").strip()[:500]
            except Exception:
                return ""
    return ""


def _pretty_bytes(size):
    try:
        value = float(size or 0)
    except Exception:
        value = 0
    units = ("B", "KB", "MB", "GB")
    for unit in units:
        if value < 1024 or unit == units[-1]:
            return f"{value:.0f}{unit}" if unit == "B" or value >= 10 else f"{value:.1f}{unit}"
        value /= 1024
    return f"{value:.0f}B"


def _json_metadata_value(value, fallback=None):
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str) and value.strip():
        try:
            return json.loads(value)
        except Exception:
            return fallback
    return fallback


def _read_lora_raw_metadata(lora_path):
    if not lora_path:
        return {}
    cache_key = str(lora_path)
    cached = _LORA_RAW_METADATA_CACHE.get(cache_key)
    if cached is not None:
        return cached
    metadata = {}
    try:
        from safetensors import safe_open

        with safe_open(lora_path, framework="pt", device="cpu") as f:
            metadata = f.metadata() or {}
    except Exception:
        metadata = {}
    _LORA_RAW_METADATA_CACHE[cache_key] = metadata
    return metadata


def _lora_user_metadata_path(lora_path):
    return Path(lora_path).with_suffix(".json") if lora_path else None


def _read_lora_user_metadata(lora_path, fallback_description=""):
    metadata = {}
    metadata_path = _lora_user_metadata_path(lora_path)
    if metadata_path and metadata_path.exists():
        try:
            loaded = json.loads(metadata_path.read_text(encoding="utf-8"))
            if isinstance(loaded, dict):
                metadata.update(loaded)
        except Exception:
            pass
    if fallback_description and not metadata.get("description"):
        metadata["description"] = fallback_description
    return metadata


def _write_lora_user_metadata(lora_path, updates):
    metadata_path = _lora_user_metadata_path(lora_path)
    if not metadata_path:
        raise ValueError("LoRA metadata path is not available")
    current = _read_lora_user_metadata(lora_path)
    for key in ("description", "category", "sd version", "activation text", "negative text", "notes"):
        current[key] = str(updates.get(key, "") or "")
    try:
        current["preferred weight"] = float(updates.get("preferred weight") or 0)
    except Exception:
        current["preferred weight"] = 0.0
    metadata_path.write_text(json.dumps(current, indent=4, ensure_ascii=False), encoding="utf-8")
    return current


def _lora_training_tags(metadata, limit=48):
    raw_frequency = _json_metadata_value(metadata.get("ss_tag_frequency"), {})
    counts = {}
    if isinstance(raw_frequency, dict):
        for bucket in raw_frequency.values():
            if isinstance(bucket, dict):
                for tag, count in bucket.items():
                    tag = str(tag or "").strip()
                    if not tag:
                        continue
                    try:
                        counts[tag] = counts.get(tag, 0) + int(count or 0)
                    except Exception:
                        pass
    return [
        {"tag": tag, "count": count}
        for tag, count in sorted(counts.items(), key=lambda item: item[1], reverse=True)[:limit]
    ]


def _lora_resolutions(metadata):
    bucket_info = _json_metadata_value(metadata.get("ss_bucket_info"), {})
    buckets = bucket_info.get("buckets") if isinstance(bucket_info, dict) else None
    if not isinstance(buckets, dict):
        return ""
    counts = {}
    for bucket in buckets.values():
        if not isinstance(bucket, dict):
            continue
        resolution = bucket.get("resolution")
        if not isinstance(resolution, (list, tuple)) or len(resolution) < 2:
            continue
        text = f"{resolution[1]}x{resolution[0]}"
        try:
            counts[text] = counts.get(text, 0) + int(bucket.get("count") or 0)
        except Exception:
            counts[text] = counts.get(text, 0) + 1
    return ", ".join(sorted(counts, key=counts.get, reverse=True)[:4])


def _lora_dataset_size(metadata):
    dataset_dirs = _json_metadata_value(metadata.get("ss_dataset_dirs"), {})
    if not isinstance(dataset_dirs, dict):
        return 0
    total = 0
    for params in dataset_dirs.values():
        if isinstance(params, dict):
            try:
                total += int(params.get("img_count") or 0)
            except Exception:
                pass
    return total


def _lora_file_hash(lora_path):
    if not lora_path:
        return ""
    try:
        stat = Path(lora_path).stat()
        cache_key = (str(lora_path), int(stat.st_mtime), int(stat.st_size))
        cached = _LORA_HASH_CACHE.get(cache_key)
        if cached is not None:
            return cached
        digest = hashlib.sha256()
        with open(lora_path, "rb") as file:
            for chunk in iter(lambda: file.read(1024 * 1024), b""):
                digest.update(chunk)
        value = digest.hexdigest()[:12]
        _LORA_HASH_CACHE.clear()
        _LORA_HASH_CACHE[cache_key] = value
        return value
    except Exception:
        return ""


def _detect_lora_sd_version(metadata, summary=None):
    for key in ("ss_base_model_version", "ss_sd_model_name", "modelspec.architecture"):
        value = str(metadata.get(key) or "").casefold()
        if "sdxl" in value or "xl" in value:
            return "SDXL"
        if "sd2" in value or "stable-diffusion-v2" in value:
            return "SD2"
        if "sd1" in value or "stable-diffusion-v1" in value:
            return "SD1"
    family = str((summary or {}).get("family") or "").casefold()
    if "sdxl" in family or "noob" in family:
        return "SDXL"
    if family == "sd1":
        return "SD1"
    return "Unknown"


def _lora_training_started_at(metadata):
    value = metadata.get("ss_training_started_at")
    if not value:
        return ""
    try:
        return datetime.datetime.utcfromtimestamp(float(value)).strftime("%Y-%m-%d %H:%M")
    except Exception:
        return str(value)


def _lora_detail(lora_name):
    resolved = _resolve_lora_name(lora_name)
    if resolved is None:
        return {"requested": lora_name, "found": False}
    lora_path = folder_paths.get_full_path("loras", resolved)
    preview_path = _find_lora_preview_path(lora_path)
    description = _find_lora_description(lora_path)
    user_metadata = _read_lora_user_metadata(lora_path, description)
    raw_metadata = _read_lora_raw_metadata(lora_path)
    summary = _lora_metadata_summary(resolved)
    stat = Path(lora_path).stat()
    sd_version = user_metadata.get("sd version") or _detect_lora_sd_version(raw_metadata, summary)
    lora_hash = _lora_file_hash(lora_path)
    return {
        "requested": lora_name,
        "name": resolved,
        "found": True,
        "file_name": Path(lora_path).name,
        "file_size": _pretty_bytes(stat.st_size),
        "hash": lora_hash,
        "modified": datetime.datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M"),
        "thumbnail": f"/webui_prompt_bridge/lora_thumbnail?name={quote(resolved, safe='')}" if preview_path else "",
        "description": user_metadata.get("description") or description,
        "user_metadata": {
            "description": user_metadata.get("description") or description,
            "category": user_metadata.get("category", "") or user_metadata.get("manual category", ""),
            "sd version": sd_version,
            "activation text": user_metadata.get("activation text", ""),
            "preferred weight": user_metadata.get("preferred weight", 0.0),
            "negative text": user_metadata.get("negative text", ""),
            "notes": user_metadata.get("notes", ""),
        },
        "metadata_table": [
            {"label": "文件名:", "value": resolved},
            {"label": "文件大小:", "value": _pretty_bytes(stat.st_size)},
            {"label": "哈希值:", "value": lora_hash},
            {"label": "最后修改日期:", "value": datetime.datetime.fromtimestamp(stat.st_mtime).strftime("%Y-%m-%d %H:%M")},
            {"label": "输出名称:", "value": raw_metadata.get("ss_output_name") or ""},
            {"label": "模型:", "value": raw_metadata.get("ss_sd_model_name") or raw_metadata.get("ss_base_model_version") or ""},
            {"label": "CLIP 终止层数:", "value": raw_metadata.get("ss_clip_skip") or ""},
            {"label": "Kohya 模块类型:", "value": raw_metadata.get("ss_network_module") or ""},
            {"label": "训练日期:", "value": _lora_training_started_at(raw_metadata)},
            {"label": "分辨率:", "value": _lora_resolutions(raw_metadata)},
            {"label": "数据集大小:", "value": str(_lora_dataset_size(raw_metadata) or "")},
        ],
        "training_tags": _lora_training_tags(raw_metadata),
        "summary": summary,
    }


def _settings_response():
    custom_tags = LOCAL_CONFIG.get("custom_tags") if isinstance(LOCAL_CONFIG, dict) else []
    return {
        "settings": _bridge_settings(),
        "custom_tag_count": len(custom_tags) if isinstance(custom_tags, list) else 0,
        "config_path": _path_text(LOCAL_CONFIG_PATH),
        "webui_configured": bool(WEBUI_ROOT),
        "assets": _bridge_asset_status(),
    }


def _ai_config_response():
    config = LOCAL_CONFIG.get("ai_api") if isinstance(LOCAL_CONFIG, dict) else {}
    if not isinstance(config, dict):
        config = {}
    api_key = str(config.get("api_key") or "")
    return {
        "success": True,
        "config": {
            "enabled": bool(config.get("enabled")),
            "provider": str(config.get("provider") or "openai_compatible"),
            "base_url": str(config.get("base_url") or "https://api.siliconflow.cn/v1"),
            "model": str(config.get("model") or "deepseek-ai/DeepSeek-V4-Flash"),
            "api_key_set": bool(api_key),
            "api_key_preview": (api_key[:4] + "..." + api_key[-4:]) if len(api_key) > 8 else ("已设置" if api_key else ""),
            "system_prompt": str(config.get("system_prompt") or "You are a Stable Diffusion prompt assistant. Return concise English tags separated by commas."),
        },
    }


def _normalize_ai_model_name(model, base_url=""):
    raw = _truncate_text(model or "", MAX_STYLE_NAME_LENGTH).strip()
    if not raw:
        return "deepseek-ai/DeepSeek-V4-Flash"
    key = re.sub(r"[^a-z0-9]+", "", raw.casefold())
    base_key = str(base_url or "").casefold()
    if "siliconflow" in base_key and key in {"deepseekv4flash", "deepseek4flash", "deepseekv4"}:
        return "deepseek-ai/DeepSeek-V4-Flash"
    return raw


def _update_ai_config(data):
    config = dict(LOCAL_CONFIG) if isinstance(LOCAL_CONFIG, dict) else {}
    current = config.get("ai_api")
    if not isinstance(current, dict):
        current = {}
    current["enabled"] = bool(data.get("enabled"))
    current["provider"] = "openai_compatible"
    current["base_url"] = _truncate_text(data.get("base_url") or "", MAX_SHORT_TEXT_LENGTH).strip().rstrip("/") or "https://api.siliconflow.cn/v1"
    current["model"] = _normalize_ai_model_name(data.get("model"), current["base_url"])
    system_prompt = _truncate_text(data.get("system_prompt") or "", MAX_PROMPT_TEXT_LENGTH).strip()
    if system_prompt:
        current["system_prompt"] = system_prompt
    if data.get("clear_api_key"):
        current["api_key"] = ""
    elif str(data.get("api_key") or "").strip():
        current["api_key"] = str(data.get("api_key") or "").strip()
    config["ai_api"] = current
    _write_local_config(config)
    _apply_local_config(config)
    return _ai_config_response()


def _ai_config_raw():
    config = LOCAL_CONFIG.get("ai_api") if isinstance(LOCAL_CONFIG, dict) else {}
    return config if isinstance(config, dict) else {}


def _test_ai_config(prompt="Generate a short Stable Diffusion prompt for a girl in a garden."):
    config = _ai_config_raw()
    api_key = str(config.get("api_key") or "").strip()
    if not api_key:
        raise ValueError("请先填写 API Key")
    base_url = str(config.get("base_url") or "https://api.siliconflow.cn/v1").strip().rstrip("/")
    model = _normalize_ai_model_name(config.get("model"), base_url)
    body = json.dumps({
        "model": model,
        "messages": [
            {"role": "system", "content": str(config.get("system_prompt") or "Return concise English Stable Diffusion tags.")},
            {"role": "user", "content": _truncate_text(prompt, MAX_SHORT_TEXT_LENGTH)},
        ],
        "temperature": 0.7,
        "max_tokens": 120,
    }).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url}/chat/completions",
        data=body,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "ComfyUI-WebUI-Prompt-Bridge",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        data = json.loads(response.read().decode("utf-8"))
    content = (((data.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
    return {"success": True, "content": content, "model": model}


def _list_ai_models(data=None):
    data = data if isinstance(data, dict) else {}
    config = _ai_config_raw()
    api_key = str(data.get("api_key") or config.get("api_key") or "").strip()
    if not api_key:
        raise ValueError("请先填写 API Key")
    base_url = _truncate_text(data.get("base_url") or config.get("base_url") or "", MAX_SHORT_TEXT_LENGTH).strip().rstrip("/") or "https://api.siliconflow.cn/v1"
    request = urllib.request.Request(
        f"{base_url}/models",
        headers={
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "ComfyUI-WebUI-Prompt-Bridge",
        },
        method="GET",
    )
    with urllib.request.urlopen(request, timeout=45) as response:
        payload = json.loads(response.read().decode("utf-8"))
    raw_models = payload.get("data") if isinstance(payload, dict) else payload
    models = []
    if isinstance(raw_models, list):
        for item in raw_models:
            if isinstance(item, dict):
                model_id = str(item.get("id") or item.get("name") or "").strip()
                if model_id:
                    models.append({
                        "id": model_id,
                        "owned_by": str(item.get("owned_by") or item.get("owner") or "").strip(),
                    })
            elif isinstance(item, str) and item.strip():
                models.append({"id": item.strip(), "owned_by": ""})
    seen = set()
    unique = []
    for item in models:
        key = item["id"]
        if key in seen:
            continue
        seen.add(key)
        unique.append(item)
    unique.sort(key=lambda item: item["id"].casefold())
    return {"success": True, "base_url": base_url, "models": unique, "count": len(unique)}


def _update_bridge_settings(data):
    config = dict(LOCAL_CONFIG) if isinstance(LOCAL_CONFIG, dict) else {}
    current = dict(_bridge_settings())
    for key in DEFAULT_BRIDGE_SETTINGS:
        if key not in data:
            continue
        value = data.get(key)
        if key == "show_startup_wizard":
            current[key] = bool(value)
        elif key in _SETTING_CHOICES:
            value = str(value or "").strip()
            if value in _SETTING_CHOICES[key]:
                current[key] = value
    config["settings"] = current
    _write_local_config(config)
    _apply_local_config(config)
    return _settings_response()


def _normalize_imported_tag_item(item):
    if not isinstance(item, dict):
        return None
    prompt = _truncate_text(item.get("prompt") or item.get("text") or "", MAX_STYLE_NAME_LENGTH).strip()
    if not prompt:
        return None
    local = _truncate_text(item.get("local") or item.get("name") or item.get("zh") or "", MAX_STYLE_NAME_LENGTH).strip()
    group = _truncate_text(item.get("group") or "", MAX_STYLE_NAME_LENGTH).strip()
    subgroup = _truncate_text(item.get("subgroup") or item.get("category") or "", MAX_STYLE_NAME_LENGTH).strip()
    kind = _validate_kind(item.get("kind") or item.get("type") or "positive")
    return {
        "prompt": prompt,
        "local": local,
        "group": group,
        "subgroup": subgroup,
        "kind": kind,
    }


def _import_custom_tags(items):
    config = dict(LOCAL_CONFIG) if isinstance(LOCAL_CONFIG, dict) else {}
    current = config.get("custom_tags")
    if not isinstance(current, list):
        current = []
    seen = {
        (
            str(item.get("prompt") or "").casefold(),
            str(item.get("local") or "").casefold(),
            str(item.get("group") or "").casefold(),
            str(item.get("subgroup") or "").casefold(),
            str(item.get("kind") or "positive"),
        )
        for item in current
        if isinstance(item, dict)
    }
    imported = []
    for item in items[:2000]:
        normalized = _normalize_imported_tag_item(item)
        if not normalized:
            continue
        key = (
            normalized["prompt"].casefold(),
            normalized["local"].casefold(),
            normalized["group"].casefold(),
            normalized["subgroup"].casefold(),
            normalized["kind"],
        )
        if key in seen:
            continue
        seen.add(key)
        imported.append(normalized)
    if imported:
        current.extend(imported)
        config["custom_tags"] = current[-5000:]
        settings = dict(_bridge_settings())
        settings["data_source"] = "builtin" if settings.get("data_source") == "webui" else settings.get("data_source", "auto")
        settings["show_startup_wizard"] = False
        config["settings"] = settings
        _write_local_config(config)
        _apply_local_config(config)
    return {
        "success": True,
        "imported": len(imported),
        "total": len(config.get("custom_tags") or current),
        **_settings_response(),
    }


def _prompt_market_sources_response():
    sources = []
    imported_sources = LOCAL_CONFIG.get("prompt_market_imports") if isinstance(LOCAL_CONFIG, dict) else {}
    if not isinstance(imported_sources, dict):
        imported_sources = {}
    for source_id, source in PROMPT_MARKET_SOURCES.items():
        imported = imported_sources.get(source_id) if isinstance(imported_sources.get(source_id), dict) else {}
        sources.append({
            "id": source_id,
            "label": source["label"],
            "description": source.get("description", ""),
            "license": source.get("license", ""),
            "open_url": source.get("open_url", ""),
            "importable": bool(source.get("importable")),
            "limit": source.get("limit"),
            "imported": bool(imported),
            "imported_at": imported.get("imported_at", ""),
            "imported_count": imported.get("downloaded", 0),
            "last_added": imported.get("imported", 0),
        })
    return {"success": True, "sources": sources}


def _download_prompt_market_text(source):
    request = urllib.request.Request(
        source["download_url"],
        headers={"User-Agent": "ComfyUI-WebUI-Prompt-Bridge"},
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        content = response.read(10 * 1024 * 1024 + 1)
    if len(content) > 10 * 1024 * 1024:
        raise ValueError("downloaded prompt market file is too large")
    return content.decode("utf-8-sig", errors="replace")


def _infer_prompt_market_kind(*values):
    text = " ".join(str(value or "").lower().replace("_", " ").replace("-", " ") for value in values)
    negative_markers = (
        "negative", "反向", "负面", "低质量", "错误", "bad", "worst", "low quality",
        "malformed", "mutated", "deformed", "watermark",
    )
    return "negative" if any(marker in text for marker in negative_markers) else "positive"


def _items_from_prompt_all_in_one_yaml(text, source):
    data = yaml.safe_load(text) or []
    groups = _normalize_prompt_group_data(data, "marketTags")
    items = []
    for group in groups:
        group_name = str(group.get("name") or source["label"]).strip()
        for sub_group in group.get("groups") or []:
            subgroup_name = str(sub_group.get("name") or "提示词").strip()
            kind = _infer_prompt_market_kind(group_name, subgroup_name)
            for tag in sub_group.get("tags") or []:
                prompt = str(tag.get("prompt") or "").strip()
                if not prompt:
                    continue
                items.append({
                    "prompt": prompt,
                    "local": str(tag.get("local") or "").strip(),
                    "group": group_name,
                    "subgroup": subgroup_name,
                    "kind": kind,
                })
    return items


def _items_from_tagcomplete_csv(text, source):
    rows = csv.reader(text.splitlines())
    items = []
    group = str(source.get("group") or source["label"]).strip()
    limit = int(source.get("limit") or 1000)
    zh_map = _load_tag_translation_map()
    for row in rows:
        if len(row) < 2:
            continue
        prompt = str(row[0] or "").strip()
        tag_type = str(row[1] or "").strip()
        if not prompt or prompt.startswith("#"):
            continue
        subgroup = TAGCOMPLETE_TYPE_LABELS.get(tag_type, "其他")
        local = str(row[2] or "").strip() if len(row) > 2 and not str(row[2] or "").strip().isdigit() else ""
        local = zh_map.get(prompt.casefold(), local)
        kind = _infer_prompt_market_kind(prompt, local, group, subgroup)
        items.append({
            "prompt": prompt,
            "local": local,
            "group": group,
            "subgroup": subgroup,
            "kind": kind,
        })
        if len(items) >= limit:
            break
    return items


def _items_from_prompt_groups(groups, source):
    items = []
    for group in groups or []:
        if not isinstance(group, dict):
            continue
        group_name = str(group.get("name") or source["label"]).strip()
        kind = "negative" if group_name == "反向提示词" else "positive"
        for sub_group in group.get("groups") or []:
            if not isinstance(sub_group, dict) or sub_group.get("type") == "wrap":
                continue
            subgroup_name = str(sub_group.get("name") or "提示词").strip()
            sub_kind = _infer_prompt_market_kind(group_name, subgroup_name)
            for tag in sub_group.get("tags") or []:
                prompt = str(tag.get("prompt") or "").strip()
                if not prompt:
                    continue
                items.append({
                    "prompt": prompt,
                    "local": str(tag.get("local") or "").strip(),
                    "group": group_name,
                    "subgroup": subgroup_name,
                    "kind": "negative" if kind == "negative" or sub_kind == "negative" else "positive",
                })
    return items


def _items_from_current_bridge_library(source):
    items = []
    webui_groups = _load_webui_prompt_all_in_one_group_tags("zh_CN")
    if webui_groups:
        items.extend(_items_from_prompt_groups(webui_groups, source))

    tag_file = TAGCOMPLETE_DIR / "tags" / "danbooru.csv"
    if tag_file.exists():
        try:
            with tag_file.open("r", encoding="utf-8-sig", newline="") as file:
                tag_text = file.read()
            tag_source = dict(source)
            tag_source["group"] = "WebUI TagComplete"
            tag_source["limit"] = min(int(source.get("limit") or 2000), max(0, int(source.get("limit") or 2000) - len(items)))
            if tag_source["limit"] > 0:
                items.extend(_items_from_tagcomplete_csv(tag_text, tag_source))
        except Exception:
            pass
    if not items:
        try:
            online_source = PROMPT_MARKET_SOURCES["prompt_all_in_one_zh_cn"]
            text = _download_prompt_market_text(online_source)
            items.extend(_items_from_prompt_all_in_one_yaml(text, online_source))
        except Exception:
            pass
    if len(items) < int(source.get("limit") or 2000):
        try:
            online_source = dict(PROMPT_MARKET_SOURCES["tagcomplete_danbooru_top"])
            online_source["group"] = "Danbooru"
            online_source["limit"] = min(
                int(online_source.get("limit") or 1200),
                max(0, int(source.get("limit") or 2000) - len(items)),
            )
            if online_source["limit"] > 0:
                text = _download_prompt_market_text(online_source)
                items.extend(_items_from_tagcomplete_csv(text, online_source))
        except Exception:
            pass
    if not items and _should_use_builtin_prompt_data(webui_groups):
        items.extend(_items_from_prompt_groups(_builtin_prompt_all_in_one_group_tags("zh_CN"), source))
    return items[: int(source.get("limit") or 2000)]


def _load_prompt_market_items(source_id):
    source = PROMPT_MARKET_SOURCES.get(source_id)
    if not source:
        raise ValueError("unknown prompt market source")
    if not source.get("importable"):
        raise ValueError("this prompt market source can only be opened in browser")
    source_format = source.get("format")
    if source_format == "current_bridge_library":
        items = _items_from_current_bridge_library(source)
    elif source.get("download_url"):
        text = _download_prompt_market_text(source)
        if source_format == "prompt_all_in_one_yaml":
            items = _items_from_prompt_all_in_one_yaml(text, source)
        elif source_format == "tagcomplete_csv":
            items = _items_from_tagcomplete_csv(text, source)
        else:
            raise ValueError("unsupported prompt market format")
    else:
        raise ValueError("this prompt market source has no downloadable or local data")
    if not items:
        raise ValueError("没有读到可导入的 WebUI/本地词库，请先连接 WebUI 或下载本地数据包")
    return source, items


def _import_prompt_market_source(source_id):
    source, items = _load_prompt_market_items(source_id)
    result = _import_custom_tags(items)
    config = dict(LOCAL_CONFIG) if isinstance(LOCAL_CONFIG, dict) else {}
    imported_sources = config.get("prompt_market_imports")
    if not isinstance(imported_sources, dict):
        imported_sources = {}
    imported_sources[source_id] = {
        "label": source["label"],
        "imported_at": datetime.datetime.now().isoformat(timespec="seconds"),
        "downloaded": len(items),
        "imported": result.get("imported", 0),
    }
    config["prompt_market_imports"] = imported_sources
    _write_local_config(config)
    _apply_local_config(config)
    return {
        **result,
        "source": {
            "id": source_id,
            "label": source["label"],
            "open_url": source.get("open_url", ""),
        },
        "downloaded": len(items),
        "imported_at": imported_sources[source_id]["imported_at"],
    }


def _custom_tag_response():
    custom_tags = LOCAL_CONFIG.get("custom_tags") if isinstance(LOCAL_CONFIG, dict) else []
    if not isinstance(custom_tags, list):
        custom_tags = []
    return {
        "success": True,
        "items": custom_tags,
        "total": len(custom_tags),
        **_settings_response(),
    }


def _delete_custom_tag(index):
    config = dict(LOCAL_CONFIG) if isinstance(LOCAL_CONFIG, dict) else {}
    current = config.get("custom_tags")
    if not isinstance(current, list):
        current = []
    if index < 0 or index >= len(current):
        raise ValueError("custom tag index out of range")
    current.pop(index)
    config["custom_tags"] = current
    _write_local_config(config)
    _apply_local_config(config)
    return _custom_tag_response()


def _update_custom_tag(index, item):
    normalized = _normalize_imported_tag_item(item)
    if not normalized:
        raise ValueError("custom tag needs a prompt")
    config = dict(LOCAL_CONFIG) if isinstance(LOCAL_CONFIG, dict) else {}
    current = config.get("custom_tags")
    if not isinstance(current, list):
        current = []
    if index < 0 or index >= len(current):
        current.append(normalized)
    else:
        current[index] = normalized
    config["custom_tags"] = current[-5000:]
    settings = dict(_bridge_settings())
    settings["data_source"] = "builtin" if settings.get("data_source") == "webui" else settings.get("data_source", "auto")
    settings["show_startup_wizard"] = False
    config["settings"] = settings
    _write_local_config(config)
    _apply_local_config(config)
    return _custom_tag_response()


def _asset_target(parent, spec):
    return parent / spec["directory"]


def _asset_exists(path):
    try:
        return path.exists() and path.is_dir() and any(path.iterdir())
    except Exception:
        return False


def _bridge_asset_status(webui_root=None):
    local = {}
    webui = {}
    local_parent = DATA_DIR
    root = _existing_path(webui_root) or WEBUI_ROOT
    webui_parent = root / "extensions" if root else None
    for key, spec in EXTENSION_ASSETS.items():
        local_path = _asset_target(local_parent, spec)
        local[key] = {
            "label": spec["label"],
            "path": _path_text(local_path),
            "exists": _asset_exists(local_path),
        }
        if webui_parent:
            webui_path = _asset_target(webui_parent, spec)
            webui[key] = {
                "label": spec["label"],
                "path": _path_text(webui_path),
                "exists": _asset_exists(webui_path),
            }
    return {"local": local, "webui": webui}


def _ensure_within_parent(path, parent):
    path = Path(path).resolve()
    parent = Path(parent).resolve()
    if not path.is_relative_to(parent):
        raise ValueError("Unsafe extension install path")
    return path


def _remove_partial_directory(path, parent):
    path = _ensure_within_parent(path, parent)
    if path.exists():
        shutil.rmtree(path)


def _safe_extract_zip(zip_path, extract_dir):
    extract_dir = Path(extract_dir).resolve()
    with zipfile.ZipFile(zip_path) as archive:
        for member in archive.infolist():
            destination = (extract_dir / member.filename).resolve()
            if not destination.is_relative_to(extract_dir):
                raise ValueError("Downloaded archive contains unsafe paths")
        archive.extractall(extract_dir)


def _download_asset_zip(spec, target, parent):
    parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="webui-bridge-", dir=str(parent)) as tmp:
        tmp_path = Path(tmp)
        zip_path = tmp_path / "asset.zip"
        request = urllib.request.Request(
            spec["zip_url"],
            headers={"User-Agent": "ComfyUI-WebUI-Prompt-Bridge"},
        )
        with urllib.request.urlopen(request, timeout=90) as response, zip_path.open("wb") as file:
            shutil.copyfileobj(response, file)
        extract_dir = tmp_path / "extract"
        extract_dir.mkdir()
        _safe_extract_zip(zip_path, extract_dir)
        children = [child for child in extract_dir.iterdir() if child.is_dir()]
        source = children[0] if len(children) == 1 else extract_dir
        if target.exists():
            _remove_partial_directory(target, parent)
        shutil.move(str(source), str(target))
    return "zip"


def _install_extension_asset(key, parent):
    spec = EXTENSION_ASSETS[key]
    target = _ensure_within_parent(_asset_target(parent, spec), parent)
    parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and not _asset_exists(target):
        target.rmdir()
    if _asset_exists(target):
        return {
            "id": key,
            "label": spec["label"],
            "status": "exists",
            "path": _path_text(target),
        }

    errors = []
    git_exe = shutil.which("git")
    if git_exe:
        result = subprocess.run(
            [git_exe, "clone", "--depth", "1", spec["repo_url"], str(target)],
            capture_output=True,
            text=True,
            timeout=300,
        )
        if result.returncode == 0 and _asset_exists(target):
            return {
                "id": key,
                "label": spec["label"],
                "status": "installed",
                "method": "git",
                "path": _path_text(target),
            }
        errors.append((result.stderr or result.stdout or "git clone failed").strip())
        if target.exists():
            _remove_partial_directory(target, parent)

    try:
        method = _download_asset_zip(spec, target, parent)
        return {
            "id": key,
            "label": spec["label"],
            "status": "installed",
            "method": method,
            "path": _path_text(target),
        }
    except Exception as exc:
        errors.append(str(exc))
        if target.exists():
            _remove_partial_directory(target, parent)
        return {
            "id": key,
            "label": spec["label"],
            "status": "error",
            "error": "；".join(error for error in errors if error) or "download failed",
            "path": _path_text(target),
        }


def _install_extension_assets(data):
    mode = str(data.get("mode") or "local").strip().lower()
    if mode not in {"local", "webui"}:
        raise ValueError("mode must be local or webui")
    selected = data.get("assets") or list(EXTENSION_ASSETS.keys())
    selected = [key for key in selected if key in EXTENSION_ASSETS]
    if not selected:
        selected = list(EXTENSION_ASSETS.keys())

    root = None
    if mode == "webui":
        root_text = _truncate_text(data.get("webui_root") or data.get("root") or "", MAX_WEBUI_ROOT_LENGTH)
        root = _existing_path(root_text) or WEBUI_ROOT
        if not root:
            guesses = _guess_webui_roots()
            root = _existing_path(guesses[0]) if guesses else None
        if not root or not _looks_like_webui_root(root):
            raise ValueError("没有可用 WebUI 根目录；如果用户没有 WebUI，请使用“下载本地数据包”")
        parent = root / "extensions"
    else:
        parent = DATA_DIR

    results = [_install_extension_asset(key, parent) for key in selected]
    ok = all(item["status"] in {"exists", "installed"} for item in results)
    if ok:
        config = dict(LOCAL_CONFIG) if isinstance(LOCAL_CONFIG, dict) else {}
        settings = dict(_bridge_settings())
        settings["data_source"] = "auto"
        settings["translation_source"] = "auto"
        settings["show_startup_wizard"] = False
        config["settings"] = settings
        if mode == "webui":
            config.update(_build_webui_config(root))
        else:
            config["prompt_all_in_one_dir"] = _path_text(DATA_DIR / EXTENSION_ASSETS["prompt_all_in_one"]["directory"])
            config["tagcomplete_dir"] = _path_text(DATA_DIR / EXTENSION_ASSETS["tagcomplete"]["directory"])
            config.setdefault("storage_dir", _path_text(DATA_DIR / "storage"))
        _write_local_config(config)
        _apply_local_config(config)

    return {
        "ok": ok,
        "mode": mode,
        "webui_root": _path_text(root),
        "results": results,
        **_settings_response(),
    }


def _regional_split_prompt(text):
    """Split Regional Prompter style text while keeping explicit separators."""
    parts = []
    separators = []
    source = text or ""
    last = 0
    for match in _REGIONAL_SEPARATOR_RE.finditer(source):
        chunk = source[last:match.start()].strip()
        if chunk:
            parts.append(chunk)
        separators.append(match.group(1).upper())
        last = match.end()
    tail = source[last:].strip()
    if tail:
        parts.append(tail)
    return parts, separators


def _regional_float(value, default):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _regional_ratio_row(text):
    values = []
    for raw in re.split(r"[,，\s]+", str(text or "")):
        if not raw:
            continue
        value = _regional_float(raw, 0.0)
        if value > 0:
            values.append(value)
    return values or [1.0]


def _regional_parse_ratio_grid(ratios, split):
    ratio_text = str(ratios or "").strip()
    if split == "grid" or ";" in ratio_text or "；" in ratio_text:
        rows = [_regional_ratio_row(row) for row in re.split(r"[;；]+", ratio_text) if row.strip()]
        return rows or [[1.0, 1.0]]
    return [_regional_ratio_row(ratio_text)]


def _regional_cells_from_ratios(ratios, split, region_count):
    rows = _regional_parse_ratio_grid(ratios, split)
    cells = []
    if split == "vertical":
        row = rows[0]
        total = sum(row) or 1.0
        y = 0.0
        for value in row:
            height = value / total
            cells.append({"x": 0.0, "y": y, "width": 1.0, "height": height})
            y += height
    elif split == "horizontal":
        row = rows[0]
        total = sum(row) or 1.0
        x = 0.0
        for value in row:
            width = value / total
            cells.append({"x": x, "y": 0.0, "width": width, "height": 1.0})
            x += width
    else:
        row_totals = [sum(row) or 1.0 for row in rows]
        total_y = sum(row_totals) or 1.0
        y = 0.0
        for row, row_total in zip(rows, row_totals):
            height = row_total / total_y
            x = 0.0
            total_x = sum(row) or 1.0
            for value in row:
                width = value / total_x
                cells.append({"x": x, "y": y, "width": width, "height": height})
                x += width
            y += height

    if not cells:
        cells = [{"x": 0.0, "y": 0.0, "width": 1.0, "height": 1.0}]
    while len(cells) < region_count:
        cells.append(cells[-1].copy())
    return cells[:region_count]


def _regional_prepare_prompt_parts(text, base_enabled=False, common_enabled=False):
    parts, separators = _regional_split_prompt(text)
    explicit_base = "ADDBASE" in separators
    explicit_common = "ADDCOMM" in separators
    base_enabled = bool(base_enabled or explicit_base)
    common_enabled = bool(common_enabled or explicit_common)
    grid_requested = any(separator in _REGIONAL_GRID_SEPARATORS for separator in separators)

    common = ""
    base = ""
    index = 0
    if common_enabled and index < len(parts):
        common = parts[index]
        index += 1
    if base_enabled and index < len(parts):
        base = parts[index]
        index += 1

    regions = [part for part in parts[index:] if part.strip()]
    if not regions and base:
        regions = [base]
        base = ""
        base_enabled = False
    if not regions and common:
        regions = [common]
        common = ""
        common_enabled = False
    if not regions:
        regions = [(text or "").strip()]

    if common:
        regions = [f"{common}, {region}".strip(" ,") for region in regions]

    return {
        "base": base,
        "regions": regions,
        "base_enabled": base_enabled and bool(base),
        "common_enabled": common_enabled and bool(common),
        "grid_requested": grid_requested,
    }


def _regional_prepare_negative_parts(text, region_count):
    parts, _ = _regional_split_prompt(text)
    parts = [part for part in parts if part.strip()]
    if not parts:
        return ["" for _ in range(region_count)]
    if len(parts) == 1:
        return [parts[0] for _ in range(region_count)]
    while len(parts) < region_count:
        parts.append(parts[-1])
    return parts[:region_count]


def _conditioning_set_values(conditioning, values):
    result = []
    for item in conditioning:
        metadata = dict(item[1]) if len(item) > 1 and isinstance(item[1], dict) else {}
        metadata.update(values)
        result.append([item[0], metadata])
    return result


def _conditioning_set_area(conditioning, cell, strength):
    return _conditioning_set_values(conditioning, {
        "area": ("percentage", cell["height"], cell["width"], cell["y"], cell["x"]),
        "strength": strength,
        "set_area_to_bounds": False,
    })


def _regional_encode(clip, text, cell=None, strength=1.0):
    conditioning = clip.encode_from_tokens_scheduled(clip.tokenize(text or ""))
    if cell is None:
        return _conditioning_set_values(conditioning, {"strength": strength})
    return _conditioning_set_area(conditioning, cell, strength)


def _build_regional_conditioning(clip, positive_text, negative_text, split, ratios, base_enabled, common_enabled, base_ratio, strength):
    positive_parts = _regional_prepare_prompt_parts(positive_text, base_enabled, common_enabled)
    regions = positive_parts["regions"]
    if len(regions) <= 1 and not positive_parts["base_enabled"]:
        return None

    split = "grid" if positive_parts["grid_requested"] else (split or "vertical")
    if split not in {"vertical", "horizontal", "grid"}:
        split = "vertical"

    region_count = len(regions)
    cells = _regional_cells_from_ratios(ratios, split, region_count)
    base_ratio = min(1.0, max(0.0, _regional_float(base_ratio, 0.0)))
    strength = max(0.0, _regional_float(strength, 1.0))
    region_strength = strength * max(0.0, 1.0 - base_ratio if positive_parts["base_enabled"] else 1.0)

    positive = []
    if positive_parts["base_enabled"] and base_ratio > 0:
        positive.extend(_regional_encode(clip, positive_parts["base"], None, base_ratio * strength))
    for region, cell in zip(regions, cells):
        positive.extend(_regional_encode(clip, region, cell, region_strength))

    negative_regions = _regional_prepare_negative_parts(negative_text, region_count)
    if len(set(negative_regions)) == 1:
        negative = clip.encode_from_tokens_scheduled(clip.tokenize(negative_regions[0] or ""))
    else:
        negative = []
        for region, cell in zip(negative_regions, cells):
            negative.extend(_regional_encode(clip, region, cell, 1.0))

    return {
        "positive": positive,
        "negative": negative,
        "region_count": region_count,
        "split": split,
        "base_enabled": positive_parts["base_enabled"],
        "common_enabled": positive_parts["common_enabled"],
    }


class WebUIPromptBridge:
    CATEGORY = "conditioning/webui"
    FUNCTION = "build"
    RETURN_TYPES = ("MODEL", "CLIP", "CONDITIONING", "CONDITIONING", "STRING", "STRING", "STRING")
    RETURN_NAMES = ("model", "clip", "positive", "negative", "positive_text", "negative_text", "lora_info")

    def __init__(self):
        self.loaded_loras = {}

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "clip": ("CLIP",),
                "positive_prompt": (
                    "STRING",
                    {
                        "default": "masterpiece, best quality, anime style, 1girl, <lora:anima-highres-aesthetic-boost:0.65>",
                        "multiline": True,
                    },
                ),
                "negative_prompt": (
                    "STRING",
                    {
                        "default": "worst quality, low quality, blurry, bad anatomy, extra fingers",
                        "multiline": True,
                    },
                ),
                "default_clip_strength": ("FLOAT", {"default": 1.0, "min": -10.0, "max": 10.0, "step": 0.05}),
                "fail_on_missing_lora": ("BOOLEAN", {"default": True}),
                "regional_enabled": ("BOOLEAN", {"default": False}),
                "regional_mode": (["matrix"], {"default": "matrix"}),
                "regional_split": (["vertical", "horizontal", "grid"], {"default": "vertical"}),
                "regional_ratios": ("STRING", {"default": "1,1", "multiline": False}),
                "regional_base_enabled": ("BOOLEAN", {"default": False}),
                "regional_common_enabled": ("BOOLEAN", {"default": False}),
                "regional_base_ratio": ("FLOAT", {"default": 0.2, "min": 0.0, "max": 1.0, "step": 0.05}),
                "regional_strength": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 10.0, "step": 0.05}),
            },
            "hidden": {
                "prompt": "PROMPT",
                "unique_id": "UNIQUE_ID",
            },
        }

    def _load_lora(self, lora_name):
        lora_path = folder_paths.get_full_path_or_raise("loras", lora_name)
        cached = self.loaded_loras.get(lora_path)
        if cached is None:
            cached = comfy.utils.load_torch_file(lora_path, safe_load=True)
            self.loaded_loras[lora_path] = cached
        return cached

    def build(
        self,
        model,
        clip,
        positive_prompt,
        negative_prompt,
        default_clip_strength,
        fail_on_missing_lora,
        regional_enabled=False,
        regional_mode="matrix",
        regional_split="vertical",
        regional_ratios="1,1",
        regional_base_enabled=False,
        regional_common_enabled=False,
        regional_base_ratio=0.2,
        regional_strength=1.0,
        prompt=None,
        unique_id=None,
    ):
        try:
            default_clip_strength = float(default_clip_strength)
        except (TypeError, ValueError):
            default_clip_strength = 1.0

        positive_text, positive_loras = _parse_lora_tags(positive_prompt)
        negative_text, negative_loras = _parse_lora_tags(negative_prompt)

        applied = []
        skipped_upstream = []
        missing = []
        upstream_loras = _collect_upstream_loras_from_prompt(prompt, unique_id)
        model_output_connected = _prompt_output_has_consumers(prompt, unique_id, 0)
        for requested, strength_model, strength_clip in [*positive_loras, *negative_loras]:
            resolved = _resolve_lora_name(requested)
            if resolved is None:
                missing.append(requested)
                continue

            if _lora_key(resolved) in upstream_loras or _lora_key(requested) in upstream_loras:
                skipped_upstream.append(resolved)
                continue

            if strength_clip is None:
                strength_clip = default_clip_strength

            if strength_model == 0 and strength_clip == 0:
                continue

            lora = self._load_lora(resolved)
            model, clip = comfy.sd.load_lora_for_models(model, clip, lora, strength_model, strength_clip)
            applied.append(f"{resolved}:model={strength_model:g}:clip={strength_clip:g}")
            print(f"[WebUIPromptBridge] Applied LoRA: {resolved} model={strength_model:g} clip={strength_clip:g}")

        if missing and fail_on_missing_lora:
            raise ValueError("Missing LoRA(s): " + ", ".join(missing))

        regional_info = None
        if regional_enabled:
            if regional_mode != "matrix":
                regional_info = {"warning": f"Unsupported regional mode: {regional_mode}"}
            else:
                try:
                    regional_info = _build_regional_conditioning(
                        clip,
                        positive_text,
                        negative_text,
                        regional_split,
                        regional_ratios,
                        regional_base_enabled,
                        regional_common_enabled,
                        regional_base_ratio,
                        regional_strength,
                    )
                except Exception as error:
                    regional_info = {"warning": f"Regional conditioning disabled: {error}"}

        if regional_info and "positive" in regional_info:
            positive = regional_info["positive"]
            negative = regional_info["negative"]
        else:
            positive = clip.encode_from_tokens_scheduled(clip.tokenize(positive_text))
            negative = clip.encode_from_tokens_scheduled(clip.tokenize(negative_text))
        info = "Applied LoRAs: " + (", ".join(applied) if applied else "None")
        if regional_enabled:
            if regional_info and "positive" in regional_info:
                info += (
                    f" | Regional: {regional_info['region_count']} {regional_info['split']} region(s)"
                    f", base={'on' if regional_info['base_enabled'] else 'off'}"
                    f", common={'on' if regional_info['common_enabled'] else 'off'}"
                )
            elif regional_info and regional_info.get("warning"):
                info += " | " + regional_info["warning"]
            else:
                info += " | Regional: no BREAK/region parts found; using normal conditioning"
        if applied and not model_output_connected:
            warning = "Bridge model output is not connected; LoRA model changes will not reach the sampler"
            info += " | Warning: " + warning
            print(f"[WebUIPromptBridge] Warning: {warning}")
        if skipped_upstream:
            info += " | Upstream LoRAs already loaded: " + ", ".join(skipped_upstream)
            print("[WebUIPromptBridge] Upstream LoRAs already loaded: " + ", ".join(skipped_upstream))
        if missing:
            info += " | Missing LoRAs: " + ", ".join(missing)
            print("[WebUIPromptBridge] Missing LoRAs: " + ", ".join(missing))

        return (model, clip, positive, negative, positive_text, negative_text, info)


NODE_CLASS_MAPPINGS = {
    "WebUIPromptBridge": WebUIPromptBridge,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "WebUIPromptBridge": "WebUI Prompt Bridge",
}


def _register_routes():
    try:
        import server
        from aiohttp import web
    except Exception:
        return

    prompt_server = getattr(server.PromptServer, "instance", None)
    if prompt_server is None:
        return
    routes = prompt_server.routes

    def reject_cross_origin(request):
        if _validate_same_origin_request(request):
            return None
        return web.json_response({"error": "Cross-origin requests are not allowed"}, status=403)

    @routes.get("/webui_prompt_bridge/settings")
    async def bridge_settings_get(request):
        return web.json_response(_settings_response())

    @routes.post("/webui_prompt_bridge/settings")
    async def bridge_settings_post(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        try:
            data = await request.json()
        except Exception:
            data = {}
        return web.json_response(_update_bridge_settings(data))

    @routes.get("/webui_prompt_bridge/ai_config")
    async def bridge_ai_config_get(request):
        return web.json_response(_ai_config_response())

    @routes.post("/webui_prompt_bridge/ai_config")
    async def bridge_ai_config_post(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        try:
            data = await request.json()
        except Exception:
            data = {}
        return web.json_response(_update_ai_config(data))

    @routes.post("/webui_prompt_bridge/ai_config/test")
    async def bridge_ai_config_test(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        try:
            data = await request.json()
        except Exception:
            data = {}
        try:
            return web.json_response(_test_ai_config(data.get("prompt") or "Generate a short Stable Diffusion prompt for a girl in a garden."))
        except Exception as exc:
            return web.json_response({"success": False, "error": str(exc)}, status=400)

    @routes.post("/webui_prompt_bridge/ai_config/models")
    async def bridge_ai_config_models(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        try:
            data = await request.json()
        except Exception:
            data = {}
        try:
            return web.json_response(_list_ai_models(data))
        except Exception as exc:
            return web.json_response({"success": False, "error": str(exc)}, status=400)

    @routes.post("/webui_prompt_bridge/import_tags")
    async def bridge_import_tags(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        try:
            data = await request.json()
        except Exception:
            data = {}
        items = data.get("items") or data.get("tags") or []
        if not isinstance(items, list):
            return web.json_response({"error": "items must be a list"}, status=400)
        return web.json_response(_import_custom_tags(items))

    @routes.get("/webui_prompt_bridge/custom_tags")
    async def bridge_custom_tags_get(request):
        return web.json_response(_custom_tag_response())

    @routes.post("/webui_prompt_bridge/custom_tags")
    async def bridge_custom_tags_post(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        try:
            data = await request.json()
            index = int(data.get("index", -1))
            item = data.get("item") or data
            return web.json_response(_update_custom_tag(index, item))
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)

    @routes.delete("/webui_prompt_bridge/custom_tags")
    async def bridge_custom_tags_delete(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        try:
            index = int(request.query.get("index", "-1"))
            return web.json_response(_delete_custom_tag(index))
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)

    @routes.get("/webui_prompt_bridge/prompt_market")
    async def bridge_prompt_market_get(request):
        return web.json_response(_prompt_market_sources_response())

    @routes.post("/webui_prompt_bridge/prompt_market/import")
    async def bridge_prompt_market_import(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        try:
            data = await request.json()
        except Exception:
            data = {}
        try:
            source_id = str(data.get("source_id") or data.get("id") or "").strip()
            return web.json_response(_import_prompt_market_source(source_id))
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)

    @routes.post("/webui_prompt_bridge/install_assets")
    async def bridge_install_assets(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        try:
            data = await request.json()
        except Exception:
            data = {}
        try:
            result = _install_extension_assets(data)
            return web.json_response(result, status=200 if result.get("ok") else 500)
        except Exception as exc:
            return web.json_response({
                "ok": False,
                "error": str(exc),
                **_settings_response(),
            }, status=400)

    @routes.get("/webui_prompt_bridge/webui_integration")
    async def webui_integration_get(request):
        return web.json_response({
            **_webui_integration_status(),
            "assets": _bridge_asset_status(),
            "guesses": _guess_webui_roots(),
        })

    @routes.post("/webui_prompt_bridge/webui_integration")
    async def webui_integration_post(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        data = await request.json()
        root = _truncate_text(data.get("webui_root") or data.get("root") or "", MAX_WEBUI_ROOT_LENGTH)
        if not root and data.get("auto_detect"):
            guesses = _guess_webui_roots()
            root = guesses[0] if guesses else ""
        if not root:
            return web.json_response({
                "ok": False,
                "error": "没有自动检测到 WebUI 根目录，请手动粘贴 WebUI 根目录，例如 H:/sd-webui-aki-v4.9",
                "guesses": _guess_webui_roots(),
            }, status=400)
        try:
            config = dict(LOCAL_CONFIG)
            config.update(_build_webui_config(root))
            settings = dict(_bridge_settings())
            settings["data_source"] = "auto"
            settings["show_startup_wizard"] = False
            config["settings"] = settings
            _write_local_config(config)
            _apply_local_config(config)
            added_model_paths = _apply_webui_model_paths(root)
            return web.json_response({
                "ok": True,
                "message": "WebUI data connected",
                **_webui_integration_status(root),
                "assets": _bridge_asset_status(root),
                "added_model_paths": added_model_paths,
                "guesses": _guess_webui_roots(),
            })
        except Exception as exc:
            return web.json_response({
                "ok": False,
                "error": str(exc),
                "guesses": _guess_webui_roots(),
            }, status=400)

    @routes.get("/webui_prompt_bridge/models")
    async def list_models(request):
        def filenames(kind):
            try:
                return folder_paths.get_filename_list(kind)
            except Exception:
                return []

        return web.json_response({
            "checkpoints": filenames("checkpoints"),
            "unets": filenames("unet") or filenames("diffusion_models"),
            "clips": filenames("clip"),
            "vaes": filenames("vae"),
            "embeddings": filenames("embeddings"),
        })

    @routes.get("/webui_prompt_bridge/loras")
    async def list_loras(request):
        detail = str(request.query.get("detail", "full") or "full").casefold()
        basic = detail in {"basic", "lite", "light"}
        try:
            loras = folder_paths.get_filename_list("loras")
        except Exception:
            loras = []
        items = []
        for name in loras:
            stem = _strip_extension(name).replace("\\", "/")
            folder, filename, base_name = _lora_folder_and_base(name)
            thumbnail = None
            description = ""
            user_metadata = {}
            raw_metadata = {}
            detected_sd_version = ""
            created = 0
            modified = 0
            if basic:
                thumbnail = f"/webui_prompt_bridge/lora_thumbnail?name={quote(name, safe='')}"
            else:
                try:
                    lora_path = folder_paths.get_full_path("loras", name)
                    if _find_lora_preview_path(lora_path):
                        thumbnail = f"/webui_prompt_bridge/lora_thumbnail?name={quote(name, safe='')}"
                    description = _find_lora_description(lora_path)
                    user_metadata = _read_lora_user_metadata(lora_path, description)
                    raw_metadata = _read_lora_raw_metadata(lora_path)
                    detected_sd_version = _detect_lora_sd_version(raw_metadata, _lora_metadata_summary(name))
                    stat = Path(lora_path).stat() if lora_path else None
                    if stat:
                        created = int(getattr(stat, "st_ctime", 0))
                        modified = int(getattr(stat, "st_mtime", 0))
                except Exception:
                    thumbnail = None
            display_description = user_metadata.get("description") or description
            metadata_aliases = [
                value for value in (
                    raw_metadata.get("ss_output_name") if isinstance(raw_metadata, dict) else "",
                    raw_metadata.get("modelspec.title") if isinstance(raw_metadata, dict) else "",
                )
                if value
            ]
            try:
                preferred_weight = float(user_metadata.get("preferred weight") or 0)
            except Exception:
                preferred_weight = 0
            items.append({
                "name": name,
                "alias": stem,
                "folder": folder or "",
                "file_name": filename,
                "base_name": base_name,
                "aliases": metadata_aliases,
                "thumbnail": thumbnail,
                "thumbnail_unknown": basic,
                "description": display_description,
                "user_metadata": user_metadata,
                "manual_category": user_metadata.get("category", "") or user_metadata.get("manual category", ""),
                "category": user_metadata.get("category", "") or user_metadata.get("manual category", ""),
                "activation_text": user_metadata.get("activation text", ""),
                "negative_text": user_metadata.get("negative text", ""),
                "preferred_weight": preferred_weight,
                "sd_version": user_metadata.get("sd version", "") or detected_sd_version,
                "notes": user_metadata.get("notes", ""),
                "search_terms": " ".join([
                    name,
                    stem,
                    folder or "",
                    base_name,
                    " ".join(metadata_aliases),
                    display_description,
                    user_metadata.get("category", "") or user_metadata.get("manual category", ""),
                    user_metadata.get("activation text", ""),
                    user_metadata.get("sd version", "") or detected_sd_version,
                ]).strip(),
                "created": created,
                "modified": modified,
                "prompt": f"<lora:{stem}:1>",
            })
        return web.json_response({"loras": items})

    @routes.get("/webui_prompt_bridge/lora_thumbnail")
    async def lora_thumbnail(request):
        name = request.query.get("name", "")
        if not name:
            return web.Response(status=404)
        resolved = _resolve_lora_name(name)
        if not resolved:
            return web.Response(status=404)
        try:
            lora_path = folder_paths.get_full_path("loras", resolved)
            preview_path = _find_lora_preview_path(lora_path)
        except Exception:
            preview_path = None
        if not preview_path:
            return web.Response(status=404)
        return web.FileResponse(preview_path)

    @routes.get("/webui_prompt_bridge/lora_info")
    async def lora_info(request):
        name = request.query.get("name", "")
        if not name:
            return web.json_response({"error": "LoRA name is required"}, status=400)
        return web.json_response(_lora_metadata_summary(name))

    @routes.get("/webui_prompt_bridge/lora_user_metadata")
    async def lora_user_metadata_get(request):
        name = request.query.get("name", "")
        if not name:
            return web.json_response({"error": "LoRA name is required"}, status=400)
        detail = _lora_detail(name)
        if not detail.get("found"):
            return web.json_response(detail, status=404)
        return web.json_response(detail)

    @routes.post("/webui_prompt_bridge/lora_user_metadata")
    async def lora_user_metadata_post(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        data = await request.json()
        name = _truncate_text(data.get("name", ""), MAX_WEBUI_ROOT_LENGTH)
        resolved = _resolve_lora_name(name)
        if not resolved:
            return web.json_response({"error": "LoRA not found"}, status=404)
        lora_path = folder_paths.get_full_path("loras", resolved)
        updates = {
            "description": _truncate_text(data.get("description", ""), MAX_SHORT_TEXT_LENGTH),
            "category": _truncate_text(data.get("category", ""), MAX_STYLE_NAME_LENGTH),
            "sd version": _truncate_text(data.get("sd_version", "Unknown"), MAX_STYLE_NAME_LENGTH),
            "activation text": _truncate_text(data.get("activation_text", ""), MAX_PROMPT_TEXT_LENGTH),
            "preferred weight": data.get("preferred_weight", 0),
            "negative text": _truncate_text(data.get("negative_text", ""), MAX_PROMPT_TEXT_LENGTH),
            "notes": _truncate_text(data.get("notes", ""), MAX_SHORT_TEXT_LENGTH),
        }
        _write_lora_user_metadata(lora_path, updates)
        return web.json_response(_lora_detail(resolved))

    @routes.post("/webui_prompt_bridge/lora_preview")
    async def lora_preview_post(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        reader = await request.multipart()
        name = ""
        image_bytes = b""
        extension = ".png"
        field = await reader.next()
        while field:
            if field.name == "name":
                name = _truncate_text((await field.text()).strip(), MAX_WEBUI_ROOT_LENGTH)
            elif field.name == "preview":
                filename = field.filename or ""
                suffix = Path(filename).suffix.lower()
                if suffix in (".png", ".jpg", ".jpeg", ".webp"):
                    extension = suffix
                image_bytes = await field.read(decode=False)
            field = await reader.next()
        resolved = _resolve_lora_name(name)
        if not resolved:
            return web.json_response({"error": "LoRA not found"}, status=404)
        if not image_bytes:
            return web.json_response({"error": "Preview image is required"}, status=400)
        if len(image_bytes) > 20 * 1024 * 1024:
            return web.json_response({"error": "Preview image is too large"}, status=400)
        try:
            _validate_preview_image(image_bytes, extension)
        except ValueError as exc:
            return web.json_response({"error": str(exc)}, status=400)
        lora_path = folder_paths.get_full_path("loras", resolved)
        base = Path(lora_path).with_suffix("")
        preview_path = Path(str(base) + f".preview{extension}")
        preview_path.write_bytes(image_bytes)
        return web.json_response(_lora_detail(resolved))

    @routes.get("/webui_prompt_bridge/autocomplete")
    async def autocomplete(request):
        query = request.query.get("q", "")
        try:
            limit = int(request.query.get("limit", "12"))
        except ValueError:
            limit = 12
        return web.json_response({"items": _autocomplete_prompt_tags(query, limit)})

    @routes.get("/webui_prompt_bridge/prompt_all_in_one")
    async def prompt_all_in_one(request):
        lang = request.query.get("lang", "zh_CN")
        group_tags = _load_prompt_all_in_one_group_tags(lang)
        positive_favorites = _load_prompt_all_in_one_favorites("positive")
        negative_favorites = _load_prompt_all_in_one_favorites("negative")
        return web.json_response({
            "group_tags": group_tags,
            "favorites": {
                "positive": positive_favorites,
                "negative": negative_favorites,
            },
        })

    @routes.post("/webui_prompt_bridge/prompt_all_in_one/translate")
    async def prompt_all_in_one_translate(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        try:
            data = await request.json()
        except Exception:
            data = {}
        text = _truncate_text(data.get("text", ""), MAX_PROMPT_TEXT_LENGTH)
        lang = _truncate_text(data.get("lang", "zh_CN"), MAX_STYLE_NAME_LENGTH)
        to = _truncate_text(data.get("to", "english"), MAX_STYLE_NAME_LENGTH)
        translated = _translate_prompt_all_in_one_text(text, to=to, lang=lang)
        prompt = ", ".join(item["prompt"] for item in translated if item["prompt"] != "\n")
        return web.json_response({
            "tags": translated,
            "prompt": prompt,
            "matched": sum(1 for item in translated if item.get("matched")),
        })

    @routes.get("/webui_prompt_bridge/prompt_all_in_one/storage")
    async def prompt_all_in_one_storage_get(request):
        kind = request.query.get("kind", "positive")
        collection = request.query.get("collection", "history")
        if collection not in ("history", "favorite"):
            return web.json_response({"error": "Unknown collection"}, status=400)
        return web.json_response({"items": _get_prompt_all_in_one_items(collection, kind)})

    @routes.post("/webui_prompt_bridge/prompt_all_in_one/storage")
    async def prompt_all_in_one_storage_post(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        try:
            data = await request.json()
        except Exception:
            data = {}
        action = data.get("action")
        kind = _validate_kind(data.get("kind", "positive"))
        lang = _truncate_text(data.get("lang", "zh_CN"), MAX_STYLE_NAME_LENGTH)
        prompt = _truncate_text(data.get("prompt", ""), MAX_PROMPT_TEXT_LENGTH)
        name = _truncate_text(data.get("name", ""), MAX_STYLE_NAME_LENGTH)
        item_id = _truncate_text(data.get("id", ""), MAX_STYLE_NAME_LENGTH)

        if action == "push_history":
            item = _push_prompt_all_in_one_item("history", kind, prompt, name, lang)
            return web.json_response({"success": True, "item": item})
        if action == "push_favorite":
            item = _push_prompt_all_in_one_item("favorite", kind, prompt, name, lang)
            return web.json_response({
                "success": True,
                "item": item,
                "favorites": {
                    "positive": _load_prompt_all_in_one_favorites("positive"),
                    "negative": _load_prompt_all_in_one_favorites("negative"),
                },
            })
        if action == "delete_favorite":
            removed = _delete_prompt_all_in_one_item("favorite", kind, item_id, prompt)
            return web.json_response({
                "success": removed,
                "favorites": {
                    "positive": _load_prompt_all_in_one_favorites("positive"),
                    "negative": _load_prompt_all_in_one_favorites("negative"),
                },
            })
        if action == "latest_history":
            return web.json_response({"success": True, "item": _latest_prompt_all_in_one_history(kind)})
        if action == "clear_history":
            _storage_set(_storage_key("history", kind), [])
            return web.json_response({"success": True})

        return web.json_response({"error": "Unknown storage action"}, status=400)

    @routes.get("/webui_prompt_bridge/styles")
    async def list_styles(request):
        return web.json_response({"styles": _load_webui_styles()})

    @routes.post("/webui_prompt_bridge/styles")
    async def update_styles(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        try:
            data = await request.json()
        except Exception:
            data = {}
        action = data.get("action")
        name = _truncate_text((data.get("name") or "").strip(), MAX_STYLE_NAME_LENGTH)
        if not name:
            return web.json_response({"error": "Style name is required"}, status=400)

        styles = _load_webui_styles()
        if action == "delete":
            styles = [style for style in styles if style.get("name") != name]
        elif action == "save":
            replacement = {
                "name": name,
                "prompt": _truncate_text(data.get("prompt", ""), MAX_PROMPT_TEXT_LENGTH),
                "negative_prompt": _truncate_text(data.get("negative_prompt", ""), MAX_PROMPT_TEXT_LENGTH),
            }
            for index, style in enumerate(styles):
                if style.get("name") == name:
                    styles[index] = replacement
                    break
            else:
                styles.append(replacement)
        else:
            return web.json_response({"error": "Unknown style action"}, status=400)

        _save_webui_styles(styles)
        return web.json_response({"styles": styles})

    @routes.post("/webui_prompt_bridge/parse_infotext")
    async def parse_infotext(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        try:
            data = await request.json()
        except Exception:
            data = {}
        parsed = _parse_generation_parameters(_truncate_text(data.get("text", ""), MAX_PROMPT_TEXT_LENGTH))
        return web.json_response({"parameters": parsed})


_register_routes()
