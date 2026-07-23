import asyncio
import base64
import csv
import datetime
import functools
import hashlib
import html
import io
import ipaddress
import json
import math
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import uuid
import urllib.request
import zipfile
from pathlib import Path
from urllib.parse import quote, unquote, urlparse

import comfy.sd
import comfy.samplers
import comfy.utils
import comfy.model_management
import numpy as np
import folder_paths
import torch
import yaml
from PIL import Image, ImageOps, ImageSequence


NODE_DIR = Path(__file__).resolve().parent
DATA_DIR = NODE_DIR / "data"
LOCAL_CONFIG_PATH = NODE_DIR / "config.local.json"
PROMPT_ALL_IN_ONE_HISTORY_MAX = 100
MAX_PROMPT_TEXT_LENGTH = 50000
MAX_SHORT_TEXT_LENGTH = 2000
MAX_STYLE_NAME_LENGTH = 120
MAX_WEBUI_ROOT_LENGTH = 500
MAX_IMAGE_UPLOAD_BYTES = 40 * 1024 * 1024
MAX_LORA_PREVIEW_BYTES = 20 * 1024 * 1024
MAX_IMAGE_FRAME_PIXELS = 40_000_000
MAX_IMAGE_TOTAL_PIXELS = 80_000_000
MAX_IMAGE_FRAMES = 32
MAX_AI_RESPONSE_BYTES = 4 * 1024 * 1024
DEFAULT_ZOOM_SUMMARY_THRESHOLD = 0.5
MIN_ZOOM_SUMMARY_THRESHOLD = 0.0
MAX_ZOOM_SUMMARY_THRESHOLD = 1.0
_DPAPI_SECRET_PREFIX = "dpapi:"
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
_REGIONAL_SEPARATOR_RE = re.compile(r"\b(ADDCOMM|ADDBASE|ADDCOL|ADDROW|BREAK)\b", re.IGNORECASE)
_REGIONAL_GRID_SEPARATORS = {"ADDCOL", "ADDROW"}
_IMAGE_SIGNATURES = {
    ".png": (b"\x89PNG\r\n\x1a\n",),
    ".jpg": (b"\xff\xd8\xff",),
    ".jpeg": (b"\xff\xd8\xff",),
    ".webp": (b"RIFF",),
}
_EMPTY_THUMBNAIL_PNG = (
    b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01"
    b"\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\rIDATx\x9cc\x00\x01"
    b"\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)
DEFAULT_BRIDGE_SETTINGS = {
    "data_source": "auto",
    "translation_source": "auto",
    "tag_translation_source": "auto",
    "show_startup_wizard": True,
    "layout_preset": "compact",
    "tag_display": "local_first",
    "lora_card_size": "normal",
    "node_tutorial_popup": "first_time",
    "zoom_summary_threshold": DEFAULT_ZOOM_SUMMARY_THRESHOLD,
    "ui_visibility": {},
}
UI_VISIBILITY_DEFAULTS = {
    "top_tutorial": False,
    "top_webui": True,
    "top_lora": True,
    "top_clip": False,
    "top_fail_on_missing": False,
    "model_switch": True,
    "regional_control": False,
    "generation_controls": True,
    "size_controls": True,
    "layout_presets": True,
    "prompt_tools": True,
    "styles": False,
    "lora_browser": True,
    "module_img2img": True,
    "module_mask": False,
    "module_table": False,
    "module_negative_common": False,
    "module_flip": False,
    "module_presets": False,
    "module_controlnet": False,
    "module_adetailer": False,
    "module_sam": False,
    "module_upscale": False,
    "module_regional_lora": False,
}
UI_VISIBILITY_LEGACY_KEYS = {
    "assistant_mask": "module_mask",
    "assistant_table": "module_table",
    "assistant_negative_common": "module_negative_common",
    "assistant_flip": "module_flip",
    "assistant_presets": "module_presets",
    "assistant_controlnet": "module_controlnet",
    "assistant_adetailer": "module_adetailer",
    "assistant_sam": "module_sam",
    "assistant_upscale": "module_upscale",
    "assistant_regional_lora": "module_regional_lora",
    "assistant_img2img": "module_img2img",
}
_SETTING_CHOICES = {
    "data_source": {"auto", "webui", "builtin"},
    "translation_source": {"auto", "webui", "online", "ai", "builtin"},
    "tag_translation_source": {"auto", "local", "online", "off"},
    "layout_preset": {"default", "compact", "roomy", "positive_focus", "minimal_lora"},
    "tag_display": {"local_first", "prompt_first", "compact"},
    "lora_card_size": {"compact", "normal", "large"},
    "node_tutorial_popup": {"first_time", "always", "off"},
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
BUNDLED_TAGCOMPLETE_DIR = DATA_DIR / EXTENSION_ASSETS["tagcomplete"]["directory"]
MODULE_NODE_ASSETS = {
    "impact_pack": {
        "label": "ComfyUI Impact Pack",
        "directory": "ComfyUI-Impact-Pack",
        "repo_url": "https://github.com/ltdrdata/ComfyUI-Impact-Pack.git",
        "zip_url": "https://github.com/ltdrdata/ComfyUI-Impact-Pack/archive/refs/heads/Main.zip",
        "note": "Detailer/FaceDetailer 工作流常用节点包",
    },
    "impact_subpack": {
        "label": "ComfyUI Impact Subpack",
        "directory": "ComfyUI-Impact-Subpack",
        "repo_url": "https://github.com/ltdrdata/ComfyUI-Impact-Subpack.git",
        "zip_url": "https://github.com/ltdrdata/ComfyUI-Impact-Subpack/archive/refs/heads/main.zip",
        "note": "Ultralytics detector / bbox / segm 支持",
    },
    "controlnet_aux": {
        "label": "ControlNet Auxiliary Preprocessors",
        "directory": "comfyui_controlnet_aux",
        "repo_url": "https://github.com/Fannovel16/comfyui_controlnet_aux.git",
        "zip_url": "https://github.com/Fannovel16/comfyui_controlnet_aux/archive/refs/heads/main.zip",
        "note": "Canny/Depth/OpenPose/Lineart 等预处理器",
    },
    "segment_anything": {
        "label": "ComfyUI Segment Anything",
        "directory": "comfyui_segment_anything",
        "repo_url": "https://github.com/storyicon/comfyui_segment_anything.git",
        "zip_url": "https://github.com/storyicon/comfyui_segment_anything/archive/refs/heads/main.zip",
        "note": "SAM 分割节点",
    },
    "ultimate_upscale": {
        "label": "Ultimate SD Upscale",
        "directory": "ComfyUI_UltimateSDUpscale",
        "repo_url": "https://github.com/ssitu/ComfyUI_UltimateSDUpscale.git",
        "zip_url": "https://github.com/ssitu/ComfyUI_UltimateSDUpscale/archive/refs/heads/master.zip",
        "note": "Ultimate SD Upscale 节点",
    },
}
PROMPT_MARKET_SOURCES = {
    "current_webui_library": {
        "label": "当前 WebUI / 本地词库",
        "description": "优先读已连接 WebUI / 本地数据包；没有时联网下载 WebUI 生态词库补导入。",
        "category": "推荐",
        "license": "Local / MIT",
        "open_url": "",
        "format": "current_bridge_library",
        "limit": 2000,
        "importable": True,
    },
    "prompt_all_in_one_zh_cn": {
        "label": "Prompt All in One 中文分类词库",
        "description": "免费开源分组 tag，适合直接扩充提示词面板。",
        "category": "分类词库",
        "license": "MIT",
        "open_url": "https://github.com/Physton/sd-webui-prompt-all-in-one/tree/main/group_tags",
        "download_url": "https://raw.githubusercontent.com/Physton/sd-webui-prompt-all-in-one/main/group_tags/zh_CN.yaml",
        "format": "prompt_all_in_one_yaml",
        "importable": True,
    },
    "tagcomplete_danbooru_top": {
        "label": "TagComplete Danbooru 热门 Tags",
        "description": "免费开源补全词库；导入前 1200 个高频 tag，并按类型自动分组。",
        "category": "分类词库",
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
        "category": "分类词库",
        "license": "MIT",
        "open_url": "https://github.com/DominikDoom/a1111-sd-webui-tagcomplete/blob/main/tags/extra-quality-tags.csv",
        "download_url": "https://raw.githubusercontent.com/DominikDoom/a1111-sd-webui-tagcomplete/main/tags/extra-quality-tags.csv",
        "format": "tagcomplete_csv",
        "group": "质量",
        "limit": 200,
        "importable": True,
    },
    "tagcomplete_visual_styles": {
        "label": "Danbooru 画风与绘画媒介精选",
        "description": "从公开 TagComplete 词库筛出画风、艺术流派、绘画媒介与渲染技法相关 tag。",
        "category": "画风精选",
        "license": "MIT",
        "open_url": "https://github.com/DominikDoom/a1111-sd-webui-tagcomplete/blob/main/tags/danbooru.csv",
        "download_url": "https://raw.githubusercontent.com/DominikDoom/a1111-sd-webui-tagcomplete/main/tags/danbooru.csv",
        "format": "tagcomplete_csv",
        "group": "画风",
        "limit": 600,
        "importable": True,
        "filter_profile": "画风 / 媒介 / 流派",
        "include_any": (
            "artstyle", "style parody", "painting", "watercolor", "gouache", "oil painting",
            "acrylic paint", "ink", "pastel", "charcoal", "pencil", "sketch", "lineart",
            "pixel art", "vector", "woodcut", "ukiyo-e", "impressionism", "surrealism",
            "cubism", "art nouveau", "art deco", "pop art", "concept art", "digital art",
            "cel shading", "flat color", "impasto", "pointillism", "photorealistic",
        ),
    },
    "krea_art_style_prompts": {
        "label": "Krea 艺术画风 Prompt 精选",
        "description": "从 1k 公开完整 Prompt 中筛选绘画媒介、艺术流派、插画与概念设计案例。",
        "category": "画风精选",
        "license": "Public GitHub sample",
        "open_url": "https://github.com/krea-ai/prompt-search/blob/master/1k.csv",
        "download_url": "https://raw.githubusercontent.com/krea-ai/prompt-search/master/1k.csv",
        "format": "prompt_csv",
        "group": "画风 Prompt 案例",
        "subgroup": "艺术流派与绘画媒介",
        "limit": 350,
        "importable": True,
        "filter_profile": "绘画 / 插画 / 艺术流派",
        "include_any": (
            "painting", "watercolor", "gouache", "oil paint", "acrylic", "ink drawing",
            "illustration", "concept art", "digital art", "pixel art", "anime", "manga",
            "comic", "surreal", "impressionist", "expressionist", "art nouveau", "art deco",
            "ukiyo", "pop art", "sketch", "line art", "pastel", "charcoal",
        ),
    },
    "krea_cinematic_photo_prompts": {
        "label": "Krea 摄影与电影感 Prompt 精选",
        "description": "从公开完整 Prompt 中筛选摄影、镜头、布光、电影感与写实视觉案例。",
        "category": "画风精选",
        "license": "Public GitHub sample",
        "open_url": "https://github.com/krea-ai/prompt-search/blob/master/1k.csv",
        "download_url": "https://raw.githubusercontent.com/krea-ai/prompt-search/master/1k.csv",
        "format": "prompt_csv",
        "group": "画风 Prompt 案例",
        "subgroup": "摄影与电影感",
        "limit": 350,
        "importable": True,
        "filter_profile": "摄影 / 镜头 / 灯光",
        "include_any": (
            "photograph", "photography", "photo of", "cinematic", "film still", "35mm",
            "50mm", "85mm", "wide angle", "macro lens", "depth of field", "bokeh",
            "studio lighting", "dramatic lighting", "volumetric lighting", "golden hour",
            "photorealistic", "hyperrealistic", "editorial", "fashion shoot",
        ),
    },
    "tagcomplete_danbooru_e621_merged": {
        "label": "TagComplete Danbooru + e621 合并 Tags",
        "description": "TagComplete 官方合并词库，覆盖二次元、拟人、兽耳/兽人等更多角色与物种特征 tag。",
        "category": "分类词库",
        "license": "MIT",
        "open_url": "https://github.com/DominikDoom/a1111-sd-webui-tagcomplete/blob/main/tags/danbooru_e621_merged.csv",
        "download_url": "https://raw.githubusercontent.com/DominikDoom/a1111-sd-webui-tagcomplete/main/tags/danbooru_e621_merged.csv",
        "format": "tagcomplete_csv",
        "group": "Danbooru + e621",
        "limit": 1800,
        "importable": True,
    },
    "tagcomplete_e621_sfw": {
        "label": "TagComplete e621 SFW 拟人 Tags",
        "description": "e621 SFW 词库，偏拟人、兽耳、兽人和物种特征，适合安全内容分类。",
        "category": "分类词库",
        "license": "MIT",
        "open_url": "https://github.com/DominikDoom/a1111-sd-webui-tagcomplete/blob/main/tags/e621_sfw.csv",
        "download_url": "https://raw.githubusercontent.com/DominikDoom/a1111-sd-webui-tagcomplete/main/tags/e621_sfw.csv",
        "format": "tagcomplete_csv",
        "group": "e621 SFW",
        "limit": 900,
        "importable": True,
    },
    "tagcomplete_e621_adult_raw": {
        "label": "NSFW 专项：e621 零过滤 Tags",
        "description": "18+ 成人向 tag 扩展包；不筛普通成人词，按原始热度尽量多导入。",
        "category": "成人专项",
        "license": "MIT / 18+",
        "open_url": "https://github.com/DominikDoom/a1111-sd-webui-tagcomplete/blob/main/tags/e621.csv",
        "download_url": "https://raw.githubusercontent.com/DominikDoom/a1111-sd-webui-tagcomplete/main/tags/e621.csv",
        "format": "tagcomplete_csv",
        "group": "NSFW 成人向 / e621 零过滤",
        "limit": 1200,
        "importable": True,
        "adult": True,
        "filter_profile": "零过滤",
        "exclude_any": (
            "child", "children", "kid", "minor", "underage", "teen", "young", "young-looking",
            "loli", "shota", "cub", "baby", "toddler", "rape", "forced", "noncon",
            "non-consensual", "bestiality", "zoophilia", "feral", "animal_abuse",
        ),
    },
    "tagcomplete_e621_adult_light": {
        "label": "NSFW 专项：e621 微过滤 Tags",
        "description": "18+ 成人向 tag 扩展包；保留常规 NSFW，额外过滤极端、重口和争议词。",
        "category": "成人专项",
        "license": "MIT / 18+",
        "open_url": "https://github.com/DominikDoom/a1111-sd-webui-tagcomplete/blob/main/tags/e621.csv",
        "download_url": "https://raw.githubusercontent.com/DominikDoom/a1111-sd-webui-tagcomplete/main/tags/e621.csv",
        "format": "tagcomplete_csv",
        "group": "NSFW 成人向 / e621 微过滤",
        "limit": 900,
        "importable": True,
        "adult": True,
        "filter_profile": "NSFW 微过滤",
        "exclude_any": (
            "child", "children", "kid", "minor", "underage", "teen", "young", "young-looking",
            "loli", "shota", "cub", "baby", "toddler", "rape", "forced", "noncon",
            "non-consensual", "bestiality", "zoophilia", "feral", "animal_abuse",
            "gore", "guro", "blood", "vore", "scat", "feces", "urine", "watersports",
            "incest", "snuff", "corpse", "death", "necrophilia", "amputation",
        ),
    },
    "tagcomplete_derpibooru": {
        "label": "TagComplete Derpibooru 角色 Tags",
        "description": "Derpibooru 标签源，适合角色、作品、风格和分类 tag 补充。",
        "category": "分类词库",
        "license": "MIT",
        "open_url": "https://github.com/DominikDoom/a1111-sd-webui-tagcomplete/blob/main/tags/derpibooru.csv",
        "download_url": "https://raw.githubusercontent.com/DominikDoom/a1111-sd-webui-tagcomplete/main/tags/derpibooru.csv",
        "format": "tagcomplete_csv",
        "group": "Derpibooru",
        "limit": 800,
        "importable": True,
    },
    "krea_prompt_examples": {
        "label": "Krea / Open Prompts 完整案例",
        "description": "Krea prompt-search 的 1k 公开 prompt 样例，导入为完整 prompt 案例。",
        "category": "完整 Prompt",
        "license": "Public GitHub sample",
        "open_url": "https://github.com/krea-ai/prompt-search/blob/master/1k.csv",
        "download_url": "https://raw.githubusercontent.com/krea-ai/prompt-search/master/1k.csv",
        "format": "prompt_csv",
        "group": "完整 Prompt 案例",
        "subgroup": "Krea / Open Prompts",
        "limit": 1000,
        "importable": True,
    },
    "public_prompts": {
        "label": "Public Prompts",
        "description": "免费提示词案例站，适合打开后挑选完整 prompt；暂不做批量抓取。",
        "category": "案例网站",
        "license": "Free website",
        "open_url": "https://www.publicprompts.art/",
        "importable": False,
    },
    "prompthero_stable_diffusion": {
        "label": "PromptHero Stable Diffusion",
        "description": "热门 Stable Diffusion prompt 案例页，适合按作品手动挑完整 prompt。",
        "category": "案例网站",
        "license": "Website",
        "open_url": "https://prompthero.com/stable-diffusion-prompts",
        "importable": False,
    },
    "civitai_images": {
        "label": "Civitai 图片 Prompt 案例",
        "description": "模型社区图片案例页，常带完整 prompt / negative / 参数，适合手动筛选。",
        "category": "案例网站",
        "license": "Website",
        "open_url": "https://civitai.com/images",
        "importable": False,
    },
    "lexica_prompt_search": {
        "label": "Lexica Prompt Search",
        "description": "Stable Diffusion 图片与 prompt 搜索站，适合查风格词和构图案例。",
        "category": "案例网站",
        "license": "Website",
        "open_url": "https://lexica.art/",
        "importable": False,
    },
    "openart_prompt_book": {
        "label": "OpenArt Prompt Book",
        "description": "Prompt 教程和案例库，适合手动学习结构化 prompt 写法。",
        "category": "案例网站",
        "license": "Website",
        "open_url": "https://openart.ai/promptbook",
        "importable": False,
    },
    "diffusiondb": {
        "label": "DiffusionDB",
        "description": "Hugging Face 上的 CC0 大型 prompt 数据集，适合研究和抽样，不建议整库导入。",
        "category": "完整 Prompt",
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
TAG_TRANSLATION_CACHE_FILE = BUNDLED_TAGCOMPLETE_DIR / "tags" / "Tags-zh-full-pack.csv"
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


_LOCAL_CONFIG_SECRET_MIGRATION_NEEDED = False
_LOCAL_CONFIG_OPAQUE_API_KEY = ""


def _windows_dpapi_transform(data, protect):
    import ctypes
    from ctypes import wintypes

    class DATA_BLOB(ctypes.Structure):
        _fields_ = [
            ("cbData", wintypes.DWORD),
            ("pbData", ctypes.POINTER(ctypes.c_ubyte)),
        ]

    source = ctypes.create_string_buffer(data)
    input_blob = DATA_BLOB(len(data), ctypes.cast(source, ctypes.POINTER(ctypes.c_ubyte)))
    output_blob = DATA_BLOB()
    crypt32 = ctypes.WinDLL("crypt32", use_last_error=True)
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    blob_pointer = ctypes.POINTER(DATA_BLOB)
    crypt32.CryptProtectData.argtypes = [
        blob_pointer,
        wintypes.LPCWSTR,
        blob_pointer,
        ctypes.c_void_p,
        ctypes.c_void_p,
        wintypes.DWORD,
        blob_pointer,
    ]
    crypt32.CryptProtectData.restype = wintypes.BOOL
    crypt32.CryptUnprotectData.argtypes = [
        blob_pointer,
        ctypes.POINTER(wintypes.LPWSTR),
        blob_pointer,
        ctypes.c_void_p,
        ctypes.c_void_p,
        wintypes.DWORD,
        blob_pointer,
    ]
    crypt32.CryptUnprotectData.restype = wintypes.BOOL
    kernel32.LocalFree.argtypes = [ctypes.c_void_p]
    kernel32.LocalFree.restype = ctypes.c_void_p
    if protect:
        ok = crypt32.CryptProtectData(
            ctypes.byref(input_blob),
            "WebUIPromptBridge AI API key",
            None,
            None,
            None,
            0,
            ctypes.byref(output_blob),
        )
    else:
        ok = crypt32.CryptUnprotectData(
            ctypes.byref(input_blob),
            None,
            None,
            None,
            None,
            0,
            ctypes.byref(output_blob),
        )
    if not ok:
        raise ctypes.WinError(ctypes.get_last_error())
    try:
        return ctypes.string_at(output_blob.pbData, output_blob.cbData)
    finally:
        kernel32.LocalFree(output_blob.pbData)


def _protect_local_secret(value):
    secret = str(value or "")
    if not secret or os.name != "nt":
        return secret
    protected = _windows_dpapi_transform(secret.encode("utf-8"), True)
    return _DPAPI_SECRET_PREFIX + base64.urlsafe_b64encode(protected).decode("ascii")


def _unprotect_local_secret(value):
    secret = str(value or "")
    if not secret.startswith(_DPAPI_SECRET_PREFIX):
        return secret
    if os.name != "nt":
        raise ValueError("This API key is protected by Windows DPAPI")
    payload = base64.urlsafe_b64decode(secret[len(_DPAPI_SECRET_PREFIX):].encode("ascii"))
    return _windows_dpapi_transform(payload, False).decode("utf-8")


def _windows_current_user_sid():
    try:
        result = subprocess.run(
            ["whoami", "/user", "/fo", "csv", "/nh"],
            capture_output=True,
            text=True,
            errors="replace",
            timeout=5,
            check=False,
        )
        row = next(csv.reader([result.stdout.strip()])) if result.returncode == 0 and result.stdout.strip() else []
        return row[1].strip() if len(row) > 1 else ""
    except Exception:
        return ""


def _harden_private_file_permissions(path):
    path = Path(path)
    if not path.exists():
        return False
    if os.name != "nt":
        try:
            path.chmod(0o600)
            return True
        except OSError:
            return False
    icacls = shutil.which("icacls")
    current_sid = _windows_current_user_sid()
    if not icacls or not current_sid:
        return False
    try:
        result = subprocess.run(
            [
                icacls,
                str(path),
                "/inheritance:r",
                "/grant:r",
                f"*{current_sid}:(F)",
                "*S-1-5-18:(F)",
                "*S-1-5-32-544:(F)",
            ],
            capture_output=True,
            text=True,
            errors="replace",
            timeout=10,
            check=False,
        )
        return result.returncode == 0
    except Exception:
        return False


def _load_local_config():
    global _LOCAL_CONFIG_SECRET_MIGRATION_NEEDED, _LOCAL_CONFIG_OPAQUE_API_KEY
    _LOCAL_CONFIG_SECRET_MIGRATION_NEEDED = False
    _LOCAL_CONFIG_OPAQUE_API_KEY = ""
    try:
        if LOCAL_CONFIG_PATH.exists():
            data = json.loads(LOCAL_CONFIG_PATH.read_text(encoding="utf-8"))
            if not isinstance(data, dict):
                return {}
            ai_config = data.get("ai_api")
            if isinstance(ai_config, dict) and ai_config.get("api_key"):
                stored = str(ai_config.get("api_key") or "")
                try:
                    ai_config = dict(ai_config)
                    ai_config["api_key"] = _unprotect_local_secret(stored)
                    data["ai_api"] = ai_config
                    _LOCAL_CONFIG_SECRET_MIGRATION_NEEDED = os.name == "nt" and not stored.startswith(_DPAPI_SECRET_PREFIX)
                except Exception as exc:
                    print(f"[WebUI Prompt Bridge] Could not decrypt the saved AI API key: {exc}")
                    _LOCAL_CONFIG_OPAQUE_API_KEY = stored
                    ai_config = dict(ai_config)
                    ai_config["api_key"] = ""
                    data["ai_api"] = ai_config
            return data
    except Exception:
        pass
    return {}


def _normalize_zoom_summary_threshold(value, fallback=DEFAULT_ZOOM_SUMMARY_THRESHOLD):
    try:
        fallback_number = float(fallback)
    except (TypeError, ValueError):
        fallback_number = DEFAULT_ZOOM_SUMMARY_THRESHOLD
    if not math.isfinite(fallback_number):
        fallback_number = DEFAULT_ZOOM_SUMMARY_THRESHOLD
    fallback_number = min(MAX_ZOOM_SUMMARY_THRESHOLD, max(MIN_ZOOM_SUMMARY_THRESHOLD, fallback_number))
    try:
        number = float(value)
    except (TypeError, ValueError):
        return round(fallback_number, 2)
    if not math.isfinite(number):
        return round(fallback_number, 2)
    return round(min(MAX_ZOOM_SUMMARY_THRESHOLD, max(MIN_ZOOM_SUMMARY_THRESHOLD, number)), 2)


def _bridge_settings():
    raw = LOCAL_CONFIG.get("settings") if isinstance(LOCAL_CONFIG, dict) else {}
    settings = dict(DEFAULT_BRIDGE_SETTINGS)
    settings["ui_visibility"] = dict(UI_VISIBILITY_DEFAULTS)
    if isinstance(raw, dict):
        for key, value in raw.items():
            if key not in settings:
                continue
            if key == "show_startup_wizard":
                settings[key] = bool(value)
            elif key == "zoom_summary_threshold":
                settings[key] = _normalize_zoom_summary_threshold(value, settings[key])
            elif key == "ui_visibility" and isinstance(value, dict):
                visibility = dict(UI_VISIBILITY_DEFAULTS)
                for visibility_key, default in UI_VISIBILITY_DEFAULTS.items():
                    visibility[visibility_key] = bool(value.get(visibility_key, default))
                for legacy_key, visibility_key in UI_VISIBILITY_LEGACY_KEYS.items():
                    if legacy_key in value:
                        visibility[visibility_key] = bool(value.get(legacy_key))
                settings[key] = visibility
            elif key in _SETTING_CHOICES:
                value = str(value or "").strip()
                if value in _SETTING_CHOICES[key]:
                    settings[key] = value
    return settings


def _write_local_config(config, preserve_opaque_secret=True):
    global _LOCAL_CONFIG_OPAQUE_API_KEY
    persisted = dict(config) if isinstance(config, dict) else {}
    ai_config = persisted.get("ai_api")
    if not isinstance(ai_config, dict) and preserve_opaque_secret and _LOCAL_CONFIG_OPAQUE_API_KEY:
        ai_config = {}
    opaque_secret_persisted = False
    if isinstance(ai_config, dict):
        ai_config = dict(ai_config)
        if ai_config.get("api_key"):
            ai_config["api_key"] = _protect_local_secret(ai_config["api_key"])
        elif preserve_opaque_secret and _LOCAL_CONFIG_OPAQUE_API_KEY:
            ai_config["api_key"] = _LOCAL_CONFIG_OPAQUE_API_KEY
            opaque_secret_persisted = True
        persisted["ai_api"] = ai_config
    LOCAL_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    temporary_path = LOCAL_CONFIG_PATH.with_name(f".{LOCAL_CONFIG_PATH.name}.{uuid.uuid4().hex}.tmp")
    try:
        temporary_path.write_text(json.dumps(persisted, indent=2, ensure_ascii=False), encoding="utf-8")
        _harden_private_file_permissions(temporary_path)
        os.replace(temporary_path, LOCAL_CONFIG_PATH)
        _harden_private_file_permissions(LOCAL_CONFIG_PATH)
        if not opaque_secret_persisted:
            _LOCAL_CONFIG_OPAQUE_API_KEY = ""
    finally:
        if temporary_path.exists():
            try:
                temporary_path.unlink(missing_ok=True)
            except OSError:
                pass


def _secure_local_config_on_startup():
    global _LOCAL_CONFIG_SECRET_MIGRATION_NEEDED
    if LOCAL_CONFIG_PATH.exists():
        try:
            if not _harden_private_file_permissions(LOCAL_CONFIG_PATH):
                print("[WebUI Prompt Bridge] Warning: could not restrict config.local.json permissions")
        except Exception as exc:
            print(f"[WebUI Prompt Bridge] Warning: could not restrict config.local.json permissions: {exc}")
    if _LOCAL_CONFIG_SECRET_MIGRATION_NEEDED:
        try:
            _write_local_config(LOCAL_CONFIG)
            _LOCAL_CONFIG_SECRET_MIGRATION_NEEDED = False
        except Exception as exc:
            print(f"[WebUI Prompt Bridge] Warning: could not migrate the saved AI API key to DPAPI: {exc}")


LOCAL_CONFIG = _load_local_config()
_secure_local_config_on_startup()


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


def _tag_autocomplete_data_dir():
    if _should_read_webui_data() and _extension_asset_data_ready(TAGCOMPLETE_DIR, "tagcomplete"):
        return TAGCOMPLETE_DIR
    if _data_source_mode() != "webui" and _extension_asset_data_ready(BUNDLED_TAGCOMPLETE_DIR, "tagcomplete"):
        return BUNDLED_TAGCOMPLETE_DIR
    return TAGCOMPLETE_DIR


def _path_text(path):
    return str(path).replace("\\", "/") if path else ""


def _remote_filesystem_paths_allowed():
    return str(os.environ.get("WEBUI_PROMPT_BRIDGE_ALLOW_REMOTE_PATHS") or "").strip().casefold() in {"1", "true", "yes", "on"}


def _windows_drive_type(anchor):
    try:
        import ctypes

        return int(ctypes.windll.kernel32.GetDriveTypeW(str(anchor)))
    except Exception:
        return None


def _local_path_candidate_without_reparse(path):
    if not path:
        return None
    raw = str(path).strip()
    if not raw:
        return None
    if os.name == "nt" and not _remote_filesystem_paths_allowed():
        windows_path = raw.replace("/", "\\")
        if windows_path.startswith(("\\\\", "\\\\?\\", "\\\\.\\")):
            return None
        candidate = Path(raw).expanduser()
        anchor = candidate.anchor
        if anchor and re.match(r"^[A-Za-z]:[\\/]$", anchor):
            drive_type = _windows_drive_type(anchor)
            if drive_type is None or drive_type == 4:  # DRIVE_REMOTE
                return None
        return candidate
    return Path(raw).expanduser()


def _normalize_windows_reparse_target(value):
    raw = str(value or "")
    lowered = raw.casefold()
    for prefix in ("\\\\?\\unc\\", "\\??\\unc\\"):
        if lowered.startswith(prefix):
            return "\\\\" + raw[len(prefix):]
    for prefix in ("\\\\?\\", "\\??\\"):
        if lowered.startswith(prefix) and re.match(r"^[A-Za-z]:[\\/]", raw[len(prefix):]):
            return raw[len(prefix):]
    return raw


def _reparse_targets_are_local(path, max_hops=32):
    if os.name != "nt" or _remote_filesystem_paths_allowed():
        return True
    absolute = Path(os.path.abspath(str(path)))
    current = Path(absolute.anchor)
    pending = list(absolute.parts[1:])
    seen = set()
    hops = 0
    while pending:
        current = current / pending.pop(0)
        try:
            target_text = os.readlink(current)
        except OSError:
            continue
        hops += 1
        if hops > max_hops:
            return False
        target_text = _normalize_windows_reparse_target(target_text)
        target = Path(target_text).expanduser()
        if not target.is_absolute():
            target = current.parent / target
        target = Path(os.path.abspath(str(target)))
        if _local_path_candidate_without_reparse(target) is None:
            return False
        key = str(target).casefold()
        if key in seen:
            return False
        seen.add(key)
        combined = target.joinpath(*pending)
        current = Path(combined.anchor)
        pending = list(combined.parts[1:])
    return True


def _safe_local_path_candidate(path):
    candidate = _local_path_candidate_without_reparse(path)
    if candidate is None or not _reparse_targets_are_local(candidate):
        return None
    return candidate


def _existing_path(path):
    path = _safe_local_path_candidate(path)
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


def _webui_root_from_candidate(value):
    path = _existing_path(value)
    if not path:
        return None
    candidates = [path]
    candidates.extend(list(path.parents)[:4])
    for candidate in candidates:
        if _looks_like_webui_root(candidate):
            return candidate
    return None


def _build_webui_config(webui_root):
    root_text = _truncate_text(webui_root, MAX_WEBUI_ROOT_LENGTH)
    root = _webui_root_from_candidate(root_text)
    if not root:
        raise ValueError("WebUI 目录不存在或结构不完整；可选择 WebUI 根目录，也可直接选择 models/Lora 目录")
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
    path = _existing_path(shortcut_path)
    if not path or path.suffix.casefold() != ".lnk":
        return None
    script = (
        "$ErrorActionPreference='Stop';"
        "$s=(New-Object -ComObject WScript.Shell).CreateShortcut($env:WEBUI_PROMPT_BRIDGE_SHORTCUT_PATH);"
        "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8;"
        "Write-Output $s.TargetPath"
    )
    shortcut_env = os.environ.copy()
    shortcut_env["WEBUI_PROMPT_BRIDGE_SHORTCUT_PATH"] = str(path)
    try:
        result = subprocess.run(
            ["powershell", "-NoProfile", "-Command", script],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=shortcut_env,
            timeout=3,
            check=False,
        )
    except Exception:
        return None
    target = (result.stdout or "").strip().splitlines()
    if result.returncode != 0 or not target:
        return None
    return _existing_path(target[-1])


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
    global _TAG_AUTOCOMPLETE_CACHE, _TAG_TRANSLATION_MAP_CACHE, _LORA_METADATA_CACHE, _LORA_RAW_METADATA_CACHE, _LORA_HASH_CACHE, _LORA_LINK_ALIAS_CACHE, _TRANSLATION_MAP_CACHE, _NETWORK_TRANSLATE_CACHE
    LOCAL_CONFIG = config if isinstance(config, dict) else {}
    WEBUI_ROOT = _discover_webui_root()
    PROMPT_ALL_IN_ONE_DIR = _resolve_extension_asset_dir(
        "prompt_all_in_one_dir",
        "WEBUI_PROMPT_BRIDGE_PROMPT_ALL_IN_ONE_DIR",
        "prompt_all_in_one",
    )
    TAGCOMPLETE_DIR = _resolve_extension_asset_dir(
        "tagcomplete_dir",
        "WEBUI_PROMPT_BRIDGE_TAGCOMPLETE_DIR",
        "tagcomplete",
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
    _TAG_TRANSLATION_MAP_CACHE = None
    _LORA_METADATA_CACHE.clear()
    _LORA_RAW_METADATA_CACHE.clear()
    _LORA_HASH_CACHE.clear()
    _LORA_LINK_ALIAS_CACHE.clear()
    _TRANSLATION_MAP_CACHE.clear()
    _NETWORK_TRANSLATE_CACHE.clear()
    _apply_configured_model_paths()


def _webui_integration_status(webui_root=None):
    root = _webui_root_from_candidate(webui_root) or WEBUI_ROOT
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


_WEBUI_ROOT_GUESS_CACHE = {"time": 0.0, "roots": []}
_WEBUI_ROOT_GUESS_TTL = 15.0
_WEBUI_ROOT_DIR_NAMES = (
    "sd-webui-aki-v4.11.1-cu128",
    "sd-webui-aki-v4.11.1",
    "sd-webui-aki-v4.10",
    "sd-webui-aki-v4.9",
    "stable-diffusion-webui",
    "sd-webui",
)
_WEBUI_SEARCH_RELATIVE_BASES = ("", "AI", "AI/Tools", "Tools")


def _local_drive_letters():
    if os.name != "nt":
        return []
    try:
        import ctypes
        kernel32 = ctypes.windll.kernel32
        bitmask = int(kernel32.GetLogicalDrives())
        letters = []
        for index in range(26):
            if not (bitmask & (1 << index)):
                continue
            letter = chr(ord("A") + index)
            drive_type = int(kernel32.GetDriveTypeW(f"{letter}:\\"))
            if drive_type in {2, 3, 6}:  # removable, fixed, RAM disk; skip network/CD drives.
                letters.append(letter)
        return letters
    except Exception:
        return [letter for letter in "CDEFGHIJKLMNOPQRSTUVWXYZ" if Path(f"{letter}:/").exists()]


def _dedupe_root_texts(values):
    seen = set()
    result = []
    for value in values:
        text = _path_text(value).strip() if isinstance(value, Path) else str(value or "").replace("\\", "/").strip()
        if not text:
            continue
        key = text.rstrip("/").casefold()
        if key in seen:
            continue
        seen.add(key)
        result.append(text)
    return result


def _webui_candidates_under(drive_root):
    candidates = []
    for relative in _WEBUI_SEARCH_RELATIVE_BASES:
        base = drive_root / Path(relative) if relative else drive_root
        for name in _WEBUI_ROOT_DIR_NAMES:
            candidates.append(base / name)
        try:
            candidates.extend(base.glob("sd-webui-aki*"))
        except Exception:
            pass
    return candidates


def _guess_webui_roots(preferred=None, use_cache=True):
    now = time.monotonic()
    preferred_values = _dedupe_root_texts([preferred])
    if use_cache and not preferred_values and now - float(_WEBUI_ROOT_GUESS_CACHE.get("time") or 0) < _WEBUI_ROOT_GUESS_TTL:
        return list(_WEBUI_ROOT_GUESS_CACHE.get("roots") or [])
    if use_cache and preferred_values and now - float(_WEBUI_ROOT_GUESS_CACHE.get("time") or 0) < _WEBUI_ROOT_GUESS_TTL:
        preferred_found = []
        for value in preferred_values:
            path = _webui_root_from_candidate(value)
            if path:
                preferred_found.append(_path_text(path))
        return _dedupe_root_texts([*preferred_found, *(_WEBUI_ROOT_GUESS_CACHE.get("roots") or [])])[:12]
    candidates = []
    candidates.extend(preferred_values)
    for value in (
        LOCAL_CONFIG.get("webui_root"),
        os.environ.get("WEBUI_PROMPT_BRIDGE_WEBUI_ROOT"),
        "C:/sd-webui-aki-v4.11.1-cu128",
        "D:/sd-webui-aki-v4.11.1-cu128",
        "H:/sd-webui-aki-v4.11.1-cu128",
        "C:/sd-webui-aki-v4.9",
        "D:/sd-webui-aki-v4.9",
        "H:/sd-webui-aki-v4.9",
        "D:/stable-diffusion-webui",
        "H:/stable-diffusion-webui",
    ):
        if value:
            candidates.append(value)
    for drive in _local_drive_letters():
        drive_root = Path(f"{drive}:/")
        candidates.extend(_webui_candidates_under(drive_root))
    seen = set()
    found = []
    for candidate in _dedupe_root_texts(candidates):
        path = _webui_root_from_candidate(candidate)
        key = _path_text(path).lower() if path else ""
        if not path or key in seen:
            continue
        seen.add(key)
        found.append(_path_text(path))
    found = found[:12]
    if use_cache and not preferred_values:
        _WEBUI_ROOT_GUESS_CACHE["time"] = now
        _WEBUI_ROOT_GUESS_CACHE["roots"] = list(found)
    return found


def _configured_path(config_key, env_key):
    value = os.environ.get(env_key) or LOCAL_CONFIG.get(config_key)
    if not value:
        return None
    return _existing_path(value)


def _extension_asset_data_ready(path, asset_key):
    if not path:
        return False
    markers = {
        "prompt_all_in_one": (
            ("group_tags", "zh_CN.yaml"),
            ("group_tags", "default.yaml"),
        ),
        "tagcomplete": (
            ("tags", "danbooru.csv"),
        ),
    }
    try:
        return any(path.joinpath(*parts).is_file() for parts in markers.get(asset_key, ()))
    except Exception:
        return False


def _resolve_extension_asset_dir(config_key, env_key, asset_key):
    spec = EXTENSION_ASSETS[asset_key]
    configured = _configured_path(config_key, env_key)
    webui_path = WEBUI_ROOT / "extensions" / spec["directory"] if WEBUI_ROOT else None
    local_path = DATA_DIR / spec["directory"]
    candidates = [configured, webui_path, local_path]
    for candidate in candidates:
        if _extension_asset_data_ready(candidate, asset_key):
            return candidate
    for candidate in candidates:
        try:
            if candidate and candidate.is_dir():
                return candidate
        except Exception:
            pass
    return local_path


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
PROMPT_ALL_IN_ONE_DIR = _resolve_extension_asset_dir(
    "prompt_all_in_one_dir",
    "WEBUI_PROMPT_BRIDGE_PROMPT_ALL_IN_ONE_DIR",
    "prompt_all_in_one",
)
TAGCOMPLETE_DIR = _resolve_extension_asset_dir(
    "tagcomplete_dir",
    "WEBUI_PROMPT_BRIDGE_TAGCOMPLETE_DIR",
    "tagcomplete",
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


def _normalize_request_host(value):
    raw = str(value or "").split(",", 1)[0].strip()
    if not raw:
        return "", None
    parsed = urlparse(raw if "://" in raw else f"//{raw}", scheme="http")
    host = (parsed.hostname or "").strip().lower().rstrip(".")
    try:
        port = parsed.port
    except ValueError:
        port = None
    return host, port


def _hosts_same_origin(request_host, request_port, source_host, source_port):
    if not request_host or not source_host:
        return False
    if request_host == source_host and request_port == source_port:
        return True
    loopback_hosts = {"localhost", "127.0.0.1", "::1"}
    return request_host in loopback_hosts and source_host in loopback_hosts and request_port == source_port


@functools.lru_cache(maxsize=1)
def _trusted_request_hosts():
    hosts = {"localhost", "localhost.localdomain"}
    for value in (socket.gethostname(), socket.getfqdn()):
        normalized = str(value or "").strip().casefold().rstrip(".")
        if normalized:
            hosts.add(normalized)
            hosts.add(normalized.split(".", 1)[0])
    configured = os.environ.get("WEBUI_PROMPT_BRIDGE_ALLOWED_HOSTS") or ""
    for value in re.split(r"[,;\s]+", configured):
        normalized = value.strip().casefold().rstrip(".")
        if normalized:
            hosts.add(normalized)
    return hosts


def _request_host_is_trusted(host):
    host = str(host or "").strip().casefold().rstrip(".")
    if not host:
        return False
    try:
        ipaddress.ip_address(host)
        return True
    except ValueError:
        return host in _trusted_request_hosts()


def _validate_same_origin_request(request):
    host, port = _normalize_request_host(request.headers.get("Host", ""))
    if not _request_host_is_trusted(host):
        return False
    for header in ("Origin", "Referer"):
        value = request.headers.get(header, "")
        if not value:
            continue
        source_host, source_port = _normalize_request_host(value)
        if not _hosts_same_origin(host, port, source_host, source_port):
            return False
    return True


def _validate_opened_image(image):
    width, height = image.size
    frames = max(1, int(getattr(image, "n_frames", 1) or 1))
    frame_pixels = int(width) * int(height)
    if width <= 0 or height <= 0:
        raise ValueError("Image dimensions are invalid")
    if frames > MAX_IMAGE_FRAMES:
        raise ValueError(f"Image has too many frames (maximum {MAX_IMAGE_FRAMES})")
    if frame_pixels > MAX_IMAGE_FRAME_PIXELS:
        raise ValueError("Image dimensions are too large")
    if frame_pixels * frames > MAX_IMAGE_TOTAL_PIXELS:
        raise ValueError("Animated image is too large to decode safely")


def _validate_preview_image(image_bytes, extension):
    signatures = _IMAGE_SIGNATURES.get(extension)
    if not signatures:
        raise ValueError("Unsupported preview image type")
    if not any(image_bytes.startswith(signature) for signature in signatures):
        raise ValueError("Preview image content does not match its file type")
    if extension == ".webp" and image_bytes[8:12] != b"WEBP":
        raise ValueError("Preview image content does not match its file type")
    expected_formats = {
        ".png": {"PNG"},
        ".jpg": {"JPEG"},
        ".jpeg": {"JPEG"},
        ".webp": {"WEBP"},
    }
    try:
        with Image.open(io.BytesIO(image_bytes)) as image:
            _validate_opened_image(image)
            if str(image.format or "").upper() not in expected_formats[extension]:
                raise ValueError("Preview image content does not match its file type")
            image.verify()
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("Image file is invalid or corrupted") from exc


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
    autocomplete_dir = _tag_autocomplete_data_dir()
    if _extension_asset_data_ready(autocomplete_dir, "tagcomplete"):
        tag_file = autocomplete_dir / "tags" / "danbooru.csv"
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
    try:
        base_url = _normalize_ai_base_url(config.get("base_url"))
    except ValueError:
        return ""
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
        with _open_same_origin_url(request, timeout=45) as response:
            data = _read_json_response(response)
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


class _PromptMetadataNotFoundError(ValueError):
    pass


def _decode_image_metadata_text(value):
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, bytes):
        raw = value
        if raw.startswith(b"ASCII\x00\x00\x00"):
            raw = raw[8:]
        elif raw.startswith(b"UNICODE\x00"):
            raw = raw[8:]
            for encoding in ("utf-16", "utf-16-le", "utf-16-be"):
                try:
                    return raw.decode(encoding).rstrip("\x00")
                except UnicodeDecodeError:
                    continue
        elif raw.startswith(b"JIS\x00\x00\x00\x00\x00"):
            raw = raw[8:]
        return raw.decode("utf-8", errors="replace").rstrip("\x00")
    return str(value)


def _decode_image_metadata_json(value, label, warnings):
    if isinstance(value, dict):
        return value
    text = _decode_image_metadata_text(value).strip()
    if not text:
        return {}
    try:
        loaded = json.loads(text)
    except (TypeError, ValueError, json.JSONDecodeError):
        warnings.append(f"{label} metadata is not valid JSON")
        return {}
    if not isinstance(loaded, dict):
        warnings.append(f"{label} metadata is not a JSON object")
        return {}
    return loaded


def _workflow_prompt_node_labels(workflow):
    labels = {}
    for node in workflow.get("nodes") or []:
        if not isinstance(node, dict) or node.get("id") is None:
            continue
        properties = node.get("properties") if isinstance(node.get("properties"), dict) else {}
        label = (
            node.get("title")
            or properties.get("Node name for S&R")
            or node.get("type")
            or f"Node {node.get('id')}"
        )
        labels[str(node.get("id"))] = _truncate_text(str(label), MAX_STYLE_NAME_LENGTH)
    return labels


def _bridge_prompt_value(inputs, name):
    if name not in inputs:
        return None
    value = inputs.get(name)
    if not isinstance(value, str):
        return None
    return _truncate_text(value, MAX_PROMPT_TEXT_LENGTH)


def _extract_bridge_prompt_candidates(prompt, workflow=None, warnings=None):
    warnings = warnings if warnings is not None else []
    labels = _workflow_prompt_node_labels(workflow or {})
    main_candidates = []
    positive_nodes = []
    negative_nodes = []

    for node_id, node in (prompt or {}).items():
        if not isinstance(node, dict):
            continue
        class_type = str(node.get("class_type") or "")
        if class_type not in {
            "WebUIPromptBridge",
            "WebUIPromptBridgePositivePrompt",
            "WebUIPromptBridgeNegativePrompt",
        }:
            continue
        inputs = node.get("inputs") if isinstance(node.get("inputs"), dict) else {}
        meta = node.get("_meta") if isinstance(node.get("_meta"), dict) else {}
        node_key = str(node_id)
        label = _truncate_text(
            str(meta.get("title") or labels.get(node_key) or class_type),
            MAX_STYLE_NAME_LENGTH,
        )
        candidate = {
            "node_id": node_key,
            "label": label,
            "positive_prompt": None,
            "negative_prompt": None,
        }
        if class_type == "WebUIPromptBridge":
            candidate["positive_prompt"] = _bridge_prompt_value(inputs, "positive_prompt")
            candidate["negative_prompt"] = _bridge_prompt_value(inputs, "negative_prompt")
            if candidate["positive_prompt"] is not None or candidate["negative_prompt"] is not None:
                main_candidates.append(candidate)
        elif class_type == "WebUIPromptBridgePositivePrompt":
            candidate["positive_prompt"] = _bridge_prompt_value(inputs, "positive_prompt")
            if candidate["positive_prompt"] is not None:
                positive_nodes.append(candidate)
        else:
            candidate["negative_prompt"] = _bridge_prompt_value(inputs, "negative_prompt")
            if candidate["negative_prompt"] is not None:
                negative_nodes.append(candidate)

    small_candidates = []
    if len(positive_nodes) == 1 and len(negative_nodes) == 1:
        positive = positive_nodes[0]
        negative = negative_nodes[0]
        small_candidates.append({
            "node_id": f"{positive['node_id']}+{negative['node_id']}",
            "label": f"{positive['label']} + {negative['label']}",
            "positive_prompt": positive["positive_prompt"],
            "negative_prompt": negative["negative_prompt"],
        })
    else:
        small_candidates.extend(positive_nodes)
        small_candidates.extend(negative_nodes)

    candidates = []
    seen = set()
    duplicate_count = 0
    for candidate in [*main_candidates, *small_candidates]:
        key = (candidate["positive_prompt"], candidate["negative_prompt"])
        if key in seen:
            duplicate_count += 1
            continue
        seen.add(key)
        candidates.append(candidate)
    if duplicate_count:
        warnings.append(f"Merged {duplicate_count} duplicate Bridge prompt candidate(s)")
    return candidates


def _metadata_image_extension(filename, image_bytes):
    suffix = Path(str(filename or "")).suffix.lower()
    if suffix in _IMAGE_SIGNATURES:
        return suffix
    if image_bytes.startswith(_IMAGE_SIGNATURES[".png"][0]):
        return ".png"
    if image_bytes.startswith(_IMAGE_SIGNATURES[".jpg"][0]):
        return ".jpg"
    if image_bytes.startswith(_IMAGE_SIGNATURES[".webp"][0]) and image_bytes[8:12] == b"WEBP":
        return ".webp"
    raise ValueError("Unsupported image type")


def _parse_image_generation_metadata(image_bytes, filename=""):
    if len(image_bytes or b"") > MAX_IMAGE_UPLOAD_BYTES:
        raise ValueError("Image file is too large")
    extension = _metadata_image_extension(filename, image_bytes)
    _validate_preview_image(image_bytes, extension)

    warnings = []
    with Image.open(io.BytesIO(image_bytes)) as image:
        info = dict(image.info or {})
        try:
            exif = image.getexif()
        except Exception:
            exif = {}

    prompt = _decode_image_metadata_json(info.get("prompt"), "Comfy prompt", warnings)
    workflow = _decode_image_metadata_json(info.get("workflow"), "Comfy workflow", warnings)
    candidates = _extract_bridge_prompt_candidates(prompt, workflow, warnings)
    if candidates:
        return {
            "source": "comfy_prompt",
            "candidates": candidates,
            "warnings": warnings,
        }

    parameter_value = info.get("parameters")
    if not parameter_value:
        for key in ("comment", "Comment", "Description", "description"):
            if info.get(key):
                parameter_value = info.get(key)
                break
    if not parameter_value and exif:
        parameter_value = exif.get(0x9286) or exif.get(0x010E)
    parameter_text = _decode_image_metadata_text(parameter_value).strip()
    if parameter_text:
        parsed = _parse_generation_parameters(parameter_text)
        positive = parsed.get("Prompt")
        negative = parsed.get("Negative prompt") if "Negative prompt:" in parameter_text else None
        if positive is not None or negative is not None:
            return {
                "source": "a1111_parameters",
                "candidates": [{
                    "node_id": None,
                    "label": "A1111 / WebUI parameters",
                    "positive_prompt": _truncate_text(positive or "", MAX_PROMPT_TEXT_LENGTH),
                    "negative_prompt": None if negative is None else _truncate_text(negative, MAX_PROMPT_TEXT_LENGTH),
                }],
                "warnings": warnings,
            }

    if prompt:
        warnings.append("Comfy metadata does not contain a WebUI Prompt Bridge node")
    raise _PromptMetadataNotFoundError("No supported Bridge prompt metadata was found in this image")


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


def _lora_basic_detail(lora_name):
    resolved = _resolve_lora_name(lora_name)
    if resolved is None:
        return {"requested": lora_name, "found": False}
    lora_path = folder_paths.get_full_path("loras", resolved)
    preview_path = _find_lora_preview_path(lora_path)
    description = _find_lora_description(lora_path)
    user_metadata = _read_lora_user_metadata(lora_path, description)
    sd_version = user_metadata.get("sd version") or "Unknown"
    return {
        "requested": lora_name,
        "name": resolved,
        "found": True,
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
        "metadata_table": [],
        "training_tags": [],
        "summary": {},
    }


def _same_local_path(left, right):
    try:
        return bool(left and right and left.resolve(strict=False) == right.resolve(strict=False))
    except Exception:
        return False


def _prompt_asset_source(path, asset_key):
    spec = EXTENSION_ASSETS[asset_key]
    local_path = DATA_DIR / spec["directory"]
    if asset_key == "tagcomplete" and _same_local_path(path, BUNDLED_TAGCOMPLETE_DIR):
        return "bundled"
    if _same_local_path(path, local_path):
        return "local"
    if WEBUI_ROOT and _same_local_path(path, WEBUI_ROOT / "extensions" / spec["directory"]):
        return "webui"
    return "custom"


def _prompt_library_status():
    use_external_data = _should_read_webui_data()
    use_bundled_autocomplete = _data_source_mode() != "webui"
    prompt_ready = use_external_data and _extension_asset_data_ready(PROMPT_ALL_IN_ONE_DIR, "prompt_all_in_one")
    autocomplete_ready = use_external_data and _extension_asset_data_ready(TAGCOMPLETE_DIR, "tagcomplete")
    bundled_autocomplete_ready = (
        use_bundled_autocomplete
        and _extension_asset_data_ready(BUNDLED_TAGCOMPLETE_DIR, "tagcomplete")
    )
    builtin_ready = _should_use_builtin_prompt_data()
    prompt_source = (
        _prompt_asset_source(PROMPT_ALL_IN_ONE_DIR, "prompt_all_in_one")
        if prompt_ready else "builtin" if builtin_ready else "unavailable"
    )
    autocomplete_source = (
        _prompt_asset_source(TAGCOMPLETE_DIR, "tagcomplete")
        if autocomplete_ready
        else "bundled" if bundled_autocomplete_ready
        else "builtin" if prompt_ready or builtin_ready
        else "unavailable"
    )
    return {
        "prompt": {
            "source": prompt_source,
            "ready": bool(prompt_ready or builtin_ready),
            "path": _path_text(PROMPT_ALL_IN_ONE_DIR) if prompt_ready else "",
        },
        "autocomplete": {
            "source": autocomplete_source,
            "ready": bool(autocomplete_ready or bundled_autocomplete_ready or prompt_ready or builtin_ready),
            "path": _path_text(
                TAGCOMPLETE_DIR if autocomplete_ready else BUNDLED_TAGCOMPLETE_DIR
            ) if autocomplete_ready or bundled_autocomplete_ready else "",
        },
    }


def _settings_response():
    custom_tags = LOCAL_CONFIG.get("custom_tags") if isinstance(LOCAL_CONFIG, dict) else []
    return {
        "settings": _bridge_settings(),
        "custom_tag_count": len(custom_tags) if isinstance(custom_tags, list) else 0,
        "config_path": _path_text(LOCAL_CONFIG_PATH),
        "webui_configured": bool(WEBUI_ROOT),
        "prompt_library": _prompt_library_status(),
        "assets": _bridge_asset_status(),
        "module_assets": _module_asset_status(),
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
            "system_prompt": str(config.get("system_prompt") or "You are a Stable Diffusion prompt assistant. Return concise English tags separated by commas."),
        },
    }


def _normalize_ai_base_url(value):
    raw = _truncate_text(value or "", MAX_SHORT_TEXT_LENGTH).strip().rstrip("/") or "https://api.siliconflow.cn/v1"
    parsed = urlparse(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("AI Base URL must use http:// or https://")
    if parsed.username or parsed.password:
        raise ValueError("AI Base URL must not contain credentials")
    if parsed.query or parsed.fragment:
        raise ValueError("AI Base URL must not contain a query string or fragment")
    hostname = parsed.hostname.casefold()
    insecure_allowed = str(os.environ.get("WEBUI_PROMPT_BRIDGE_ALLOW_INSECURE_AI_HTTP") or "").strip().casefold() in {"1", "true", "yes", "on"}
    if parsed.scheme == "http" and hostname not in {"localhost", "127.0.0.1", "::1"} and not insecure_allowed:
        raise ValueError("HTTP AI endpoints are only allowed on localhost; use HTTPS or explicitly enable insecure HTTP")
    return raw


def _url_origin(value):
    parsed = urlparse(str(value or ""))
    scheme = parsed.scheme.casefold()
    host = (parsed.hostname or "").casefold().rstrip(".")
    port = parsed.port or (443 if scheme == "https" else 80 if scheme == "http" else None)
    return scheme, host, port


class _SameOriginRedirectHandler(urllib.request.HTTPRedirectHandler):
    def __init__(self, source_url):
        super().__init__()
        self.source_origin = _url_origin(source_url)

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if _url_origin(newurl) != self.source_origin:
            raise ValueError("AI endpoint redirected to a different origin")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def _open_same_origin_url(request, timeout=45):
    opener = urllib.request.build_opener(_SameOriginRedirectHandler(request.full_url))
    return opener.open(request, timeout=timeout)


def _read_json_response(response, max_bytes=MAX_AI_RESPONSE_BYTES):
    content = response.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise ValueError("AI endpoint response is too large")
    return json.loads(content.decode("utf-8"))


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
    current = dict(current)
    try:
        previous_base_url = _normalize_ai_base_url(current.get("base_url"))
    except ValueError:
        previous_base_url = ""
    next_base_url = _normalize_ai_base_url(data.get("base_url"))
    current["enabled"] = bool(data.get("enabled"))
    current["provider"] = "openai_compatible"
    current["base_url"] = next_base_url
    current["model"] = _normalize_ai_model_name(data.get("model"), current["base_url"])
    system_prompt = _truncate_text(data.get("system_prompt") or "", MAX_PROMPT_TEXT_LENGTH).strip()
    if system_prompt:
        current["system_prompt"] = system_prompt
    submitted_api_key = str(data.get("api_key") or "").strip()
    clear_api_key = bool(data.get("clear_api_key"))
    base_url_changed = bool(previous_base_url and next_base_url != previous_base_url)
    if clear_api_key:
        current["api_key"] = ""
    elif submitted_api_key:
        current["api_key"] = submitted_api_key
    elif base_url_changed:
        current["api_key"] = ""
    config["ai_api"] = current
    _write_local_config(
        config,
        preserve_opaque_secret=not (clear_api_key or submitted_api_key or base_url_changed),
    )
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
    base_url = _normalize_ai_base_url(config.get("base_url"))
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
    with _open_same_origin_url(request, timeout=45) as response:
        data = _read_json_response(response)
    content = (((data.get("choices") or [{}])[0].get("message") or {}).get("content") or "").strip()
    return {"success": True, "content": content, "model": model}


def _list_ai_models(data=None):
    data = data if isinstance(data, dict) else {}
    config = _ai_config_raw()
    saved_base_url = _normalize_ai_base_url(config.get("base_url"))
    requested_base_url = _normalize_ai_base_url(data.get("base_url") or saved_base_url)
    submitted_api_key = str(data.get("api_key") or "").strip()
    if submitted_api_key:
        api_key = submitted_api_key
    elif requested_base_url == saved_base_url:
        api_key = str(config.get("api_key") or "").strip()
    else:
        raise ValueError("Base URL changed; enter the API Key again before detecting models")
    if not api_key:
        raise ValueError("请先填写 API Key")
    request = urllib.request.Request(
        f"{requested_base_url}/models",
        headers={
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "ComfyUI-WebUI-Prompt-Bridge",
        },
        method="GET",
    )
    with _open_same_origin_url(request, timeout=45) as response:
        payload = _read_json_response(response)
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
    return {"success": True, "base_url": requested_base_url, "models": unique, "count": len(unique)}


def _update_bridge_settings(data):
    config = dict(LOCAL_CONFIG) if isinstance(LOCAL_CONFIG, dict) else {}
    current = dict(_bridge_settings())
    for key in DEFAULT_BRIDGE_SETTINGS:
        if key not in data:
            continue
        value = data.get(key)
        if key == "show_startup_wizard":
            current[key] = bool(value)
        elif key == "zoom_summary_threshold":
            current[key] = _normalize_zoom_summary_threshold(value, current[key])
        elif key == "ui_visibility" and isinstance(value, dict):
            visibility = {}
            for visibility_key, default in UI_VISIBILITY_DEFAULTS.items():
                visibility[visibility_key] = bool(value.get(visibility_key, current["ui_visibility"].get(visibility_key, default)))
            for legacy_key, visibility_key in UI_VISIBILITY_LEGACY_KEYS.items():
                if legacy_key in value:
                    visibility[visibility_key] = bool(value.get(legacy_key))
            current[key] = visibility
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
            "category": source.get("category", "其他"),
            "license": source.get("license", ""),
            "filter_profile": source.get("filter_profile", ""),
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


def _prompt_market_text_matches_any(text, markers):
    folded = str(text or "").casefold().replace("_", " ").replace("-", " ")
    raw = str(text or "").casefold()
    for marker in markers or ():
        needle = str(marker or "").casefold().strip()
        if not needle:
            continue
        loose = needle.replace("_", " ").replace("-", " ")
        if needle in raw or loose in folded:
            return True
    return False


def _prompt_market_item_allowed(prompt, source):
    text = str(prompt or "")
    include_any = source.get("include_any")
    if include_any and not _prompt_market_text_matches_any(text, include_any):
        return False
    exclude_any = source.get("exclude_any")
    if exclude_any and _prompt_market_text_matches_any(text, exclude_any):
        return False
    return True


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
        if not _prompt_market_item_allowed(prompt, source):
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


def _items_from_prompt_csv(text, source):
    rows = csv.DictReader(text.splitlines())
    items = []
    group = str(source.get("group") or source["label"]).strip()
    subgroup = str(source.get("subgroup") or "完整 Prompt").strip()
    prompt_key = str(source.get("prompt_column") or "prompt").strip()
    limit = int(source.get("limit") or 1000)
    seen = set()
    for row in rows:
        prompt = str(row.get(prompt_key) or "").strip()
        if not prompt or prompt.casefold() in seen:
            continue
        if not _prompt_market_item_allowed(prompt, source):
            continue
        seen.add(prompt.casefold())
        items.append({
            "prompt": prompt,
            "local": "",
            "group": group,
            "subgroup": subgroup,
            "kind": _infer_prompt_market_kind(prompt, group, subgroup),
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
        elif source_format == "prompt_csv":
            items = _items_from_prompt_csv(text, source)
        else:
            raise ValueError("unsupported prompt market format")
    else:
        raise ValueError("this prompt market source has no downloadable or local data")
    if not items:
        raise ValueError("没有读到可导入的 WebUI/本地词库，请先连接 WebUI 或下载本地数据包")
    return source, items


def _commit_prompt_market_import(source_id, source, items):
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


def _import_prompt_market_source(source_id):
    source, items = _load_prompt_market_items(source_id)
    return _commit_prompt_market_import(source_id, source, items)


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


def _clear_custom_tags():
    config = dict(LOCAL_CONFIG) if isinstance(LOCAL_CONFIG, dict) else {}
    current = config.get("custom_tags")
    removed = len(current) if isinstance(current, list) else 0
    config["custom_tags"] = []
    config["prompt_market_imports"] = {}
    _write_local_config(config)
    _apply_local_config(config)
    return {
        **_custom_tag_response(),
        "removed": removed,
    }


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


def _safe_model_list(kind):
    try:
        return sorted(folder_paths.get_filename_list(kind), key=lambda item: str(item).casefold())
    except Exception:
        return []


def _model_group_status(kind, aliases=()):
    names = []
    seen = set()

    def append_name(value):
        name = str(value or "").strip().replace("\\", "/")
        if not name:
            return
        filename = Path(name).name.casefold()
        if filename.startswith("put_") or filename.endswith((
            ".corrupted", ".download", ".part", ".tmp", ".aria2",
        )):
            return
        key = name.casefold()
        if key in seen:
            return
        seen.add(key)
        names.append(name)

    for model_kind in (kind, *aliases):
        for name in _safe_model_list(model_kind):
            append_name(name)
    try:
        models_dir = Path(getattr(folder_paths, "models_dir", Path("models")))
        for relative in (kind, *aliases):
            root = models_dir / str(relative)
            if not root.exists():
                continue
            for file in root.rglob("*"):
                if not file.is_file():
                    continue
                if file.name.casefold().startswith("put_"):
                    continue
                rel = file.relative_to(root).as_posix()
                append_name(rel)
    except Exception:
        pass
    return {
        "kind": kind,
        "aliases": list(aliases),
        "count": len(names),
        "items": names[:200],
        "truncated": len(names) > 200,
    }


def _custom_node_dir_status(name, patterns):
    custom_nodes_dir = NODE_DIR.parent
    matches = []
    try:
        for child in custom_nodes_dir.iterdir():
            if not child.is_dir():
                continue
            child_key = child.name.casefold()
            if any(pattern in child_key for pattern in patterns):
                matches.append(_path_text(child))
    except Exception:
        matches = []
    return {
        "name": name,
        "installed": bool(matches),
        "paths": matches,
    }


def _module_asset_status():
    node_packages = {
        "impact_pack": _custom_node_dir_status("ComfyUI Impact Pack", ["impact-pack", "impact_pack", "impactpack"]),
        "impact_subpack": _custom_node_dir_status("ComfyUI Impact Subpack", ["impact-subpack", "impact_subpack", "impactsubpack"]),
        "controlnet_aux": _custom_node_dir_status("ControlNet Auxiliary Preprocessors", ["controlnet_aux", "controlnet-aux", "auxiliary"]),
        "segment_anything": _custom_node_dir_status("Segment Anything / SAM", ["segment-anything", "segment_anything", "easy-sam", "sam2", "sam3"]),
        "ultimate_upscale": _custom_node_dir_status("Ultimate SD Upscale", ["ultimatesdupscale", "ultimate_sd_upscale", "ultimate-sd-upscale"]),
    }
    for key, package in node_packages.items():
        spec = MODULE_NODE_ASSETS.get(key)
        if spec:
            package["install_label"] = spec["label"]
            package["install_note"] = spec.get("note", "")
            package["target"] = _path_text(NODE_DIR.parent / spec["directory"])
    models = {
        "controlnet": _model_group_status("controlnet"),
        "upscale_models": _model_group_status("upscale_models"),
        "sams": _model_group_status("sams", aliases=("sam", "SAM")),
        "ultralytics": _model_group_status("ultralytics", aliases=("bbox", "segm")),
    }
    adetailer_ready = (
        node_packages["impact_pack"]["installed"]
        and node_packages["impact_subpack"]["installed"]
        and models["ultralytics"]["count"] > 0
    )
    controlnet_ready = models["controlnet"]["count"] > 0
    sam_assets_ready = node_packages["segment_anything"]["installed"] and models["sams"]["count"] > 0
    readiness = {
        "img2img": {
            "level": "ready",
            "label": "接入节点可用",
            "detail": "上传图片后仍需可用的 VAE / KSampler 主链路。",
        },
        "mask": {
            "level": "ready",
            "label": "接入节点可用",
            "detail": "需要外部 IMAGE、VAE、MASK 或 LATENT 输入。",
        },
        "adetailer": {
            "level": "ready" if adetailer_ready else "blocked",
            "label": "检测修复可用" if adetailer_ready else "缺少检测节点或模型",
            "detail": (
                "Impact Pack、Impact Subpack 与 Ultralytics 检测模型均已就绪。"
                if adetailer_ready else
                "需要 Impact Pack、Impact Subpack 和至少一个可用 Ultralytics 模型。"
            ),
        },
        "controlnet": {
            "level": "ready" if controlnet_ready else "blocked",
            "label": "控制模型可用" if controlnet_ready else "缺少 ControlNet 模型",
            "detail": (
                "可构建 Apply 节点；仍需接入 CONTROL_NET 与控制图。"
                if controlnet_ready else
                "预处理器已经安装，但不能代替 ControlNet 模型。请先放入控制模型。"
            ),
        },
        "sam": {
            "level": "partial" if sam_assets_ready else "blocked",
            "label": "Inpaint 接入可用" if sam_assets_ready else "缺少 SAM 节点或模型",
            "detail": (
                "当前一键构建只负责 Mask/Inpaint 接入；SAM 分割节点需按所装插件手动连接。"
                if sam_assets_ready else
                "需要 SAM 节点包和至少一个 SAM 模型。"
            ),
        },
        "upscale": {
            "level": "partial",
            "label": "Hires.fix 接入可用",
            "detail": "一键构建使用内置 Latent/Image Upscale；Ultimate SD Upscale 需要手动接外置节点。",
        },
        "regional_lora": {
            "level": "audit",
            "label": "仅审计，不隔离",
            "detail": "只统计区域 Prompt 中的 LoRA；普通 LoRA 仍会全局加载。",
        },
    }
    return {
        "node_packages": node_packages,
        "models": models,
        "readiness": readiness,
        "capabilities": {
            "controlnet_apply": True,
            "image_upscale": True,
            "latent_upscale": True,
            "inpaint_conditioning": True,
            "adetailer_conditioning": True,
            "auto_detection": (
                (node_packages["impact_pack"]["installed"] and node_packages["impact_subpack"]["installed"])
                or node_packages["segment_anything"]["installed"]
            ),
        },
        "installable": {
            key: {
                "label": spec["label"],
                "note": spec.get("note", ""),
                "target": _path_text(NODE_DIR.parent / spec["directory"]),
            }
            for key, spec in MODULE_NODE_ASSETS.items()
        },
    }


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
    return _install_asset_spec(key, spec, parent)


def _install_asset_spec(key, spec, parent):
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


def _prepare_extension_asset_install(data):
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

    return {
        "ok": ok,
        "mode": mode,
        "root": root,
        "results": results,
    }


def _commit_extension_asset_install(prepared):
    ok = bool(prepared.get("ok"))
    mode = prepared.get("mode") or "local"
    root = prepared.get("root")
    results = prepared.get("results") or []
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


def _install_extension_assets(data):
    return _commit_extension_asset_install(_prepare_extension_asset_install(data))


def _install_module_node_assets(data):
    requested = data.get("assets") or data.get("packages") or []
    if isinstance(requested, str):
        requested = [requested]
    if not isinstance(requested, list):
        requested = []
    selected = [str(key).strip() for key in requested if str(key).strip() in MODULE_NODE_ASSETS]
    if not selected:
        return {
            "ok": False,
            "error": "请选择要下载的扩展；为了保持快速开始体验，不会默认安装全部扩展。",
            "results": [],
            "module_assets": _module_asset_status(),
            "restart_required": False,
        }
    parent = NODE_DIR.parent
    parent.mkdir(parents=True, exist_ok=True)
    results = []
    for key in selected:
        spec = MODULE_NODE_ASSETS[key]
        result = _install_asset_spec(key, spec, parent)
        result["id"] = key
        result["label"] = spec["label"]
        result["note"] = spec.get("note", "")
        results.append(result)
    ok = all(item.get("status") in {"exists", "installed"} for item in results)
    return {
        "ok": ok,
        "results": results,
        "module_assets": _module_asset_status(),
        "restart_required": any(item.get("status") == "installed" for item in results),
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
        x = 0.0
        for value in row:
            width = value / total
            cells.append({"x": x, "y": 0.0, "width": width, "height": 1.0})
            x += width
    elif split == "horizontal":
        row = rows[0]
        total = sum(row) or 1.0
        y = 0.0
        for value in row:
            height = value / total
            cells.append({"x": 0.0, "y": y, "width": 1.0, "height": height})
            y += height
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


def _regional_join_prompt_parts(parts):
    return " BREAK\n".join(part for part in parts if str(part or "").strip())


def _regional_reverse_prompt_text(text, base_enabled=False, common_enabled=False):
    parts, separators = _regional_split_prompt(text)
    explicit_base = "ADDBASE" in separators
    explicit_common = "ADDCOMM" in separators
    offset = 0
    if common_enabled or explicit_common:
        offset += 1
    if base_enabled or explicit_base:
        offset += 1
    if len(parts) <= offset + 1:
        return text
    return _regional_join_prompt_parts([*parts[:offset], *reversed(parts[offset:])])


def _regional_reverse_ratios(ratios, split):
    rows = _regional_parse_ratio_grid(ratios, split)
    if split == "horizontal":
        rows = list(reversed(rows))
    else:
        rows = [list(reversed(row)) for row in rows]
    return ";".join(",".join(f"{value:g}" for value in row) for row in rows)


def _merge_prompt_text(prefix, text):
    prefix = str(prefix or "").strip()
    text = str(text or "").strip()
    if not prefix:
        return text
    if not text:
        return prefix
    return f"{prefix}, {text}"


def _bounded_float(value, default, min_value=None, max_value=None):
    try:
        number = float(value)
    except (TypeError, ValueError):
        number = float(default)
    if min_value is not None:
        number = max(float(min_value), number)
    if max_value is not None:
        number = min(float(max_value), number)
    return number


def _bounded_int(value, default, min_value=None, max_value=None):
    try:
        number = int(value)
    except (TypeError, ValueError):
        number = int(default)
    if min_value is not None:
        number = max(int(min_value), number)
    if max_value is not None:
        number = min(int(max_value), number)
    return number


def _bridge_number(value):
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number and number not in (float("inf"), float("-inf")) else None


def _bridge_number_in_range(value, min_value, max_value):
    number = _bridge_number(value)
    return number is not None and min_value <= number <= max_value


def _bridge_looks_like_scale(value):
    return _bridge_number_in_range(value, 1, 8)


def _bridge_looks_like_steps(value):
    return _bridge_number_in_range(value, 0, 150)


def _bridge_looks_like_denoise(value):
    return _bridge_number_in_range(value, 0, 1)


def _bridge_looks_like_tile(value):
    return _bridge_number_in_range(value, 128, 16384)


def _bridge_looks_like_overlap(value):
    return _bridge_number_in_range(value, 0, 1024)


def _bridge_looks_like_boolean(value):
    if isinstance(value, bool):
        return True
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return value in (0, 1)
    if isinstance(value, str):
        return value.strip().lower() in {"true", "false", "0", "1", "on", "off", "yes", "no"}
    return False


def _bridge_bool(value, default=False):
    if value is None or value == "":
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return value != 0
    if isinstance(value, str):
        return value.strip().lower() not in {"", "false", "0", "off", "no"}
    return bool(value)


def _bridge_legacy_denoise(value):
    number = _bridge_number(value)
    if number is not None and 0 < number <= 1:
        return number
    return 0.48


def _repair_legacy_upscale_widget_shift(
    module_upscale_by,
    module_upscale_upscaler,
    module_upscale_steps,
    module_upscale_denoise,
    module_upscale_tile_width,
    module_upscale_tile_height,
    module_upscale_overlap,
    module_regional_lora_enabled,
):
    by_looks_like_steps = _bridge_looks_like_steps(module_upscale_by) and not _bridge_looks_like_scale(module_upscale_by)
    upscaler_looks_like_scale = _bridge_looks_like_scale(module_upscale_upscaler)
    upscaler_looks_like_steps = _bridge_looks_like_steps(module_upscale_upscaler)

    if (
        by_looks_like_steps
        and upscaler_looks_like_scale
        and _bridge_looks_like_tile(module_upscale_steps)
        and _bridge_looks_like_tile(module_upscale_denoise)
        and _bridge_looks_like_overlap(module_upscale_tile_width)
        and _bridge_looks_like_boolean(module_upscale_tile_height)
    ):
        return (
            module_upscale_upscaler,
            "nearest-exact",
            module_upscale_by,
            0.48,
            module_upscale_steps,
            module_upscale_denoise,
            module_upscale_tile_width,
            _bridge_bool(module_upscale_tile_height),
        )

    if (
        by_looks_like_steps
        and upscaler_looks_like_scale
        and _bridge_looks_like_denoise(module_upscale_steps)
        and _bridge_looks_like_tile(module_upscale_denoise)
        and _bridge_looks_like_tile(module_upscale_tile_width)
        and _bridge_looks_like_overlap(module_upscale_tile_height)
    ):
        return (
            module_upscale_upscaler,
            "nearest-exact",
            module_upscale_by,
            _bridge_legacy_denoise(module_upscale_steps),
            module_upscale_denoise,
            module_upscale_tile_width,
            module_upscale_tile_height,
            _bridge_bool(module_upscale_overlap),
        )

    if (
        _bridge_looks_like_scale(module_upscale_by)
        and upscaler_looks_like_steps
        and _bridge_looks_like_denoise(module_upscale_steps)
        and _bridge_looks_like_tile(module_upscale_denoise)
        and _bridge_looks_like_tile(module_upscale_tile_width)
        and _bridge_looks_like_overlap(module_upscale_tile_height)
    ):
        return (
            module_upscale_by,
            "nearest-exact",
            module_upscale_upscaler,
            _bridge_legacy_denoise(module_upscale_steps),
            module_upscale_denoise,
            module_upscale_tile_width,
            module_upscale_tile_height,
            _bridge_bool(module_upscale_overlap),
        )

    if (
        _bridge_looks_like_scale(module_upscale_by)
        and upscaler_looks_like_steps
        and _bridge_looks_like_tile(module_upscale_steps)
        and _bridge_looks_like_tile(module_upscale_denoise)
        and _bridge_looks_like_overlap(module_upscale_tile_width)
        and _bridge_looks_like_boolean(module_upscale_tile_height)
    ):
        return (
            module_upscale_by,
            "nearest-exact",
            module_upscale_upscaler,
            0.48,
            module_upscale_steps,
            module_upscale_denoise,
            module_upscale_tile_width,
            _bridge_bool(module_upscale_tile_height),
        )

    return (
        module_upscale_by,
        module_upscale_upscaler,
        module_upscale_steps,
        module_upscale_denoise,
        module_upscale_tile_width,
        module_upscale_tile_height,
        module_upscale_overlap,
        module_regional_lora_enabled,
    )


def _apply_negative_common_prompt(negative_text, common_prompt):
    common_prompt = str(common_prompt or "").strip()
    if not common_prompt:
        return negative_text
    parts, _ = _regional_split_prompt(negative_text)
    parts = [part for part in parts if part.strip()]
    if not parts:
        return common_prompt
    return _regional_join_prompt_parts(_merge_prompt_text(common_prompt, part) for part in parts)


def _conditioning_set_mask(conditioning, mask, strength=1.0, set_area_to_bounds=False):
    if mask is None:
        return conditioning
    try:
        strength = max(0.0, float(strength))
    except (TypeError, ValueError):
        strength = 1.0
    return _conditioning_set_values(conditioning, {
        "mask": mask,
        "set_area_to_bounds": bool(set_area_to_bounds),
        "mask_strength": strength,
    })


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

    ratio_text = str(ratios or "")
    split = "grid" if positive_parts["grid_requested"] or ";" in ratio_text or "；" in ratio_text else (split or "vertical")
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
    SEARCH_ALIASES = [
        "webui",
        "webui prompt",
        "webui prompt bridge",
        "prompt bridge",
        "bridge prompt",
        "a1111 prompt",
        "forge prompt",
        "lora browser",
        "regional prompt",
        "区域提示词",
        "提示词桥接",
    ]
    FUNCTION = "build"
    RETURN_TYPES = ("MODEL", "CLIP", "CONDITIONING", "CONDITIONING", "STRING", "STRING", "STRING", "STRING", "IMAGE", "MASK", "FLOAT", "STRING")
    RETURN_NAMES = ("model", "clip", "positive", "negative", "positive_text", "negative_text", "lora_info", "module_config", "image", "mask", "img2img_denoise", "img2img_mode")

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
                "regional_canvas_auto": ("BOOLEAN", {"default": True}),
                "regional_canvas_width": ("INT", {"default": 1024, "min": 64, "max": 16384, "step": 8}),
                "regional_canvas_height": ("INT", {"default": 1024, "min": 64, "max": 16384, "step": 8}),
                "module_table_enabled": ("BOOLEAN", {"default": False}),
                "module_mask_enabled": ("BOOLEAN", {"default": False}),
                "module_mask_strength": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 10.0, "step": 0.05}),
                "module_mask_set_area_to_bounds": ("BOOLEAN", {"default": False}),
                "module_negative_common_enabled": ("BOOLEAN", {"default": False}),
                "module_negative_common_prompt": ("STRING", {"default": "", "multiline": True}),
                "module_flip_enabled": ("BOOLEAN", {"default": False}),
                "module_flip_axis": (["auto", "horizontal", "vertical"], {"default": "auto"}),
                "module_presets_enabled": ("BOOLEAN", {"default": False}),
                "module_adetailer_enabled": ("BOOLEAN", {"default": False}),
                "module_adetailer_model": (
                    [
                        "face_yolov8m.pt",
                        "face_yolov8n.pt",
                        "face_yolov8s.pt",
                        "hand_yolov8s.pt",
                        "hand_yolov8n.pt",
                        "person_yolov8m-seg.pt",
                        "person_yolov8n-seg.pt",
                        "mediapipe_face_full",
                        "custom",
                    ],
                    {"default": "face_yolov8m.pt"},
                ),
                "module_adetailer_prompt": ("STRING", {"default": "detailed face, detailed eyes, detailed hands", "multiline": True}),
                "module_adetailer_negative_prompt": ("STRING", {"default": "bad anatomy, deformed, blurry, extra fingers", "multiline": True}),
                "module_adetailer_confidence": ("FLOAT", {"default": 0.30, "min": 0.0, "max": 1.0, "step": 0.01}),
                "module_adetailer_mask_blur": ("INT", {"default": 4, "min": 0, "max": 64, "step": 1}),
                "module_adetailer_denoise": ("FLOAT", {"default": 0.40, "min": 0.0, "max": 1.0, "step": 0.01}),
                "module_adetailer_inpaint_only_masked": ("BOOLEAN", {"default": True}),
                "module_adetailer_cycles": ("INT", {"default": 1, "min": 1, "max": 8, "step": 1}),
                "module_controlnet_enabled": ("BOOLEAN", {"default": False}),
                "module_controlnet_preprocessor": (
                    ["none", "canny", "depth", "openpose", "lineart", "softedge", "normal", "tile", "reference", "ip-adapter"],
                    {"default": "canny"},
                ),
                "module_controlnet_model": ("STRING", {"default": "", "multiline": False}),
                "module_controlnet_weight": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 2.0, "step": 0.05}),
                "module_controlnet_start": ("FLOAT", {"default": 0.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "module_controlnet_end": ("FLOAT", {"default": 1.0, "min": 0.0, "max": 1.0, "step": 0.01}),
                "module_controlnet_resize_mode": (["just_resize", "crop_and_resize", "resize_and_fill"], {"default": "just_resize"}),
                "module_controlnet_control_mode": (["balanced", "prompt", "control"], {"default": "balanced"}),
                "module_controlnet_pixel_perfect": ("BOOLEAN", {"default": True}),
                "module_sam_enabled": ("BOOLEAN", {"default": False}),
                "module_sam_model": (["sam_vit_b", "sam_vit_l", "sam_vit_h", "sam_hq_vit_h", "mobile_sam", "custom"], {"default": "sam_vit_b"}),
                "module_sam_prompt_mode": (["auto", "point", "box", "mask"], {"default": "auto"}),
                "module_sam_confidence": ("FLOAT", {"default": 0.50, "min": 0.0, "max": 1.0, "step": 0.01}),
                "module_sam_mask_blur": ("INT", {"default": 4, "min": 0, "max": 64, "step": 1}),
                "module_sam_dilate": ("INT", {"default": 0, "min": -64, "max": 64, "step": 1}),
                "module_sam_inpaint_denoise": ("FLOAT", {"default": 0.45, "min": 0.0, "max": 1.0, "step": 0.01}),
                "module_sam_inpaint_area": (["whole_picture", "only_masked"], {"default": "only_masked"}),
                "module_sam_padding": ("INT", {"default": 32, "min": 0, "max": 512, "step": 8}),
                "module_upscale_enabled": ("BOOLEAN", {"default": False}),
                "module_upscale_mode": (["hires_fix", "ultimate_sd_upscale", "latent_upscale", "tile"], {"default": "hires_fix"}),
                "module_upscale_by": ("FLOAT", {"default": 2.0, "min": 1.0, "max": 8.0, "step": 0.05}),
                "module_upscale_upscaler": ("STRING", {"default": "nearest-exact", "multiline": False}),
                "module_upscale_steps": ("INT", {"default": 18, "min": 0, "max": 150, "step": 1}),
                "module_upscale_denoise": ("FLOAT", {"default": 0.48, "min": 0.0, "max": 1.0, "step": 0.01}),
                "module_upscale_tile_width": ("INT", {"default": 768, "min": 128, "max": 4096, "step": 8}),
                "module_upscale_tile_height": ("INT", {"default": 768, "min": 128, "max": 4096, "step": 8}),
                "module_upscale_overlap": ("INT", {"default": 64, "min": 0, "max": 1024, "step": 8}),
                "module_regional_lora_enabled": ("BOOLEAN", {"default": False}),
                "module_img2img_image": ("STRING", {"default": "", "multiline": False}),
                "module_img2img_mask": ("STRING", {"default": "", "multiline": False}),
                "module_img2img_mode": (["img2img", "inpaint"], {"default": "img2img"}),
                "module_img2img_denoise": ("FLOAT", {"default": 0.55, "min": 0.0, "max": 1.0, "step": 0.01}),
                "module_img2img_enabled": ("BOOLEAN", {"default": False}),
                "generation_size_enabled": ("BOOLEAN", {"default": False}),
                "generation_width": ("INT", {"default": 1024, "min": 64, "max": 16384, "step": 8}),
                "generation_height": ("INT", {"default": 1024, "min": 64, "max": 16384, "step": 8}),
                "generation_seed_enabled": ("BOOLEAN", {"default": False}),
                "generation_seed": ("INT", {"default": 1, "min": 0, "max": 0xffffffffffffffff, "step": 1}),
                "generation_steps_enabled": ("BOOLEAN", {"default": False}),
                "generation_steps": ("INT", {"default": 30, "min": 1, "max": 10000, "step": 1}),
                "generation_seed_mode": (["fixed", "increment", "decrement", "randomize"], {"default": "fixed"}),
            },
            "optional": {
                "regional_mask": ("MASK",),
            },
            "hidden": {
                "prompt": "PROMPT",
                "unique_id": "UNIQUE_ID",
            },
        }

    @classmethod
    def VALIDATE_INPUTS(
        cls,
        module_upscale_by=None,
        module_upscale_upscaler=None,
        module_upscale_steps=None,
        module_upscale_denoise=None,
        module_upscale_tile_width=None,
        module_upscale_tile_height=None,
        module_upscale_overlap=None,
        module_regional_lora_enabled=None,
    ):
        return True

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
        regional_canvas_auto=True,
        regional_canvas_width=1024,
        regional_canvas_height=1024,
        module_table_enabled=False,
        module_mask_enabled=False,
        module_mask_strength=1.0,
        module_mask_set_area_to_bounds=False,
        module_negative_common_enabled=False,
        module_negative_common_prompt="",
        module_flip_enabled=False,
        module_flip_axis="auto",
        module_presets_enabled=False,
        module_adetailer_enabled=False,
        module_adetailer_model="face_yolov8m.pt",
        module_adetailer_prompt="detailed face, detailed eyes, detailed hands",
        module_adetailer_negative_prompt="bad anatomy, deformed, blurry, extra fingers",
        module_adetailer_confidence=0.30,
        module_adetailer_mask_blur=4,
        module_adetailer_denoise=0.40,
        module_adetailer_inpaint_only_masked=True,
        module_adetailer_cycles=1,
        module_controlnet_enabled=False,
        module_controlnet_preprocessor="canny",
        module_controlnet_model="",
        module_controlnet_weight=1.0,
        module_controlnet_start=0.0,
        module_controlnet_end=1.0,
        module_controlnet_resize_mode="just_resize",
        module_controlnet_control_mode="balanced",
        module_controlnet_pixel_perfect=True,
        module_sam_enabled=False,
        module_sam_model="sam_vit_b",
        module_sam_prompt_mode="auto",
        module_sam_confidence=0.50,
        module_sam_mask_blur=4,
        module_sam_dilate=0,
        module_sam_inpaint_denoise=0.45,
        module_sam_inpaint_area="only_masked",
        module_sam_padding=32,
        module_upscale_enabled=False,
        module_upscale_mode="hires_fix",
        module_upscale_by=2.0,
        module_upscale_upscaler="nearest-exact",
        module_upscale_steps=18,
        module_upscale_denoise=0.48,
        module_upscale_tile_width=768,
        module_upscale_tile_height=768,
        module_upscale_overlap=64,
        module_regional_lora_enabled=False,
        module_img2img_image="",
        module_img2img_mask="",
        module_img2img_mode="img2img",
        module_img2img_denoise=0.55,
        module_img2img_enabled=False,
        generation_size_enabled=False,
        generation_width=1024,
        generation_height=1024,
        generation_seed_enabled=False,
        generation_seed=1,
        generation_steps_enabled=False,
        generation_steps=30,
        generation_seed_mode="fixed",
        regional_mask=None,
        prompt=None,
        unique_id=None,
    ):
        try:
            default_clip_strength = float(default_clip_strength)
        except (TypeError, ValueError):
            default_clip_strength = 1.0
        module_img2img_image = _coerce_bridge_image_ref(module_img2img_image)
        module_img2img_mask = _coerce_bridge_image_ref(module_img2img_mask)
        (
            module_upscale_by,
            module_upscale_upscaler,
            module_upscale_steps,
            module_upscale_denoise,
            module_upscale_tile_width,
            module_upscale_tile_height,
            module_upscale_overlap,
            module_regional_lora_enabled,
        ) = _repair_legacy_upscale_widget_shift(
            module_upscale_by,
            module_upscale_upscaler,
            module_upscale_steps,
            module_upscale_denoise,
            module_upscale_tile_width,
            module_upscale_tile_height,
            module_upscale_overlap,
            module_regional_lora_enabled,
        )

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

        module_config = {
            "version": 1,
            "regional": {
                "enabled": bool(regional_enabled),
                "mode": regional_mode,
                "split": regional_split,
                "ratios": str(regional_ratios or ""),
                "base_enabled": bool(regional_base_enabled),
                "common_enabled": bool(regional_common_enabled),
                "base_ratio": _bounded_float(regional_base_ratio, 0.2, 0.0, 1.0),
                "strength": _bounded_float(regional_strength, 1.0, 0.0, 10.0),
                "canvas": {
                    "auto": bool(regional_canvas_auto),
                    "width": _bounded_int(regional_canvas_width, 1024, 64, 16384),
                    "height": _bounded_int(regional_canvas_height, 1024, 64, 16384),
                },
            },
            "modules": {
                "table": {"enabled": bool(module_table_enabled)},
                "mask": {
                    "enabled": bool(module_mask_enabled),
                    "has_mask_input": regional_mask is not None,
                    "strength": _bounded_float(module_mask_strength, 1.0, 0.0, 10.0),
                    "set_area_to_bounds": bool(module_mask_set_area_to_bounds),
                },
                "negative_common": {
                    "enabled": bool(module_negative_common_enabled),
                    "prompt": str(module_negative_common_prompt or "").strip(),
                },
                "flip": {
                    "enabled": bool(module_flip_enabled),
                    "axis": module_flip_axis if module_flip_axis in {"auto", "horizontal", "vertical"} else "auto",
                },
                "presets": {"enabled": bool(module_presets_enabled)},
                "img2img": {
                    "enabled": bool(module_img2img_enabled and module_img2img_image),
                    "image": str(module_img2img_image or ""),
                    "mask": str(module_img2img_mask or ""),
                    "mode": str(module_img2img_mode or "img2img"),
                    "denoise": _bounded_float(module_img2img_denoise, 0.55, 0.0, 1.0),
                },
                "generation": {
                    "size_enabled": bool(generation_size_enabled),
                    "width": _bounded_int(generation_width, 1024, 64, 16384),
                    "height": _bounded_int(generation_height, 1024, 64, 16384),
                    "steps_enabled": bool(generation_steps_enabled),
                    "steps": _bounded_int(generation_steps, 30, 1, 10000),
                    "seed_enabled": bool(generation_seed_enabled),
                    "seed": _bounded_int(generation_seed, 1, 0, 0xffffffffffffffff),
                    "seed_mode": str(generation_seed_mode) if generation_seed_mode in {"fixed", "increment", "decrement", "randomize"} else "fixed",
                },
                "adetailer": {
                    "enabled": bool(module_adetailer_enabled),
                    "model": str(module_adetailer_model or "face_yolov8m.pt"),
                    "prompt": str(module_adetailer_prompt or "").strip(),
                    "negative_prompt": str(module_adetailer_negative_prompt or "").strip(),
                    "confidence": _bounded_float(module_adetailer_confidence, 0.30, 0.0, 1.0),
                    "mask_blur": _bounded_int(module_adetailer_mask_blur, 4, 0, 64),
                    "denoise": _bounded_float(module_adetailer_denoise, 0.40, 0.0, 1.0),
                    "inpaint_only_masked": bool(module_adetailer_inpaint_only_masked),
                    "cycles": _bounded_int(module_adetailer_cycles, 1, 1, 8),
                },
                "controlnet": {
                    "enabled": bool(module_controlnet_enabled),
                    "preprocessor": str(module_controlnet_preprocessor or "canny"),
                    "model": str(module_controlnet_model or "").strip(),
                    "weight": _bounded_float(module_controlnet_weight, 1.0, 0.0, 2.0),
                    "start": _bounded_float(module_controlnet_start, 0.0, 0.0, 1.0),
                    "end": _bounded_float(module_controlnet_end, 1.0, 0.0, 1.0),
                    "resize_mode": str(module_controlnet_resize_mode or "just_resize"),
                    "control_mode": str(module_controlnet_control_mode or "balanced"),
                    "pixel_perfect": bool(module_controlnet_pixel_perfect),
                },
                "sam_inpaint": {
                    "enabled": bool(module_sam_enabled),
                    "model": str(module_sam_model or "sam_vit_b"),
                    "prompt_mode": str(module_sam_prompt_mode or "auto"),
                    "confidence": _bounded_float(module_sam_confidence, 0.50, 0.0, 1.0),
                    "mask_blur": _bounded_int(module_sam_mask_blur, 4, 0, 64),
                    "dilate": _bounded_int(module_sam_dilate, 0, -64, 64),
                    "inpaint_denoise": _bounded_float(module_sam_inpaint_denoise, 0.45, 0.0, 1.0),
                    "inpaint_area": str(module_sam_inpaint_area or "only_masked"),
                    "padding": _bounded_int(module_sam_padding, 32, 0, 512),
                },
                "upscale": {
                    "enabled": bool(module_upscale_enabled),
                    "mode": str(module_upscale_mode or "hires_fix"),
                    "scale_by": _bounded_float(module_upscale_by, 2.0, 1.0, 8.0),
                    "upscaler": str(module_upscale_upscaler or "nearest-exact"),
                    "steps": _bounded_int(module_upscale_steps, 18, 0, 150),
                    "denoise": _bounded_float(module_upscale_denoise, 0.48, 0.0, 1.0),
                    "tile_width": _bounded_int(module_upscale_tile_width, 768, 128, 4096),
                    "tile_height": _bounded_int(module_upscale_tile_height, 768, 128, 4096),
                    "overlap": _bounded_int(module_upscale_overlap, 64, 0, 1024),
                },
                "regional_lora": {"enabled": bool(module_regional_lora_enabled)},
            },
        }
        if module_config["modules"]["controlnet"]["end"] < module_config["modules"]["controlnet"]["start"]:
            module_config["modules"]["controlnet"]["start"], module_config["modules"]["controlnet"]["end"] = (
                module_config["modules"]["controlnet"]["end"],
                module_config["modules"]["controlnet"]["start"],
            )

        module_info = []
        if module_negative_common_enabled and str(module_negative_common_prompt or "").strip():
            negative_text = _apply_negative_common_prompt(negative_text, module_negative_common_prompt)
            module_info.append("Negative Common=on")
        if module_table_enabled:
            module_info.append("Region Table=on")
        if module_presets_enabled:
            module_info.append("Region Presets=on")

        if module_adetailer_enabled:
            try:
                ad_confidence = min(1.0, max(0.0, float(module_adetailer_confidence)))
            except (TypeError, ValueError):
                ad_confidence = 0.30
            try:
                ad_denoise = min(1.0, max(0.0, float(module_adetailer_denoise)))
            except (TypeError, ValueError):
                ad_denoise = 0.40
            try:
                ad_mask_blur = max(0, int(module_adetailer_mask_blur))
            except (TypeError, ValueError):
                ad_mask_blur = 4
            try:
                ad_cycles = min(8, max(1, int(module_adetailer_cycles)))
            except (TypeError, ValueError):
                ad_cycles = 1
            ad_prompt = str(module_adetailer_prompt or "").strip() or "inherit positive prompt"
            ad_negative = str(module_adetailer_negative_prompt or "").strip() or "inherit negative prompt"
            module_info.append(
                "ADetailer module=on "
                f"model={module_adetailer_model} confidence={ad_confidence:g} denoise={ad_denoise:g} "
                f"mask_blur={ad_mask_blur} cycles={ad_cycles} only_masked={'on' if module_adetailer_inpaint_only_masked else 'off'} "
                f"prompt={ad_prompt[:80]} negative={ad_negative[:80]}"
            )

        if module_flip_enabled:
            flip_split = regional_split
            if module_flip_axis == "horizontal":
                flip_split = "horizontal"
            elif module_flip_axis == "vertical":
                flip_split = "vertical"
            positive_text = _regional_reverse_prompt_text(positive_text, regional_base_enabled, regional_common_enabled)
            negative_text = _regional_reverse_prompt_text(negative_text)
            regional_ratios = _regional_reverse_ratios(regional_ratios, flip_split)
            module_config["regional"]["ratios"] = regional_ratios
            module_config["regional"]["split"] = flip_split
            module_info.append(f"Regional Flip={flip_split}")

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

        if module_mask_enabled:
            if regional_mask is not None:
                positive = _conditioning_set_mask(positive, regional_mask, module_mask_strength, module_mask_set_area_to_bounds)
                module_info.append("Mask conditioning=on")
            else:
                module_info.append("Mask conditioning=missing MASK input")

        if module_controlnet_enabled:
            try:
                controlnet_weight = float(module_controlnet_weight)
            except (TypeError, ValueError):
                controlnet_weight = 1.0
            try:
                controlnet_start = min(1.0, max(0.0, float(module_controlnet_start)))
            except (TypeError, ValueError):
                controlnet_start = 0.0
            try:
                controlnet_end = min(1.0, max(0.0, float(module_controlnet_end)))
            except (TypeError, ValueError):
                controlnet_end = 1.0
            if controlnet_end < controlnet_start:
                controlnet_start, controlnet_end = controlnet_end, controlnet_start
            controlnet_model = str(module_controlnet_model or "").strip() or "auto"
            module_info.append(
                "ControlNet module=on "
                f"preprocessor={module_controlnet_preprocessor} model={controlnet_model[:80]} "
                f"weight={controlnet_weight:g} range={controlnet_start:g}-{controlnet_end:g} "
                f"resize={module_controlnet_resize_mode} mode={module_controlnet_control_mode} "
                f"pixel_perfect={'on' if module_controlnet_pixel_perfect else 'off'}"
            )
        if module_sam_enabled:
            try:
                sam_confidence = min(1.0, max(0.0, float(module_sam_confidence)))
            except (TypeError, ValueError):
                sam_confidence = 0.50
            try:
                sam_mask_blur = max(0, int(module_sam_mask_blur))
            except (TypeError, ValueError):
                sam_mask_blur = 4
            try:
                sam_dilate = max(-64, min(64, int(module_sam_dilate)))
            except (TypeError, ValueError):
                sam_dilate = 0
            try:
                sam_denoise = min(1.0, max(0.0, float(module_sam_inpaint_denoise)))
            except (TypeError, ValueError):
                sam_denoise = 0.45
            try:
                sam_padding = max(0, int(module_sam_padding))
            except (TypeError, ValueError):
                sam_padding = 32
            module_info.append(
                "SAM/Inpaint module=on "
                f"model={module_sam_model} prompt_mode={module_sam_prompt_mode} confidence={sam_confidence:g} "
                f"mask_blur={sam_mask_blur} dilate={sam_dilate} denoise={sam_denoise:g} "
                f"area={module_sam_inpaint_area} padding={sam_padding}"
            )
        if module_upscale_enabled:
            try:
                upscale_by = max(1.0, float(module_upscale_by))
            except (TypeError, ValueError):
                upscale_by = 2.0
            try:
                upscale_steps = max(0, int(module_upscale_steps))
            except (TypeError, ValueError):
                upscale_steps = 12
            try:
                upscale_denoise = min(1.0, max(0.0, float(module_upscale_denoise)))
            except (TypeError, ValueError):
                upscale_denoise = 0.48
            try:
                tile_width = max(128, int(module_upscale_tile_width))
            except (TypeError, ValueError):
                tile_width = 768
            try:
                tile_height = max(128, int(module_upscale_tile_height))
            except (TypeError, ValueError):
                tile_height = 768
            try:
                tile_overlap = max(0, int(module_upscale_overlap))
            except (TypeError, ValueError):
                tile_overlap = 64
            module_info.append(
                "Upscale module=on "
                f"mode={module_upscale_mode} by={upscale_by:g} upscaler={str(module_upscale_upscaler or 'nearest-exact')[:80]} "
                f"steps={upscale_steps} denoise={upscale_denoise:g} tile={tile_width}x{tile_height} overlap={tile_overlap}"
            )
        if module_regional_lora_enabled:
            regional_lora_count = len(_parse_lora_tags(positive_text)[1])
            module_info.append(f"Regional LoRA audit=on detected={regional_lora_count} global LoRA(s)")
        img2img_image, img2img_mask = _empty_bridge_image()
        img2img_mode = str(module_img2img_mode or "img2img")
        img2img_denoise = _bounded_float(module_img2img_denoise, 0.55, 0.0, 1.0)
        if module_img2img_enabled and module_img2img_image:
            img2img_image, alpha_mask = _load_bridge_image_tensor(module_img2img_image)
            img2img_mask = _load_bridge_mask_tensor(module_img2img_mask, img2img_image) if module_img2img_mask else alpha_mask
            if img2img_mode != "inpaint" and not module_img2img_mask:
                img2img_mask = _empty_mask_for_image(img2img_image)
            module_info.append(
                f"Img2Img input=on mode={img2img_mode} denoise={img2img_denoise:g}"
                + (f" mask={module_img2img_mask}" if module_img2img_mask else "")
            )
        module_config["prompts"] = {
            "positive": positive_text,
            "negative": negative_text,
        }
        module_config["loras"] = {
            "applied": applied,
            "skipped_upstream": skipped_upstream,
            "missing": missing,
        }
        if regional_info:
            module_config["regional"]["result"] = {
                key: value
                for key, value in regional_info.items()
                if key not in {"positive", "negative"}
            }
        info = "Applied LoRAs: " + (", ".join(applied) if applied else "None")
        if module_info:
            info += " | Modules: " + "; ".join(module_info)
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

        module_config_text = json.dumps(module_config, ensure_ascii=False, separators=(",", ":"))
        return (
            model,
            clip,
            positive,
            negative,
            positive_text,
            negative_text,
            info,
            module_config_text,
            img2img_image,
            img2img_mask,
            img2img_denoise,
            img2img_mode,
        )


def _read_module_config_section(module_config, section):
    try:
        data = json.loads(module_config or "{}")
    except (TypeError, ValueError, json.JSONDecodeError):
        data = {}
    modules = data.get("modules") if isinstance(data, dict) else {}
    value = modules.get(section) if isinstance(modules, dict) else {}
    if not isinstance(value, dict):
        value = {}
    enabled = bool(value.get("enabled", False))
    return value, enabled


def _empty_mask_for_image(image):
    try:
        return torch.zeros((image.shape[0], image.shape[1], image.shape[2]), dtype=image.dtype, device=image.device)
    except Exception:
        return torch.zeros((1, 64, 64))


def _empty_bridge_image(width=64, height=64):
    dtype = comfy.model_management.intermediate_dtype()
    device = comfy.model_management.intermediate_device()
    image = torch.zeros((1, int(height), int(width), 3), dtype=dtype, device=device)
    mask = torch.zeros((1, int(height), int(width)), dtype=dtype, device=device)
    return image, mask


def _normalize_bridge_input_name(value):
    raw = str(value or "").strip().replace("\\", "/")
    if not raw:
        return ""
    if not raw.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
        raise ValueError("Bridge image must be PNG, JPEG, or WebP")
    relative = Path(raw)
    if relative.is_absolute():
        raise ValueError("Bridge image paths must stay inside the ComfyUI input directory")
    input_dir = Path(folder_paths.get_input_directory()).resolve()
    candidate = (input_dir / relative).resolve()
    if not candidate.is_relative_to(input_dir):
        raise ValueError("Bridge image paths must stay inside the ComfyUI input directory")
    return candidate.relative_to(input_dir).as_posix()


def _resolve_bridge_input_path(value):
    normalized = _normalize_bridge_input_name(value)
    if not normalized:
        raise ValueError("Bridge image is required")
    input_dir = Path(folder_paths.get_input_directory()).resolve()
    candidate = (input_dir / normalized).resolve()
    if not candidate.is_relative_to(input_dir) or not candidate.is_file():
        raise ValueError(f"Invalid image file: {normalized}")
    return candidate


def _coerce_bridge_image_ref(value):
    return _normalize_bridge_input_name(value)


def _load_bridge_image_tensor(image_name):
    image_path = _resolve_bridge_input_path(image_name)
    dtype = comfy.model_management.intermediate_dtype()
    device = comfy.model_management.intermediate_device()
    output_images = []
    output_alpha_masks = []
    width = None
    height = None
    with Image.open(image_path) as img:
        _validate_opened_image(img)
        for frame in ImageSequence.Iterator(img):
            frame = ImageOps.exif_transpose(frame)
            image = frame.convert("RGB")
            if width is None:
                width, height = image.size
            if image.size != (width, height):
                continue
            image_array = np.array(image).astype(np.float32) / 255.0
            output_images.append(torch.from_numpy(image_array)[None,].to(dtype=dtype))
            if "A" in frame.getbands():
                alpha = np.array(frame.getchannel("A")).astype(np.float32) / 255.0
                output_alpha_masks.append((1.0 - torch.from_numpy(alpha)).unsqueeze(0).to(dtype=dtype))
            else:
                output_alpha_masks.append(torch.zeros((1, height, width), dtype=dtype))
    if not output_images:
        raise ValueError(f"Invalid image file: {image_name}")
    return (
        torch.cat(output_images, dim=0).to(device=device, dtype=dtype),
        torch.cat(output_alpha_masks, dim=0).to(device=device, dtype=dtype),
    )


def _load_bridge_mask_tensor(mask_name, image):
    if not mask_name:
        return _empty_mask_for_image(image)
    mask_path = _resolve_bridge_input_path(mask_name)
    dtype = image.dtype
    device = image.device
    height = int(image.shape[1])
    width = int(image.shape[2])
    masks = []
    with Image.open(mask_path) as mask_image:
        _validate_opened_image(mask_image)
        for frame in ImageSequence.Iterator(mask_image):
            frame = ImageOps.exif_transpose(frame).convert("L")
            if frame.size != (width, height):
                frame = frame.resize((width, height), Image.Resampling.LANCZOS)
            mask = np.array(frame).astype(np.float32) / 255.0
            masks.append(torch.from_numpy(mask).unsqueeze(0).to(device=device, dtype=dtype))
    if not masks:
        return _empty_mask_for_image(image)
    mask = torch.cat(masks, dim=0)
    if mask.shape[0] == 1 and image.shape[0] > 1:
        mask = mask.repeat(image.shape[0], 1, 1)
    return mask[: image.shape[0]]


class _WebUIPromptBridgePromptBase:
    """Small prompt-only node; the frontend adds the shared tag autocomplete UI."""

    CATEGORY = "conditioning/webui"
    FUNCTION = "output"
    RETURN_TYPES = ("STRING",)

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                cls.PROMPT_NAME: (
                    "STRING",
                    {
                        "default": cls.DEFAULT_PROMPT,
                        "multiline": True,
                    },
                ),
            },
        }

    def output(self, **kwargs):
        return (str(kwargs.get(self.PROMPT_NAME, "") or ""),)


class WebUIPromptBridgePositivePrompt(_WebUIPromptBridgePromptBase):
    PROMPT_NAME = "positive_prompt"
    DEFAULT_PROMPT = "masterpiece, best quality, anime style, 1girl"
    RETURN_TYPES = ("STRING", "MODEL", "CLIP", "STRING")
    RETURN_NAMES = ("positive_text", "model", "clip", "lora_info")
    SEARCH_ALIASES = [
        "webui positive prompt",
        "positive prompt autocomplete",
        "正向提示词",
        "正面提示词",
        "提示词补全",
    ]

    def __init__(self):
        self.loaded_loras = {}

    @classmethod
    def INPUT_TYPES(cls):
        input_types = super().INPUT_TYPES()
        input_types["optional"] = {
            "model": ("MODEL",),
            "clip": ("CLIP",),
        }
        input_types["hidden"] = {
            "prompt": "PROMPT",
            "unique_id": "UNIQUE_ID",
        }
        return input_types

    def _load_lora(self, lora_name):
        lora_path = folder_paths.get_full_path_or_raise("loras", lora_name)
        cached = self.loaded_loras.get(lora_path)
        if cached is None:
            cached = comfy.utils.load_torch_file(lora_path, safe_load=True)
            self.loaded_loras[lora_path] = cached
        return cached

    def output(self, positive_prompt, model=None, clip=None, prompt=None, unique_id=None):
        source_text = str(positive_prompt or "")
        cleaned_text, loras = _parse_lora_tags(source_text)
        if not loras:
            return (source_text, model, clip, "未检测到 LoRA 标签")
        if model is None or clip is None:
            return (
                source_text,
                model,
                clip,
                f"检测到 {len(loras)} 个 LoRA，但 model / clip 未完整连接，尚未加载",
            )

        applied = []
        skipped_upstream = []
        missing = []
        upstream_loras = _collect_upstream_loras_from_prompt(prompt, unique_id)
        for requested, strength_model, strength_clip in loras:
            resolved = _resolve_lora_name(requested)
            if resolved is None:
                missing.append(requested)
                continue
            if _lora_key(resolved) in upstream_loras or _lora_key(requested) in upstream_loras:
                skipped_upstream.append(resolved)
                continue
            if strength_clip is None:
                strength_clip = 1.0
            if strength_model == 0 and strength_clip == 0:
                continue
            lora = self._load_lora(resolved)
            model, clip = comfy.sd.load_lora_for_models(model, clip, lora, strength_model, strength_clip)
            applied.append(f"{resolved}:model={strength_model:g}:clip={strength_clip:g}")
            print(f"[WebUIPromptBridgePositivePrompt] Applied LoRA: {resolved} model={strength_model:g} clip={strength_clip:g}")

        if missing:
            raise ValueError("Missing LoRA(s): " + ", ".join(missing))
        info_parts = []
        if applied:
            info_parts.append("Applied: " + "; ".join(applied))
        if skipped_upstream:
            info_parts.append("Skipped upstream: " + ", ".join(skipped_upstream))
        return (cleaned_text, model, clip, " | ".join(info_parts) or "LoRA 标签未产生变更")


class WebUIPromptBridgeNegativePrompt(_WebUIPromptBridgePromptBase):
    PROMPT_NAME = "negative_prompt"
    DEFAULT_PROMPT = "worst quality, low quality, blurry, bad anatomy, extra fingers"
    RETURN_NAMES = ("negative_text",)
    SEARCH_ALIASES = [
        "webui negative prompt",
        "negative prompt autocomplete",
        "负向提示词",
        "反向提示词",
        "提示词补全",
    ]


class WebUIPromptBridgeImageInput:
    CATEGORY = "conditioning/webui"
    SEARCH_ALIASES = ["webui img2img", "webui image input", "webui inpaint", "bridge image input", "图生图", "局部重绘"]
    FUNCTION = "load"
    RETURN_TYPES = ("IMAGE", "MASK", "FLOAT", "STRING", "STRING")
    RETURN_NAMES = ("image", "mask", "denoise", "mode", "status")

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("STRING", {"default": "", "multiline": False}),
                "mask": ("STRING", {"default": "", "multiline": False}),
                "mode": (["img2img", "inpaint"], {"default": "img2img"}),
                "denoise": ("FLOAT", {"default": 0.55, "min": 0.0, "max": 1.0, "step": 0.01}),
            },
        }

    def load(self, image, mask="", mode="img2img", denoise=0.55):
        if not image:
            raise ValueError("请先在 WebUI Bridge Image Input 节点内上传图片")
        pixels, alpha_mask = _load_bridge_image_tensor(image)
        mask_tensor = _load_bridge_mask_tensor(mask, pixels) if mask else alpha_mask
        if mode != "inpaint" and not mask:
            mask_tensor = _empty_mask_for_image(pixels)
        denoise_value = _bounded_float(denoise, 0.55, 0.0, 1.0)
        status = f"{mode} image loaded: {image}" + (f"; mask={mask}" if mask else "")
        return (pixels, mask_tensor, denoise_value, str(mode or "img2img"), status)

    @classmethod
    def IS_CHANGED(cls, image, mask="", mode="img2img", denoise=0.55):
        digest = hashlib.sha256()
        for name in (image, mask):
            if not name:
                continue
            path = _resolve_bridge_input_path(name)
            with open(path, "rb") as handle:
                for chunk in iter(lambda: handle.read(1024 * 1024), b""):
                    digest.update(chunk)
        digest.update(str(mode).encode("utf-8"))
        digest.update(str(denoise).encode("utf-8"))
        return digest.hexdigest()

    @classmethod
    def VALIDATE_INPUTS(cls, image, mask="", mode="img2img", denoise=0.55):
        if not image:
            return "Image is required"
        try:
            _resolve_bridge_input_path(image)
        except ValueError as exc:
            return str(exc)
        if mask:
            try:
                _resolve_bridge_input_path(mask)
            except ValueError as exc:
                return str(exc)
        return True


def _get_registered_node_class(class_name):
    try:
        import importlib

        comfy_nodes = importlib.import_module("nodes")
        mappings = getattr(comfy_nodes, "NODE_CLASS_MAPPINGS", {})
        node_class = mappings.get(class_name)
        if node_class is not None:
            return node_class
    except Exception:
        pass
    return None


def _adetailer_model_to_ultralytics_name(model_name):
    model_name = str(model_name or "").strip()
    if not model_name or model_name in {"custom", "mediapipe_face_full"}:
        return ""
    normalized = model_name.replace("\\", "/")
    if normalized.startswith(("bbox/", "segm/")):
        return normalized
    lowered = normalized.casefold()
    if "-seg" in lowered or lowered.startswith("person_") or lowered.startswith("segm_"):
        return f"segm/{normalized}"
    return f"bbox/{normalized}"


def _is_real_segm_detector(detector):
    if detector is None:
        return False
    name = detector.__class__.__name__.casefold()
    return "no_segm" not in name and "dummy" not in name


def _load_impact_ultralytics_detector(model_name):
    model_name = _adetailer_model_to_ultralytics_name(model_name)
    if not model_name:
        return None, None, "未指定可自动加载的 Ultralytics 模型"
    provider_class = _get_registered_node_class("UltralyticsDetectorProvider")
    if provider_class is None:
        raise ValueError("找不到 UltralyticsDetectorProvider。请确认 ComfyUI-Impact-Subpack 已安装并重启 ComfyUI。")
    bbox_detector, segm_detector = provider_class().doit(model_name)
    return bbox_detector, segm_detector, model_name


class _WebUIPromptBridgeModuleConfigBase:
    CATEGORY = "conditioning/webui/modules"
    SEARCH_ALIASES = ["webui bridge", "prompt bridge module", "webui module"]
    FUNCTION = "extract"
    RETURN_TYPES = ("STRING", "BOOLEAN")
    RETURN_NAMES = ("config_json", "enabled")
    MODULE_KEY = ""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "module_config": ("STRING", {"default": "", "multiline": True}),
            },
        }

    def extract(self, module_config):
        config, enabled = _read_module_config_section(module_config, self.MODULE_KEY)
        return (json.dumps(config, ensure_ascii=False, indent=2), enabled)


class WebUIPromptBridgeADetailerConfig(_WebUIPromptBridgeModuleConfigBase):
    MODULE_KEY = "adetailer"


class WebUIPromptBridgeControlNetConfig(_WebUIPromptBridgeModuleConfigBase):
    MODULE_KEY = "controlnet"


class WebUIPromptBridgeSAMInpaintConfig(_WebUIPromptBridgeModuleConfigBase):
    MODULE_KEY = "sam_inpaint"


class WebUIPromptBridgeUpscaleConfig(_WebUIPromptBridgeModuleConfigBase):
    MODULE_KEY = "upscale"


class WebUIPromptBridgeControlNetApply:
    CATEGORY = "conditioning/webui/modules"
    FUNCTION = "apply"
    RETURN_TYPES = ("CONDITIONING", "CONDITIONING", "STRING")
    RETURN_NAMES = ("positive", "negative", "status")

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "positive": ("CONDITIONING",),
                "negative": ("CONDITIONING",),
                "control_net": ("CONTROL_NET",),
                "image": ("IMAGE",),
                "module_config": ("STRING", {"default": "", "multiline": True}),
            },
            "optional": {
                "vae": ("VAE",),
            },
        }

    def apply(self, positive, negative, control_net, image, module_config, vae=None):
        config, enabled = _read_module_config_section(module_config, "controlnet")
        if not enabled:
            return (positive, negative, "ControlNet module disabled")
        strength = _bounded_float(config.get("weight"), 1.0, 0.0, 10.0)
        if strength == 0:
            return (positive, negative, "ControlNet weight is 0; conditioning unchanged")
        start = _bounded_float(config.get("start"), 0.0, 0.0, 1.0)
        end = _bounded_float(config.get("end"), 1.0, 0.0, 1.0)
        if end < start:
            start, end = end, start

        control_hint = image.movedim(-1, 1)
        cnets = {}
        out = []
        for conditioning in [positive, negative]:
            current = []
            for item in conditioning:
                metadata = item[1].copy()
                previous = metadata.get("control", None)
                if previous in cnets:
                    c_net = cnets[previous]
                else:
                    c_net = control_net.copy().set_cond_hint(control_hint, strength, (start, end), vae=vae)
                    c_net.set_previous_controlnet(previous)
                    cnets[previous] = c_net
                metadata["control"] = c_net
                metadata["control_apply_to_uncond"] = False
                current.append([item[0], metadata])
            out.append(current)
        status = (
            f"ControlNet applied: preprocessor={config.get('preprocessor', 'none')} "
            f"model={config.get('model') or 'connected'} weight={strength:g} range={start:g}-{end:g}"
        )
        return (out[0], out[1], status)


class WebUIPromptBridgeImageUpscale:
    CATEGORY = "conditioning/webui/modules"
    FUNCTION = "upscale"
    RETURN_TYPES = ("IMAGE", "STRING")
    RETURN_NAMES = ("image", "status")
    UPSCALE_METHODS = ["nearest-exact", "bilinear", "area", "bicubic", "lanczos"]

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "module_config": ("STRING", {"default": "", "multiline": True}),
                "fallback_method": (cls.UPSCALE_METHODS, {"default": "lanczos"}),
            },
        }

    def upscale(self, image, module_config, fallback_method="lanczos"):
        config, enabled = _read_module_config_section(module_config, "upscale")
        if not enabled:
            return (image, "Upscale module disabled")
        scale_by = _bounded_float(config.get("scale_by"), 2.0, 0.01, 8.0)
        method = str(config.get("upscaler") or fallback_method).strip().lower()
        method_aliases = {
            "latent": fallback_method,
            "none": fallback_method,
            "4x-ultrasharp": "lanczos",
            "realesrgan": "lanczos",
            "r-esrgan": "lanczos",
        }
        method = method_aliases.get(method, method)
        if method not in self.UPSCALE_METHODS:
            method = fallback_method if fallback_method in self.UPSCALE_METHODS else "lanczos"
        samples = image.movedim(-1, 1)
        width = max(1, round(samples.shape[3] * scale_by))
        height = max(1, round(samples.shape[2] * scale_by))
        scaled = comfy.utils.common_upscale(samples, width, height, method, "disabled").movedim(1, -1)
        return (scaled, f"Image upscaled by {scale_by:g} using {method}: {width}x{height}")


class WebUIPromptBridgeLatentUpscale:
    CATEGORY = "conditioning/webui/modules"
    FUNCTION = "upscale"
    RETURN_TYPES = ("LATENT", "STRING")
    RETURN_NAMES = ("latent", "status")
    UPSCALE_METHODS = ["nearest-exact", "bilinear", "area", "bicubic", "bislerp"]

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "samples": ("LATENT",),
                "module_config": ("STRING", {"default": "", "multiline": True}),
                "fallback_method": (cls.UPSCALE_METHODS, {"default": "bislerp"}),
            },
        }

    def upscale(self, samples, module_config, fallback_method="bislerp"):
        config, enabled = _read_module_config_section(module_config, "upscale")
        if not enabled:
            return (samples, "Upscale module disabled")
        scale_by = _bounded_float(config.get("scale_by"), 2.0, 0.01, 8.0)
        method = str(config.get("upscaler") or fallback_method).strip().lower()
        if method == "latent":
            method = fallback_method
        if method not in self.UPSCALE_METHODS:
            method = fallback_method if fallback_method in self.UPSCALE_METHODS else "bislerp"
        result = samples.copy()
        width = max(1, round(samples["samples"].shape[-1] * scale_by))
        height = max(1, round(samples["samples"].shape[-2] * scale_by))
        result["samples"] = comfy.utils.common_upscale(samples["samples"], width, height, method, "disabled")
        return (result, f"Latent upscaled by {scale_by:g} using {method}: {width * 8}x{height * 8}")


class WebUIPromptBridgeSetLatentMask:
    CATEGORY = "conditioning/webui/modules"
    FUNCTION = "set_mask"
    RETURN_TYPES = ("LATENT", "STRING")
    RETURN_NAMES = ("latent", "status")

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "samples": ("LATENT",),
                "mask": ("MASK",),
                "module_config": ("STRING", {"default": "", "multiline": True}),
            },
        }

    def set_mask(self, samples, mask, module_config):
        mask_config, mask_enabled = _read_module_config_section(module_config, "mask")
        sam_config, sam_enabled = _read_module_config_section(module_config, "sam_inpaint")
        if not mask_enabled and not sam_enabled:
            return (samples, "Mask and SAM/Inpaint modules disabled")
        result = samples.copy()
        result["noise_mask"] = mask.reshape((-1, 1, mask.shape[-2], mask.shape[-1]))
        source = "SAM/Inpaint" if sam_enabled else "Mask"
        denoise = sam_config.get("inpaint_denoise", "n/a") if sam_enabled else mask_config.get("strength", "n/a")
        return (result, f"{source} mask applied to latent; denoise/strength={denoise}")


class WebUIPromptBridgeADetailerConditioning:
    CATEGORY = "conditioning/webui/modules"
    FUNCTION = "encode"
    RETURN_TYPES = ("CONDITIONING", "CONDITIONING", "STRING")
    RETURN_NAMES = ("positive", "negative", "status")

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "clip": ("CLIP",),
                "positive": ("CONDITIONING",),
                "negative": ("CONDITIONING",),
                "module_config": ("STRING", {"default": "", "multiline": True}),
            },
        }

    def encode(self, clip, positive, negative, module_config):
        config, enabled = _read_module_config_section(module_config, "adetailer")
        if not enabled:
            return (positive, negative, "ADetailer module disabled")
        prompt = str(config.get("prompt") or "").strip()
        negative_prompt = str(config.get("negative_prompt") or "").strip()
        out_positive = positive
        out_negative = negative
        if prompt:
            out_positive = clip.encode_from_tokens_scheduled(clip.tokenize(prompt))
        if negative_prompt:
            out_negative = clip.encode_from_tokens_scheduled(clip.tokenize(negative_prompt))
        status = (
            f"ADetailer conditioning: model={config.get('model', 'auto')} "
            f"confidence={config.get('confidence', 0.3)} denoise={config.get('denoise', 0.4)}"
        )
        return (out_positive, out_negative, status)


class WebUIPromptBridgeADetailerApply:
    CATEGORY = "conditioning/webui/modules"
    FUNCTION = "apply"
    RETURN_TYPES = ("IMAGE", "MASK", "STRING")
    RETURN_NAMES = ("image", "mask", "status")

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "model": ("MODEL",),
                "clip": ("CLIP",),
                "vae": ("VAE",),
                "positive": ("CONDITIONING",),
                "negative": ("CONDITIONING",),
                "module_config": ("STRING", {"default": "", "multiline": True}),
                "guide_size": ("FLOAT", {"default": 512, "min": 64, "max": 16384, "step": 8}),
                "max_size": ("FLOAT", {"default": 1024, "min": 64, "max": 16384, "step": 8}),
                "seed": ("INT", {"default": 0, "min": 0, "max": 0xffffffffffffffff}),
                "steps": ("INT", {"default": 20, "min": 1, "max": 10000}),
                "cfg": ("FLOAT", {"default": 8.0, "min": 0.0, "max": 100.0, "step": 0.1}),
                "sampler_name": (comfy.samplers.KSampler.SAMPLERS, {"default": "euler"}),
                "scheduler": (comfy.samplers.KSampler.SCHEDULERS, {"default": "normal"}),
                "bbox_dilation": ("INT", {"default": 10, "min": -512, "max": 512, "step": 1}),
                "bbox_crop_factor": ("FLOAT", {"default": 3.0, "min": 1.0, "max": 100.0, "step": 0.1}),
                "drop_size": ("INT", {"default": 10, "min": 1, "max": 16384, "step": 1}),
                "noise_mask": ("BOOLEAN", {"default": True}),
                "force_inpaint": ("BOOLEAN", {"default": True}),
                "wildcard": ("STRING", {"default": "", "multiline": True}),
            },
            "optional": {
                "bbox_detector": ("BBOX_DETECTOR",),
                "segm_detector": ("SEGM_DETECTOR",),
                "sam_model": ("SAM_MODEL",),
                "detailer_hook": ("DETAILER_HOOK",),
            },
        }

    def apply(
        self,
        image,
        model,
        clip,
        vae,
        positive,
        negative,
        module_config,
        guide_size=512,
        max_size=1024,
        seed=0,
        steps=20,
        cfg=8.0,
        sampler_name="euler",
        scheduler="normal",
        bbox_dilation=10,
        bbox_crop_factor=3.0,
        drop_size=10,
        noise_mask=True,
        force_inpaint=True,
        wildcard="",
        bbox_detector=None,
        segm_detector=None,
        sam_model=None,
        detailer_hook=None,
    ):
        config, enabled = _read_module_config_section(module_config, "adetailer")
        if not enabled:
            return (image, _empty_mask_for_image(image), "ADetailer module disabled")

        face_detailer_class = _get_registered_node_class("FaceDetailer")
        if face_detailer_class is None:
            raise ValueError("找不到 Impact Pack 的 FaceDetailer。请确认 ComfyUI-Impact-Pack 已安装并重启 ComfyUI。")

        detector_source = "connected"
        if bbox_detector is None:
            bbox_detector, auto_segm_detector, detector_source = _load_impact_ultralytics_detector(config.get("model"))
            if segm_detector is None and str(detector_source).startswith("segm/") and _is_real_segm_detector(auto_segm_detector):
                segm_detector = auto_segm_detector

        threshold = _bounded_float(config.get("confidence"), 0.30, 0.0, 1.0)
        denoise = _bounded_float(config.get("denoise"), 0.40, 0.0001, 1.0)
        feather = _bounded_int(config.get("mask_blur"), 4, 0, 100)
        cycle = _bounded_int(config.get("cycles"), 1, 1, 10)
        wildcard_text = str(wildcard or "").strip()
        if not wildcard_text:
            prompt = str(config.get("prompt") or "").strip()
            negative_prompt = str(config.get("negative_prompt") or "").strip()
            parts = []
            if prompt:
                parts.append(prompt)
            if negative_prompt:
                parts.append(f"[NEGATIVE]{negative_prompt}")
            wildcard_text = "\n".join(parts)

        result = face_detailer_class().doit(
            image,
            model,
            clip,
            vae,
            _bounded_float(guide_size, 512, 64, 16384),
            True,
            _bounded_float(max_size, 1024, 64, 16384),
            _bounded_int(seed, 0, 0, 0xffffffffffffffff),
            _bounded_int(steps, 20, 1, 10000),
            _bounded_float(cfg, 8.0, 0.0, 100.0),
            sampler_name,
            scheduler,
            positive,
            negative,
            denoise,
            feather,
            bool(noise_mask),
            bool(force_inpaint),
            threshold,
            _bounded_int(bbox_dilation, 10, -512, 512),
            _bounded_float(bbox_crop_factor, 3.0, 1.0, 100.0),
            "center-1",
            0,
            0.93,
            0,
            0.7,
            "False",
            _bounded_int(drop_size, 10, 1, 16384),
            bbox_detector,
            wildcard_text,
            cycle=cycle,
            sam_model_opt=sam_model,
            segm_detector_opt=segm_detector if _is_real_segm_detector(segm_detector) else None,
            detailer_hook=detailer_hook,
            inpaint_model=bool(config.get("inpaint_only_masked", True)),
            noise_mask_feather=feather,
        )
        result_image = result[0]
        result_mask = result[3] if len(result) > 3 and result[3] is not None else _empty_mask_for_image(image)
        target = str(config.get("model") or "connected")
        status = (
            f"ADetailer applied: target={target} detector={detector_source} "
            f"threshold={threshold:g} denoise={denoise:g} feather={feather} cycles={cycle}"
        )
        return (result_image, result_mask, status)


class WebUIPromptBridgeInpaintConditioning:
    CATEGORY = "conditioning/webui/modules"
    FUNCTION = "encode"
    RETURN_TYPES = ("CONDITIONING", "CONDITIONING", "LATENT", "FLOAT", "STRING")
    RETURN_NAMES = ("positive", "negative", "latent", "denoise", "status")

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "positive": ("CONDITIONING",),
                "negative": ("CONDITIONING",),
                "vae": ("VAE",),
                "pixels": ("IMAGE",),
                "mask": ("MASK",),
                "module_config": ("STRING", {"default": "", "multiline": True}),
                "noise_mask": ("BOOLEAN", {"default": True}),
            },
        }

    def encode(self, positive, negative, vae, pixels, mask, module_config, noise_mask=True):
        sam_config, sam_enabled = _read_module_config_section(module_config, "sam_inpaint")
        adetailer_config, adetailer_enabled = _read_module_config_section(module_config, "adetailer")
        mask_config, mask_enabled = _read_module_config_section(module_config, "mask")
        if not sam_enabled and not adetailer_enabled and not mask_enabled:
            out_latent = {"samples": vae.encode(pixels)}
            return (positive, negative, out_latent, 1.0, "Inpaint-related modules disabled")

        x = (pixels.shape[1] // 8) * 8
        y = (pixels.shape[2] // 8) * 8
        resized_mask = torch.nn.functional.interpolate(
            mask.reshape((-1, 1, mask.shape[-2], mask.shape[-1])),
            size=(pixels.shape[1], pixels.shape[2]),
            mode="bilinear",
        )

        orig_pixels = pixels
        working_pixels = orig_pixels.clone()
        if working_pixels.shape[1] != x or working_pixels.shape[2] != y:
            x_offset = (working_pixels.shape[1] % 8) // 2
            y_offset = (working_pixels.shape[2] % 8) // 2
            working_pixels = working_pixels[:, x_offset:x + x_offset, y_offset:y + y_offset, :]
            resized_mask = resized_mask[:, :, x_offset:x + x_offset, y_offset:y + y_offset]

        masked_pixels = working_pixels.clone()
        mask_keep = (1.0 - resized_mask.round()).squeeze(1)
        for channel in range(3):
            masked_pixels[:, :, :, channel] -= 0.5
            masked_pixels[:, :, :, channel] *= mask_keep
            masked_pixels[:, :, :, channel] += 0.5

        concat_latent = vae.encode(masked_pixels)
        orig_latent = vae.encode(orig_pixels)
        out_latent = {"samples": orig_latent}
        if noise_mask:
            out_latent["noise_mask"] = resized_mask

        out_positive = _conditioning_set_values(positive, {
            "concat_latent_image": concat_latent,
            "concat_mask": resized_mask,
        })
        out_negative = _conditioning_set_values(negative, {
            "concat_latent_image": concat_latent,
            "concat_mask": resized_mask,
        })

        if sam_enabled:
            denoise = _bounded_float(sam_config.get("inpaint_denoise"), 0.45, 0.0, 1.0)
            source = "SAM/Inpaint"
        elif adetailer_enabled:
            denoise = _bounded_float(adetailer_config.get("denoise"), 0.40, 0.0, 1.0)
            source = "ADetailer"
        else:
            denoise = _bounded_float(mask_config.get("strength"), 1.0, 0.0, 1.0)
            source = "Mask"
        return (out_positive, out_negative, out_latent, denoise, f"{source} inpaint conditioning prepared; denoise={denoise:g}")


_BRIDGE_NODE_SEARCH_ALIASES = {
    "WebUIPromptBridgePositivePrompt": ["webui positive prompt", "positive prompt", "正向提示词"],
    "WebUIPromptBridgeNegativePrompt": ["webui negative prompt", "negative prompt", "负向提示词", "反向提示词"],
    "WebUIPromptBridgeImageInput": ["webui img2img", "image input", "inpaint image", "图生图", "局部重绘"],
    "WebUIPromptBridgeADetailerConfig": ["webui adetailer", "adetailer config", "face detailer", "hand detailer"],
    "WebUIPromptBridgeControlNetConfig": ["webui controlnet", "controlnet config", "control net"],
    "WebUIPromptBridgeSAMInpaintConfig": ["webui sam", "sam inpaint", "segment anything", "inpaint config"],
    "WebUIPromptBridgeUpscaleConfig": ["webui upscale", "hires fix", "ultimate upscale", "upscale config"],
    "WebUIPromptBridgeControlNetApply": ["webui apply controlnet", "apply controlnet", "control net apply"],
    "WebUIPromptBridgeImageUpscale": ["webui image upscale", "hires fix", "image upscale"],
    "WebUIPromptBridgeLatentUpscale": ["webui latent upscale", "latent hires fix", "latent upscale"],
    "WebUIPromptBridgeSetLatentMask": ["webui set latent mask", "latent mask", "mask region"],
    "WebUIPromptBridgeADetailerConditioning": ["webui adetailer conditioning", "adetailer conditioning", "detailer prompt"],
    "WebUIPromptBridgeADetailerApply": ["webui apply adetailer", "apply adetailer", "face detailer"],
    "WebUIPromptBridgeInpaintConditioning": ["webui inpaint conditioning", "inpaint conditioning", "mask inpaint"],
}


NODE_CLASS_MAPPINGS = {
    "WebUIPromptBridge": WebUIPromptBridge,
    "WebUIPromptBridgePositivePrompt": WebUIPromptBridgePositivePrompt,
    "WebUIPromptBridgeNegativePrompt": WebUIPromptBridgeNegativePrompt,
    "WebUIPromptBridgeImageInput": WebUIPromptBridgeImageInput,
    "WebUIPromptBridgeADetailerConfig": WebUIPromptBridgeADetailerConfig,
    "WebUIPromptBridgeControlNetConfig": WebUIPromptBridgeControlNetConfig,
    "WebUIPromptBridgeSAMInpaintConfig": WebUIPromptBridgeSAMInpaintConfig,
    "WebUIPromptBridgeUpscaleConfig": WebUIPromptBridgeUpscaleConfig,
    "WebUIPromptBridgeControlNetApply": WebUIPromptBridgeControlNetApply,
    "WebUIPromptBridgeImageUpscale": WebUIPromptBridgeImageUpscale,
    "WebUIPromptBridgeLatentUpscale": WebUIPromptBridgeLatentUpscale,
    "WebUIPromptBridgeSetLatentMask": WebUIPromptBridgeSetLatentMask,
    "WebUIPromptBridgeADetailerConditioning": WebUIPromptBridgeADetailerConditioning,
    "WebUIPromptBridgeADetailerApply": WebUIPromptBridgeADetailerApply,
    "WebUIPromptBridgeInpaintConditioning": WebUIPromptBridgeInpaintConditioning,
}

for _node_name, _aliases in _BRIDGE_NODE_SEARCH_ALIASES.items():
    _node_class = NODE_CLASS_MAPPINGS.get(_node_name)
    if _node_class is not None:
        base_aliases = list(getattr(_node_class, "SEARCH_ALIASES", []))
        _node_class.SEARCH_ALIASES = [*base_aliases, *_aliases, "webui", "prompt bridge"]

NODE_DISPLAY_NAME_MAPPINGS = {
    "WebUIPromptBridge": "WebUI Prompt Bridge",
    "WebUIPromptBridgePositivePrompt": "WebUI Bridge Positive Prompt",
    "WebUIPromptBridgeNegativePrompt": "WebUI Bridge Negative Prompt",
    "WebUIPromptBridgeImageInput": "WebUI Bridge Image Input",
    "WebUIPromptBridgeADetailerConfig": "WebUI Bridge ADetailer Config",
    "WebUIPromptBridgeControlNetConfig": "WebUI Bridge ControlNet Config",
    "WebUIPromptBridgeSAMInpaintConfig": "WebUI Bridge SAM/Inpaint Config",
    "WebUIPromptBridgeUpscaleConfig": "WebUI Bridge Upscale Config",
    "WebUIPromptBridgeControlNetApply": "WebUI Bridge Apply ControlNet",
    "WebUIPromptBridgeImageUpscale": "WebUI Bridge Image Upscale",
    "WebUIPromptBridgeLatentUpscale": "WebUI Bridge Latent Upscale",
    "WebUIPromptBridgeSetLatentMask": "WebUI Bridge Set Latent Mask",
    "WebUIPromptBridgeADetailerConditioning": "WebUI Bridge ADetailer Conditioning",
    "WebUIPromptBridgeADetailerApply": "WebUI Bridge Apply ADetailer",
    "WebUIPromptBridgeInpaintConditioning": "WebUI Bridge Inpaint Conditioning",
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
        return web.json_response({"error": "Untrusted host or cross-origin request"}, status=403)

    def protected_route(method, path):
        register = getattr(routes, method)

        def decorator(handler):
            @functools.wraps(handler)
            async def guarded(request):
                rejected = reject_cross_origin(request)
                if rejected is not None:
                    return rejected
                return await handler(request)

            return register(path)(guarded)

        return decorator

    blocking_io_semaphore = asyncio.Semaphore(2)
    asset_install_lock = asyncio.Lock()

    async def run_blocking(function, *args):
        async with blocking_io_semaphore:
            worker = asyncio.create_task(asyncio.to_thread(function, *args))
            try:
                return await asyncio.shield(worker)
            except asyncio.CancelledError:
                # A cancelled HTTP request does not stop its worker thread. Keep the
                # semaphore occupied until that work really finishes.
                try:
                    await worker
                except Exception:
                    pass
                raise

    async def run_blocking_with_commit(function, commit, *args):
        async with blocking_io_semaphore:
            worker = asyncio.create_task(asyncio.to_thread(function, *args))
            try:
                prepared = await asyncio.shield(worker)
            except asyncio.CancelledError:
                try:
                    prepared = await worker
                    commit(prepared)
                except Exception as exc:
                    print(f"[WebUI Prompt Bridge] Background install commit failed after request cancellation: {exc}")
                raise
            return commit(prepared)

    async def read_multipart_field_limited(field, limit):
        data = bytearray()
        while True:
            chunk = await field.read_chunk(size=64 * 1024)
            if not chunk:
                break
            if len(data) + len(chunk) > limit:
                raise ValueError("Image file is too large")
            data.extend(chunk)
        return bytes(data)

    @protected_route("post", "/webui_prompt_bridge/image_input_upload")
    async def image_input_upload(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        if request.content_length and request.content_length > MAX_IMAGE_UPLOAD_BYTES + 1024 * 1024:
            return web.json_response({"error": "Image file is too large"}, status=413)
        reader = await request.multipart()
        image_bytes = b""
        extension = ".png"
        kind = "image"
        image_field_seen = False
        field = await reader.next()
        while field:
            if field.name == "kind":
                try:
                    kind = _truncate_text((await read_multipart_field_limited(field, 128)).decode("utf-8", errors="replace").strip().lower(), 20)
                except ValueError:
                    return web.json_response({"error": "Invalid image input kind"}, status=400)
            elif field.name == "image":
                if image_field_seen:
                    return web.json_response({"error": "Only one image file is allowed"}, status=400)
                image_field_seen = True
                filename = field.filename or ""
                suffix = Path(filename).suffix.lower()
                if suffix in (".png", ".jpg", ".jpeg", ".webp"):
                    extension = suffix
                try:
                    image_bytes = await read_multipart_field_limited(field, MAX_IMAGE_UPLOAD_BYTES)
                except ValueError as exc:
                    return web.json_response({"error": str(exc)}, status=413)
            field = await reader.next()
        if kind not in {"image", "mask"}:
            return web.json_response({"error": "Invalid image input kind"}, status=400)
        if not image_bytes:
            return web.json_response({"error": "Image file is required"}, status=400)
        try:
            _validate_preview_image(image_bytes, extension)
        except ValueError as exc:
            return web.json_response({"error": str(exc)}, status=400)
        input_dir = Path(folder_paths.get_input_directory())
        target_dir = input_dir / "webui_prompt_bridge"
        target_dir.mkdir(parents=True, exist_ok=True)
        safe_name = f"{kind}_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}{extension}"
        target_path = target_dir / safe_name
        target_path.write_bytes(image_bytes)
        relative_name = f"webui_prompt_bridge/{safe_name}"
        return web.json_response({"name": relative_name, "kind": kind})

    @protected_route("post", "/webui_prompt_bridge/parse_image_metadata")
    async def parse_image_metadata(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        if request.content_length and request.content_length > MAX_IMAGE_UPLOAD_BYTES + 1024 * 1024:
            return web.json_response({"error": "Image file is too large"}, status=413)
        reader = await request.multipart()
        image_bytes = b""
        filename = ""
        image_field_seen = False
        field = await reader.next()
        while field:
            if field.name == "image":
                if image_field_seen:
                    return web.json_response({"error": "Only one image file is allowed"}, status=400)
                image_field_seen = True
                filename = field.filename or ""
                try:
                    image_bytes = await read_multipart_field_limited(field, MAX_IMAGE_UPLOAD_BYTES)
                except ValueError as exc:
                    return web.json_response({"error": str(exc)}, status=413)
            field = await reader.next()
        if not image_bytes:
            return web.json_response({"error": "Image file is required"}, status=400)
        try:
            parsed = await run_blocking(_parse_image_generation_metadata, image_bytes, filename)
        except _PromptMetadataNotFoundError as exc:
            return web.json_response({
                "error": str(exc),
                "source": None,
                "candidates": [],
                "warnings": [],
            }, status=422)
        except ValueError as exc:
            return web.json_response({"error": str(exc)}, status=400)
        return web.json_response(parsed)

    @protected_route("get", "/webui_prompt_bridge/settings")
    async def bridge_settings_get(request):
        return web.json_response(_settings_response())

    @protected_route("post", "/webui_prompt_bridge/settings")
    async def bridge_settings_post(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        try:
            data = await request.json()
        except Exception:
            data = {}
        return web.json_response(_update_bridge_settings(data))

    @protected_route("get", "/webui_prompt_bridge/ai_config")
    async def bridge_ai_config_get(request):
        return web.json_response(_ai_config_response())

    @protected_route("post", "/webui_prompt_bridge/ai_config")
    async def bridge_ai_config_post(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        try:
            data = await request.json()
        except Exception:
            data = {}
        return web.json_response(_update_ai_config(data))

    @protected_route("post", "/webui_prompt_bridge/ai_config/test")
    async def bridge_ai_config_test(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        try:
            data = await request.json()
        except Exception:
            data = {}
        try:
            result = await run_blocking(_test_ai_config, data.get("prompt") or "Generate a short Stable Diffusion prompt for a girl in a garden.")
            return web.json_response(result)
        except Exception as exc:
            return web.json_response({"success": False, "error": str(exc)}, status=400)

    @protected_route("post", "/webui_prompt_bridge/ai_config/models")
    async def bridge_ai_config_models(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        try:
            data = await request.json()
        except Exception:
            data = {}
        try:
            return web.json_response(await run_blocking(_list_ai_models, data))
        except Exception as exc:
            return web.json_response({"success": False, "error": str(exc)}, status=400)

    @protected_route("post", "/webui_prompt_bridge/import_tags")
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

    @protected_route("get", "/webui_prompt_bridge/custom_tags")
    async def bridge_custom_tags_get(request):
        return web.json_response(_custom_tag_response())

    @protected_route("post", "/webui_prompt_bridge/custom_tags")
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

    @protected_route("delete", "/webui_prompt_bridge/custom_tags")
    async def bridge_custom_tags_delete(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        try:
            clear_all = str(request.query.get("all", "")).strip().casefold() in {"1", "true", "yes", "on"}
            if clear_all:
                return web.json_response(_clear_custom_tags())
            index = int(request.query.get("index", "-1"))
            return web.json_response(_delete_custom_tag(index))
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)

    @protected_route("get", "/webui_prompt_bridge/prompt_market")
    async def bridge_prompt_market_get(request):
        return web.json_response(_prompt_market_sources_response())

    @protected_route("post", "/webui_prompt_bridge/prompt_market/import")
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
            source, items = await run_blocking(_load_prompt_market_items, source_id)
            return web.json_response(_commit_prompt_market_import(source_id, source, items))
        except Exception as exc:
            return web.json_response({"error": str(exc)}, status=400)

    @protected_route("post", "/webui_prompt_bridge/install_assets")
    async def bridge_install_assets(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        try:
            data = await request.json()
        except Exception:
            data = {}
        try:
            async with asset_install_lock:
                result = await run_blocking_with_commit(
                    _prepare_extension_asset_install,
                    _commit_extension_asset_install,
                    data,
                )
            return web.json_response(result, status=200 if result.get("ok") else 500)
        except Exception as exc:
            return web.json_response({
                "ok": False,
                "error": str(exc),
                **_settings_response(),
            }, status=400)

    @protected_route("get", "/webui_prompt_bridge/module_assets")
    async def bridge_module_assets_get(request):
        return web.json_response(_module_asset_status())

    @protected_route("post", "/webui_prompt_bridge/install_module_assets")
    async def bridge_install_module_assets(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        try:
            data = await request.json()
        except Exception:
            data = {}
        try:
            async with asset_install_lock:
                result = await run_blocking(_install_module_node_assets, data)
            status = 200 if result.get("ok") else (400 if not result.get("results") else 500)
            return web.json_response(result, status=status)
        except Exception as exc:
            return web.json_response({
                "ok": False,
                "error": str(exc),
                "module_assets": _module_asset_status(),
            }, status=400)

    @protected_route("get", "/webui_prompt_bridge/webui_integration")
    async def webui_integration_get(request):
        return web.json_response({
            **_webui_integration_status(),
            "assets": _bridge_asset_status(),
            "module_assets": _module_asset_status(),
            "guesses": _guess_webui_roots(),
        })

    @protected_route("post", "/webui_prompt_bridge/webui_integration")
    async def webui_integration_post(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        data = await request.json()
        root = _truncate_text(data.get("webui_root") or data.get("root") or "", MAX_WEBUI_ROOT_LENGTH)
        if data.get("auto_detect"):
            guesses = _guess_webui_roots(root, use_cache=False)
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
            root = config["webui_root"]
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
                "guesses": _guess_webui_roots(root),
            })
        except Exception as exc:
            return web.json_response({
                "ok": False,
                "error": str(exc),
                "guesses": _guess_webui_roots(root),
            }, status=400)

    @protected_route("get", "/webui_prompt_bridge/models")
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

    @protected_route("get", "/webui_prompt_bridge/loras")
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
            metadata_title = ""
            metadata_output_name = ""
            training_tags = []
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
                    metadata_title = raw_metadata.get("modelspec.title", "") if isinstance(raw_metadata, dict) else ""
                    metadata_output_name = raw_metadata.get("ss_output_name", "") if isinstance(raw_metadata, dict) else ""
                    training_tags = _lora_training_tags(raw_metadata, limit=18) if isinstance(raw_metadata, dict) else []
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
                "metadata_title": metadata_title,
                "metadata_output_name": metadata_output_name,
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
                "training_tags": training_tags,
                "search_terms": " ".join([
                    name,
                    stem,
                    folder or "",
                    base_name,
                    " ".join(metadata_aliases),
                    metadata_title,
                    metadata_output_name,
                    " ".join(str(tag.get("tag", "") if isinstance(tag, dict) else (tag[0] if isinstance(tag, (list, tuple)) and tag else tag)) for tag in training_tags),
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

    @protected_route("get", "/webui_prompt_bridge/lora_thumbnail")
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
            return web.Response(
                body=_EMPTY_THUMBNAIL_PNG,
                content_type="image/png",
                headers={"Cache-Control": "public, max-age=3600"},
            )
        return web.FileResponse(preview_path)

    @protected_route("get", "/webui_prompt_bridge/lora_info")
    async def lora_info(request):
        name = request.query.get("name", "")
        if not name:
            return web.json_response({"error": "LoRA name is required"}, status=400)
        return web.json_response(_lora_metadata_summary(name))

    @protected_route("get", "/webui_prompt_bridge/lora_user_metadata")
    async def lora_user_metadata_get(request):
        name = request.query.get("name", "")
        if not name:
            return web.json_response({"error": "LoRA name is required"}, status=400)
        detail_mode = str(request.query.get("detail", "full") or "full").casefold()
        if detail_mode in {"basic", "lite", "light"}:
            detail = _lora_basic_detail(name)
        else:
            detail = _lora_detail(name)
        if not detail.get("found"):
            return web.json_response(detail, status=404)
        return web.json_response(detail)

    @protected_route("post", "/webui_prompt_bridge/lora_user_metadata")
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

    @protected_route("post", "/webui_prompt_bridge/lora_preview")
    async def lora_preview_post(request):
        rejected = reject_cross_origin(request)
        if rejected is not None:
            return rejected
        if request.content_length and request.content_length > MAX_LORA_PREVIEW_BYTES + 1024 * 1024:
            return web.json_response({"error": "Preview image is too large"}, status=413)
        reader = await request.multipart()
        name = ""
        image_bytes = b""
        extension = ".png"
        preview_field_seen = False
        field = await reader.next()
        while field:
            if field.name == "name":
                try:
                    name = _truncate_text((await read_multipart_field_limited(field, 2048)).decode("utf-8", errors="replace").strip(), MAX_WEBUI_ROOT_LENGTH)
                except ValueError:
                    return web.json_response({"error": "LoRA name is too long"}, status=400)
            elif field.name == "preview":
                if preview_field_seen:
                    return web.json_response({"error": "Only one preview image is allowed"}, status=400)
                preview_field_seen = True
                filename = field.filename or ""
                suffix = Path(filename).suffix.lower()
                if suffix in (".png", ".jpg", ".jpeg", ".webp"):
                    extension = suffix
                try:
                    image_bytes = await read_multipart_field_limited(field, MAX_LORA_PREVIEW_BYTES)
                except ValueError:
                    return web.json_response({"error": "Preview image is too large"}, status=413)
            field = await reader.next()
        resolved = _resolve_lora_name(name)
        if not resolved:
            return web.json_response({"error": "LoRA not found"}, status=404)
        if not image_bytes:
            return web.json_response({"error": "Preview image is required"}, status=400)
        try:
            _validate_preview_image(image_bytes, extension)
        except ValueError as exc:
            return web.json_response({"error": str(exc)}, status=400)
        lora_path = folder_paths.get_full_path("loras", resolved)
        base = Path(lora_path).with_suffix("")
        preview_path = Path(str(base) + f".preview{extension}")
        preview_path.write_bytes(image_bytes)
        return web.json_response(_lora_detail(resolved))

    @protected_route("get", "/webui_prompt_bridge/autocomplete")
    async def autocomplete(request):
        query = request.query.get("q", "")
        try:
            limit = int(request.query.get("limit", "12"))
        except ValueError:
            limit = 12
        return web.json_response({"items": _autocomplete_prompt_tags(query, limit)})

    @protected_route("get", "/webui_prompt_bridge/prompt_all_in_one")
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

    @protected_route("post", "/webui_prompt_bridge/prompt_all_in_one/translate")
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
        translated = await run_blocking(_translate_prompt_all_in_one_text, text, to, lang)
        prompt = ", ".join(item["prompt"] for item in translated if item["prompt"] != "\n")
        return web.json_response({
            "tags": translated,
            "prompt": prompt,
            "matched": sum(1 for item in translated if item.get("matched")),
        })

    @protected_route("get", "/webui_prompt_bridge/prompt_all_in_one/storage")
    async def prompt_all_in_one_storage_get(request):
        kind = request.query.get("kind", "positive")
        collection = request.query.get("collection", "history")
        if collection not in ("history", "favorite"):
            return web.json_response({"error": "Unknown collection"}, status=400)
        return web.json_response({"items": _get_prompt_all_in_one_items(collection, kind)})

    @protected_route("post", "/webui_prompt_bridge/prompt_all_in_one/storage")
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

    @protected_route("get", "/webui_prompt_bridge/styles")
    async def list_styles(request):
        return web.json_response({"styles": _load_webui_styles()})

    @protected_route("post", "/webui_prompt_bridge/styles")
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

    @protected_route("post", "/webui_prompt_bridge/parse_infotext")
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
