import importlib.util
import io
import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest import mock

from PIL import Image, PngImagePlugin


REPO_ROOT = Path(__file__).resolve().parents[1]
COMFY_ROOT = REPO_ROOT.parents[1]
if str(COMFY_ROOT) not in sys.path:
    sys.path.insert(0, str(COMFY_ROOT))


def _install_ci_runtime_stubs():
    """Provide the tiny ComfyUI surface used by these unit tests.

    A normal custom-node checkout imports the real ComfyUI and torch modules.
    GitHub Actions checks out this repository on its own, so the focused tests
    use lightweight fallbacks instead of downloading a full GPU runtime.
    """
    try:
        import comfy.sd  # noqa: F401
    except ModuleNotFoundError as error:
        if not error.name or not (error.name == "comfy" or error.name.startswith("comfy.")):
            raise
        comfy_module = types.ModuleType("comfy")
        comfy_module.__path__ = []
        sd_module = types.ModuleType("comfy.sd")
        sd_module.load_lora_for_models = lambda model, clip, _lora, _model_strength, _clip_strength: (model, clip)
        samplers_module = types.ModuleType("comfy.samplers")
        samplers_module.KSampler = types.SimpleNamespace(SAMPLERS=("euler",), SCHEDULERS=("normal",))
        utils_module = types.ModuleType("comfy.utils")
        utils_module.load_torch_file = lambda *_args, **_kwargs: {}
        model_management_module = types.ModuleType("comfy.model_management")
        model_management_module.intermediate_dtype = lambda: None
        model_management_module.intermediate_device = lambda: None
        comfy_module.sd = sd_module
        comfy_module.samplers = samplers_module
        comfy_module.utils = utils_module
        comfy_module.model_management = model_management_module
        sys.modules.update({
            "comfy": comfy_module,
            "comfy.sd": sd_module,
            "comfy.samplers": samplers_module,
            "comfy.utils": utils_module,
            "comfy.model_management": model_management_module,
        })

    try:
        import folder_paths  # noqa: F401
    except ModuleNotFoundError as error:
        if error.name != "folder_paths":
            raise
        folder_paths_module = types.ModuleType("folder_paths")
        folder_paths_module.models_dir = Path(tempfile.gettempdir())
        folder_paths_module.filename_list_cache = {}
        folder_paths_module.add_model_folder_path = lambda *_args, **_kwargs: None
        folder_paths_module.get_filename_list = lambda _kind: []
        folder_paths_module.get_full_path = lambda *_args, **_kwargs: None
        folder_paths_module.get_full_path_or_raise = lambda *_args, **_kwargs: ""
        folder_paths_module.get_input_directory = tempfile.gettempdir
        sys.modules["folder_paths"] = folder_paths_module

    try:
        import torch  # noqa: F401
    except ModuleNotFoundError as error:
        if error.name != "torch":
            raise
        torch_module = types.ModuleType("torch")
        torch_module.nn = types.SimpleNamespace(functional=types.SimpleNamespace())
        sys.modules["torch"] = torch_module


_install_ci_runtime_stubs()

SPEC = importlib.util.spec_from_file_location("webui_prompt_bridge_nodes_test", REPO_ROOT / "nodes.py")
NODES = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(NODES)


class PromptLibraryTests(unittest.TestCase):
    @staticmethod
    def _png_bytes(metadata=None):
        output = io.BytesIO()
        pnginfo = PngImagePlugin.PngInfo()
        for key, value in (metadata or {}).items():
            pnginfo.add_text(key, value if isinstance(value, str) else json.dumps(value, ensure_ascii=False))
        Image.new("RGB", (8, 8), (20, 30, 40)).save(output, format="PNG", pnginfo=pnginfo)
        return output.getvalue()

    def test_image_metadata_reads_main_bridge_prompt_and_preserves_empty_negative(self):
        image_bytes = self._png_bytes({
            "prompt": {
                "12": {
                    "class_type": "WebUIPromptBridge",
                    "inputs": {
                        "positive_prompt": "masterpiece, 1girl",
                        "negative_prompt": "",
                    },
                },
            },
            "workflow": {
                "nodes": [{"id": 12, "type": "WebUIPromptBridge", "title": "My Bridge"}],
            },
        })

        with mock.patch.object(Path, "write_bytes") as write_bytes:
            result = NODES._parse_image_generation_metadata(image_bytes, "result.png")

        self.assertEqual(result["source"], "comfy_prompt")
        self.assertEqual(result["candidates"], [{
            "node_id": "12",
            "label": "My Bridge",
            "positive_prompt": "masterpiece, 1girl",
            "negative_prompt": "",
        }])
        write_bytes.assert_not_called()

    def test_image_metadata_pairs_prompt_only_nodes_and_deduplicates_candidates(self):
        image_bytes = self._png_bytes({
            "prompt": {
                "1": {
                    "class_type": "WebUIPromptBridge",
                    "inputs": {"positive_prompt": "solo", "negative_prompt": "blurry"},
                },
                "2": {
                    "class_type": "WebUIPromptBridgePositivePrompt",
                    "inputs": {"positive_prompt": "solo"},
                },
                "3": {
                    "class_type": "WebUIPromptBridgeNegativePrompt",
                    "inputs": {"negative_prompt": "blurry"},
                },
            },
        })

        result = NODES._parse_image_generation_metadata(image_bytes, "result.png")

        self.assertEqual(len(result["candidates"]), 1)
        self.assertEqual(result["candidates"][0]["positive_prompt"], "solo")
        self.assertEqual(result["candidates"][0]["negative_prompt"], "blurry")
        self.assertTrue(any("duplicate" in warning.lower() for warning in result["warnings"]))

    def test_image_metadata_keeps_multiple_distinct_bridge_candidates(self):
        image_bytes = self._png_bytes({
            "prompt": {
                "10": {
                    "class_type": "WebUIPromptBridge",
                    "_meta": {"title": "First"},
                    "inputs": {"positive_prompt": "first", "negative_prompt": "bad first"},
                },
                "20": {
                    "class_type": "WebUIPromptBridge",
                    "_meta": {"title": "Second"},
                    "inputs": {"positive_prompt": "second", "negative_prompt": "bad second"},
                },
            },
        })

        result = NODES._parse_image_generation_metadata(image_bytes, "result.png")

        self.assertEqual([item["label"] for item in result["candidates"]], ["First", "Second"])

    def test_image_metadata_falls_back_to_a1111_parameters(self):
        image_bytes = self._png_bytes({
            "prompt": "{broken-json",
            "parameters": "best quality, 1girl\nNegative prompt: blurry, bad hands\nSteps: 20, Sampler: Euler, CFG scale: 7",
        })

        result = NODES._parse_image_generation_metadata(image_bytes, "result.png")

        self.assertEqual(result["source"], "a1111_parameters")
        self.assertEqual(result["candidates"][0]["positive_prompt"], "best quality, 1girl")
        self.assertEqual(result["candidates"][0]["negative_prompt"], "blurry, bad hands")
        self.assertTrue(result["warnings"])

    def test_image_metadata_rejects_missing_invalid_and_oversized_images(self):
        empty_metadata = self._png_bytes()
        with self.assertRaises(NODES._PromptMetadataNotFoundError):
            NODES._parse_image_generation_metadata(empty_metadata, "empty.png")
        with self.assertRaises(ValueError):
            NODES._parse_image_generation_metadata(b"not an image", "bad.png")
        with mock.patch.object(NODES, "MAX_IMAGE_UPLOAD_BYTES", 4):
            with self.assertRaisesRegex(ValueError, "too large"):
                NODES._parse_image_generation_metadata(b"12345", "large.png")

    def test_model_group_status_deduplicates_paths_and_ignores_incomplete_assets(self):
        listed = {
            "ultralytics": [
                "bbox\\face_yolov8m.pt",
                "bbox/face_yolov8m.pt",
                "BBOX/FACE_YOLOV8M.PT",
                "segm/person.pt.corrupted",
                "segm/downloading.pt.part",
                "put_models_here.txt",
            ],
            "bbox": ["bbox/hand_yolov8s.pt"],
            "segm": ["segm/person_yolov8m-seg.pt"],
        }
        with tempfile.TemporaryDirectory() as temp_dir, mock.patch.object(
            NODES,
            "_safe_model_list",
            side_effect=lambda kind: listed.get(kind, []),
        ), mock.patch.object(
            NODES.folder_paths,
            "models_dir",
            Path(temp_dir),
        ):
            status = NODES._model_group_status("ultralytics", aliases=("bbox", "segm"))

        self.assertEqual(status["count"], 3)
        self.assertEqual(
            status["items"],
            [
                "bbox/face_yolov8m.pt",
                "bbox/hand_yolov8s.pt",
                "segm/person_yolov8m-seg.pt",
            ],
        )

    def test_module_asset_readiness_distinguishes_blocked_partial_and_audit_modules(self):
        package_state = {
            "ComfyUI Impact Pack": True,
            "ComfyUI Impact Subpack": True,
            "ControlNet Auxiliary Preprocessors": True,
            "Segment Anything / SAM": True,
            "Ultimate SD Upscale": True,
        }
        model_counts = {
            "controlnet": 0,
            "upscale_models": 2,
            "sams": 1,
            "ultralytics": 0,
        }

        def package_status(name, _patterns):
            return {"name": name, "installed": package_state[name], "paths": []}

        def model_status(kind, aliases=()):
            return {
                "kind": kind,
                "aliases": list(aliases),
                "count": model_counts[kind],
                "items": [],
                "truncated": False,
            }

        with mock.patch.object(
            NODES,
            "_custom_node_dir_status",
            side_effect=package_status,
        ), mock.patch.object(
            NODES,
            "_model_group_status",
            side_effect=model_status,
        ):
            readiness = NODES._module_asset_status()["readiness"]

        self.assertEqual(readiness["controlnet"]["level"], "blocked")
        self.assertIn("不能代替 ControlNet 模型", readiness["controlnet"]["detail"])
        self.assertEqual(readiness["adetailer"]["level"], "blocked")
        self.assertEqual(readiness["sam"]["level"], "partial")
        self.assertIn("只负责 Mask/Inpaint 接入", readiness["sam"]["detail"])
        self.assertEqual(readiness["regional_lora"]["level"], "audit")
        self.assertIn("只统计", readiness["regional_lora"]["detail"])

    def test_bundled_autocomplete_works_offline_on_a_clean_install(self):
        bundled_dir = REPO_ROOT / "data" / "a1111-sd-webui-tagcomplete"
        tag_file = bundled_dir / "tags" / "danbooru.csv"
        translation_file = bundled_dir / "tags" / "Tags-zh-full-pack.csv"
        self.assertTrue(tag_file.is_file(), "release package must include danbooru.csv")
        self.assertTrue(translation_file.is_file(), "release package must include the Chinese tag map")
        self.assertGreater(tag_file.stat().st_size, 3_000_000)
        self.assertGreater(translation_file.stat().st_size, 250_000)

        for data_source in ("auto", "builtin"):
            with self.subTest(data_source=data_source), mock.patch.object(
                NODES,
                "LOCAL_CONFIG",
                {"settings": {"data_source": data_source, "tag_translation_source": "local"}},
            ), mock.patch.object(
                NODES,
                "TAGCOMPLETE_DIR",
                REPO_ROOT / "missing-webui-tagcomplete",
            ), mock.patch.object(
                NODES,
                "BUNDLED_TAGCOMPLETE_DIR",
                bundled_dir,
            ), mock.patch.object(
                NODES,
                "TAG_TRANSLATION_CACHE_FILE",
                translation_file,
            ), mock.patch.object(
                NODES,
                "_TAG_AUTOCOMPLETE_CACHE",
                None,
            ), mock.patch.object(
                NODES,
                "_TAG_TRANSLATION_MAP_CACHE",
                None,
            ), mock.patch.object(
                NODES.urllib.request,
                "urlopen",
                side_effect=AssertionError("bundled autocomplete must not use the network"),
            ):
                suggestions = NODES._autocomplete_prompt_tags("s", limit=6)
                status = NODES._prompt_library_status()

            self.assertEqual(
                [item["text"] for item in suggestions],
                ["solo", "smile", "short_hair", "simple_background", "shirt", "skirt"],
            )
            self.assertEqual(suggestions[0]["local"], "单人")
            self.assertEqual(suggestions[0]["count"], 5_000_954)
            self.assertEqual(status["autocomplete"]["source"], "bundled")
            self.assertTrue(status["autocomplete"]["ready"])

    def test_prompt_only_nodes_are_registered_and_return_text(self):
        positive_class = NODES.NODE_CLASS_MAPPINGS["WebUIPromptBridgePositivePrompt"]
        positive_inputs = positive_class.INPUT_TYPES()
        self.assertEqual(list(positive_inputs["required"]), ["positive_prompt"])
        self.assertEqual(list(positive_inputs["optional"]), ["model", "clip"])
        self.assertEqual(positive_class.RETURN_TYPES, ("STRING", "MODEL", "CLIP", "STRING"))
        self.assertEqual(positive_class.RETURN_NAMES, ("positive_text", "model", "clip", "lora_info"))
        self.assertEqual(
            positive_class().output(positive_prompt="tag_a, tag_b"),
            ("tag_a, tag_b", None, None, "未检测到 LoRA 标签"),
        )
        self.assertEqual(
            positive_class().output(positive_prompt="tag_a,\ntag_b"),
            ("tag_a,\ntag_b", None, None, "未检测到 LoRA 标签"),
        )

        negative_class = NODES.NODE_CLASS_MAPPINGS["WebUIPromptBridgeNegativePrompt"]
        negative_inputs = negative_class.INPUT_TYPES()["required"]
        self.assertEqual(list(negative_inputs), ["negative_prompt"])
        self.assertTrue(negative_inputs["negative_prompt"][1]["multiline"])
        self.assertEqual(negative_class.RETURN_TYPES, ("STRING",))
        self.assertEqual(negative_class.RETURN_NAMES, ("negative_text",))
        self.assertEqual(negative_class().output(negative_prompt="tag_a, tag_b"), ("tag_a, tag_b",))
        self.assertEqual(negative_class().output(negative_prompt="tag_a,\ntag_b"), ("tag_a,\ntag_b",))

    def test_favorites_are_not_capped_and_can_be_deleted_by_id(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            storage_path = Path(temp_dir) / "favorite.txt2img.json"
            items = [
                {
                    "id": f"favorite-{index}",
                    "name": f"Favorite {index}",
                    "prompt": f"tag_{index}",
                    "tags": [{"value": f"tag_{index}", "disabled": False}],
                }
                for index in range(300)
            ]
            storage_path.write_text(json.dumps(items), encoding="utf-8")

            with mock.patch.object(NODES, "_storage_path", return_value=storage_path):
                favorites = NODES._load_prompt_all_in_one_favorites("positive")
                removed = NODES._delete_prompt_all_in_one_item(
                    "favorite",
                    "positive",
                    item_id="favorite-280",
                )
                remaining = NODES._load_prompt_all_in_one_favorites("positive")

        self.assertEqual(len(favorites), 300)
        self.assertTrue(removed)
        self.assertEqual(len(remaining), 299)
        self.assertNotIn("favorite-280", {item["id"] for item in remaining})

    def test_positive_prompt_node_applies_lora_to_connected_model_and_clip(self):
        node = NODES.WebUIPromptBridgePositivePrompt()
        with (
            mock.patch.object(NODES, "_resolve_lora_name", return_value="folder/example.safetensors"),
            mock.patch.object(node, "_load_lora", return_value="loaded_lora"),
            mock.patch.object(NODES.comfy.sd, "load_lora_for_models", return_value=("patched_model", "patched_clip")) as apply_lora,
        ):
            result = node.output(
                positive_prompt="masterpiece, <lora:example:0.75>",
                model="base_model",
                clip="base_clip",
                prompt={},
                unique_id="42",
            )
        self.assertEqual(result[:3], ("masterpiece", "patched_model", "patched_clip"))
        self.assertIn("folder/example.safetensors:model=0.75:clip=1", result[3])
        apply_lora.assert_called_once_with("base_model", "base_clip", "loaded_lora", 0.75, 1.0)

    def test_zoom_summary_threshold_is_normalized_and_persisted(self):
        with mock.patch.object(
            NODES,
            "LOCAL_CONFIG",
            {"settings": {"zoom_summary_threshold": 0.68}},
        ), mock.patch.object(NODES, "_write_local_config") as write_config, mock.patch.object(
            NODES,
            "_apply_local_config",
        ), mock.patch.object(NODES, "_settings_response", return_value={"success": True}):
            current = NODES._bridge_settings()
            NODES._update_bridge_settings({"zoom_summary_threshold": 0.35})

        saved = write_config.call_args.args[0]
        self.assertEqual(current["zoom_summary_threshold"], 0.68)
        self.assertEqual(saved["settings"]["zoom_summary_threshold"], 0.35)
        self.assertEqual(NODES._normalize_zoom_summary_threshold(-2), 0.0)
        self.assertEqual(NODES._normalize_zoom_summary_threshold(4), 1.0)
        self.assertEqual(NODES._normalize_zoom_summary_threshold("invalid", 0.5), 0.5)

    def test_missing_webui_extensions_fall_back_to_local_full_data(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            data_dir = root / "data"
            webui_root = root / "webui"
            local_prompt = data_dir / "sd-webui-prompt-all-in-one"
            local_tags = data_dir / "a1111-sd-webui-tagcomplete"
            (local_prompt / "group_tags").mkdir(parents=True)
            (local_prompt / "group_tags" / "zh_CN.yaml").write_text("[]", encoding="utf-8")
            (local_tags / "tags").mkdir(parents=True)
            (local_tags / "tags" / "danbooru.csv").write_text("smile,0,1,\n", encoding="utf-8")
            (webui_root / "extensions").mkdir(parents=True)
            config = {
                "prompt_all_in_one_dir": str(webui_root / "extensions" / "sd-webui-prompt-all-in-one"),
                "tagcomplete_dir": str(webui_root / "extensions" / "a1111-sd-webui-tagcomplete"),
            }
            env = {
                "WEBUI_PROMPT_BRIDGE_PROMPT_ALL_IN_ONE_DIR": "",
                "WEBUI_PROMPT_BRIDGE_TAGCOMPLETE_DIR": "",
            }
            with mock.patch.object(NODES, "DATA_DIR", data_dir), \
                 mock.patch.object(NODES, "WEBUI_ROOT", webui_root), \
                 mock.patch.object(NODES, "LOCAL_CONFIG", config), \
                 mock.patch.dict(os.environ, env, clear=False):
                prompt_path = NODES._resolve_extension_asset_dir(
                    "prompt_all_in_one_dir",
                    "WEBUI_PROMPT_BRIDGE_PROMPT_ALL_IN_ONE_DIR",
                    "prompt_all_in_one",
                )
                tag_path = NODES._resolve_extension_asset_dir(
                    "tagcomplete_dir",
                    "WEBUI_PROMPT_BRIDGE_TAGCOMPLETE_DIR",
                    "tagcomplete",
                )
            self.assertEqual(prompt_path, local_prompt)
            self.assertEqual(tag_path, local_tags)

    def test_webui_detection_accepts_lora_directory_and_nested_ai_tools_layout(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            drive_root = Path(temp_dir)
            webui_root = drive_root / "AI" / "Tools" / "sd-webui-aki-v4.9"
            lora_dir = webui_root / "models" / "Lora"
            lora_dir.mkdir(parents=True)
            (webui_root / "launch.py").write_text("", encoding="utf-8")

            resolved = NODES._webui_root_from_candidate(lora_dir)
            candidates = NODES._webui_candidates_under(drive_root)

        self.assertEqual(resolved, webui_root)
        self.assertIn(webui_root, candidates)

    def test_forced_missing_webui_source_is_reported_unavailable(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            with mock.patch.object(NODES, "DATA_DIR", root / "data"), \
                 mock.patch.object(NODES, "WEBUI_ROOT", root / "webui"), \
                 mock.patch.object(NODES, "PROMPT_ALL_IN_ONE_DIR", root / "missing-prompt"), \
                 mock.patch.object(NODES, "TAGCOMPLETE_DIR", root / "missing-tags"), \
                 mock.patch.object(NODES, "LOCAL_CONFIG", {"settings": {"data_source": "webui"}}):
                status = NODES._prompt_library_status()
            self.assertEqual(status["prompt"]["source"], "unavailable")
            self.assertEqual(status["autocomplete"]["source"], "unavailable")
            self.assertFalse(status["prompt"]["ready"])
            self.assertFalse(status["autocomplete"]["ready"])

    def test_clear_custom_tags_writes_once_and_keeps_source_library(self):
        config = {
            "custom_tags": [
                {"prompt": "one", "kind": "positive"},
                {"prompt": "two", "kind": "positive"},
                {"prompt": "three", "kind": "negative"},
            ],
            "prompt_market_imports": {"mock": {"downloaded": 3}},
            "webui_root": "C:/stable-diffusion-webui",
        }
        with mock.patch.object(NODES, "LOCAL_CONFIG", config), \
             mock.patch.object(NODES, "_write_local_config") as write_config, \
             mock.patch.object(NODES, "_apply_local_config") as apply_config, \
             mock.patch.object(
                 NODES,
                 "_custom_tag_response",
                 return_value={"success": True, "items": [], "total": 0, "custom_tag_count": 0},
             ):
            result = NODES._clear_custom_tags()
        saved = write_config.call_args.args[0]
        self.assertEqual(result["removed"], 3)
        self.assertEqual(saved["custom_tags"], [])
        self.assertEqual(saved["prompt_market_imports"], {})
        self.assertEqual(saved["webui_root"], config["webui_root"])
        self.assertEqual(write_config.call_count, 1)
        self.assertEqual(apply_config.call_count, 1)
        self.assertEqual(apply_config.call_args.args[0], saved)


if __name__ == "__main__":
    unittest.main()
