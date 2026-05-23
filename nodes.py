import csv
import json
import os
import re
import sys
import time
import uuid
from pathlib import Path
from urllib.parse import unquote

import comfy.sd
import comfy.utils
import folder_paths
import yaml


NODE_DIR = Path(__file__).resolve().parent
DATA_DIR = NODE_DIR / "data"
LOCAL_CONFIG_PATH = NODE_DIR / "config.local.json"
PROMPT_ALL_IN_ONE_HISTORY_MAX = 100
_TAG_AUTOCOMPLETE_CACHE = None
_LORA_METADATA_CACHE = {}
_TRANSLATION_MAP_CACHE = {}
_NETWORK_TRANSLATE_CACHE = {}


def _load_local_config():
    try:
        if LOCAL_CONFIG_PATH.exists():
            data = json.loads(LOCAL_CONFIG_PATH.read_text(encoding="utf-8"))
            return data if isinstance(data, dict) else {}
    except Exception:
        pass
    return {}


LOCAL_CONFIG = _load_local_config()


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
            return prompt_dir.parents[1]
        except IndexError:
            return None
    tag_dir = _configured_path("tagcomplete_dir", "WEBUI_PROMPT_BRIDGE_TAGCOMPLETE_DIR")
    if tag_dir:
        try:
            return tag_dir.parents[1]
        except IndexError:
            return None
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


def _load_prompt_all_in_one_group_tags(lang="zh_CN"):
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
    normalized = []
    for group_index, group in enumerate(data):
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
                "tabKey": f"groupTags-{group_index}-{sub_index}",
                "tags": tags,
            })
        normalized.append({
            "name": group_name,
            "tabKey": f"groupTags-{group_index}",
            "type": group.get("type") or "tags",
            "groups": groups,
        })
    return normalized


def _load_tag_autocomplete_items():
    global _TAG_AUTOCOMPLETE_CACHE
    if _TAG_AUTOCOMPLETE_CACHE is not None:
        return _TAG_AUTOCOMPLETE_CACHE

    zh_map = {}
    zh_file = TAGCOMPLETE_DIR / "tags" / "danbooru.zh_CN_SFW.csv"
    try:
        with zh_file.open("r", encoding="utf-8-sig", newline="") as f:
            for row in csv.reader(f):
                if len(row) >= 2 and row[0].strip():
                    zh_map[row[0].strip().casefold()] = row[1].strip()
    except Exception:
        pass

    items = []
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
                items.append({
                    "text": tag,
                    "local": zh_map.get(tag.casefold(), ""),
                    "count": count,
                    "aliases": aliases[:12],
                    "type": "tag",
                })
    except Exception:
        pass

    # Prompt All-in-One grouped tags should also participate even if they are
    # absent from tagcomplete's frequency database.
    seen = {item["text"].casefold() for item in items}
    for group in _load_prompt_all_in_one_group_tags("zh_CN"):
        for sub_group in group.get("groups", []):
            for tag in sub_group.get("tags", []):
                prompt = str(tag.get("prompt") or "").strip()
                if not prompt or prompt.casefold() in seen:
                    continue
                seen.add(prompt.casefold())
                items.append({
                    "text": prompt,
                    "local": str(tag.get("local") or ""),
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
        "path": lora_path,
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


def _load_prompt_all_in_one_favorites(kind):
    data = _storage_get(_storage_key("favorite", kind), [])
    items = []
    for item in data if isinstance(data, list) else []:
        if not isinstance(item, dict):
            continue
        tags = []
        for tag in item.get("tags") or []:
            if not isinstance(tag, dict) or tag.get("disabled"):
                continue
            value = tag.get("value")
            if value:
                tags.append({"prompt": str(value), "local": str(tag.get("localValue") or "")})
        prompt = item.get("prompt") or ", ".join(tag["prompt"] for tag in tags)
        if prompt:
            items.append({
                "id": item.get("id") or "",
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
    api_data = _load_webui_translate_apis()
    api_key = _storage_get("translateApi", api_data.get("default") or "alibaba_free")
    if not api_key:
        api_key = "alibaba_free"
    cache_key = (api_key, from_lang, to_lang, text)
    if cache_key in _NETWORK_TRANSLATE_CACHE:
        return _NETWORK_TRANSLATE_CACHE[cache_key]

    added_paths = []
    import_paths = [PROMPT_ALL_IN_ONE_DIR]
    if WEBUI_PYTHON_SITE_PACKAGES:
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
    next_items = []
    removed = False
    for item in items:
        if not isinstance(item, dict):
            next_items.append(item)
            continue
        item_prompt = str(item.get("prompt") or "").strip()
        if (item_id and str(item.get("id") or "") == item_id) or (prompt and item_prompt == prompt):
            removed = True
            continue
        next_items.append(item)
    if removed:
        _storage_set(key, next_items)
    return removed


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
    zh_file = TAGCOMPLETE_DIR / "tags" / "danbooru.zh_CN_SFW.csv"
    try:
        with zh_file.open("r", encoding="utf-8-sig", newline="") as f:
            for row in csv.reader(f):
                if len(row) >= 2:
                    add_pair(row[0], row[1])
    except Exception:
        pass

    # Also use the main autocomplete CSV aliases so shorthand/alternate English
    # spellings normalize to the canonical Danbooru tag.
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
    text = str(text or "").strip()
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
                local = _webui_network_translate(item, "en_US", lang)
                source = "network" if local else "local"
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
            if not exact_or_alias and re.search(r"[\u3400-\u9fff]", item):
                network_prompt = _normalize_network_prompt(_webui_network_translate(item, lang, "en_US")) or None
                if network_prompt:
                    prompt = network_prompt
                    network_used = True
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
                "source": "network" if network_used else "local",
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
    for name in available:
        candidates.setdefault(_lora_key(name), name)
        candidates.setdefault(_lora_key(name.replace("/", "\\")), name)

    key = _lora_key(requested)
    if key in candidates:
        return candidates[key]

    with_ext = requested if requested.casefold().endswith(".safetensors") else f"{requested}.safetensors"
    return candidates.get(_lora_key(with_ext))


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
            }
        }

    def _load_lora(self, lora_name):
        lora_path = folder_paths.get_full_path_or_raise("loras", lora_name)
        cached = self.loaded_loras.get(lora_path)
        if cached is None:
            cached = comfy.utils.load_torch_file(lora_path, safe_load=True)
            self.loaded_loras[lora_path] = cached
        return cached

    def build(self, model, clip, positive_prompt, negative_prompt, default_clip_strength, fail_on_missing_lora):
        positive_text, positive_loras = _parse_lora_tags(positive_prompt)
        negative_text, negative_loras = _parse_lora_tags(negative_prompt)

        applied = []
        missing = []
        for requested, strength_model, strength_clip in [*positive_loras, *negative_loras]:
            resolved = _resolve_lora_name(requested)
            if resolved is None:
                missing.append(requested)
                continue

            if strength_clip is None:
                strength_clip = default_clip_strength

            if strength_model == 0 and strength_clip == 0:
                continue

            lora = self._load_lora(resolved)
            model, clip = comfy.sd.load_lora_for_models(model, clip, lora, strength_model, strength_clip)
            applied.append(f"{resolved}:model={strength_model:g}:clip={strength_clip:g}")

        if missing and fail_on_missing_lora:
            raise ValueError("Missing LoRA(s): " + ", ".join(missing))

        positive = clip.encode_from_tokens_scheduled(clip.tokenize(positive_text))
        negative = clip.encode_from_tokens_scheduled(clip.tokenize(negative_text))
        info = "Applied LoRAs: " + (", ".join(applied) if applied else "None")
        if missing:
            info += " | Missing LoRAs: " + ", ".join(missing)

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

    @routes.get("/webui_prompt_bridge/loras")
    async def list_loras(request):
        try:
            loras = folder_paths.get_filename_list("loras")
        except Exception:
            loras = []
        items = []
        for name in loras:
            stem = _strip_extension(name).replace("\\", "/")
            items.append({
                "name": name,
                "alias": stem,
                "prompt": f"<lora:{stem}:1>",
            })
        return web.json_response({"loras": items})

    @routes.get("/webui_prompt_bridge/lora_info")
    async def lora_info(request):
        name = request.query.get("name", "")
        if not name:
            return web.json_response({"error": "LoRA name is required"}, status=400)
        return web.json_response(_lora_metadata_summary(name))

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
        try:
            data = await request.json()
        except Exception:
            data = {}
        text = data.get("text", "")
        lang = data.get("lang", "zh_CN")
        to = data.get("to", "english")
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
        try:
            data = await request.json()
        except Exception:
            data = {}
        action = data.get("action")
        kind = data.get("kind", "positive")
        lang = data.get("lang", "zh_CN")
        prompt = data.get("prompt", "")
        name = data.get("name", "")
        item_id = data.get("id", "")

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
        try:
            data = await request.json()
        except Exception:
            data = {}
        action = data.get("action")
        name = (data.get("name") or "").strip()
        if not name:
            return web.json_response({"error": "Style name is required"}, status=400)

        styles = _load_webui_styles()
        if action == "delete":
            styles = [style for style in styles if style.get("name") != name]
        elif action == "save":
            replacement = {
                "name": name,
                "prompt": data.get("prompt", ""),
                "negative_prompt": data.get("negative_prompt", ""),
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
        try:
            data = await request.json()
        except Exception:
            data = {}
        parsed = _parse_generation_parameters(data.get("text", ""))
        return web.json_response({"parameters": parsed})


_register_routes()
