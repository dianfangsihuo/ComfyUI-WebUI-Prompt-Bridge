import importlib.util
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


REPO_ROOT = Path(__file__).resolve().parents[1]
COMFY_ROOT = REPO_ROOT.parents[1]
if str(COMFY_ROOT) not in sys.path:
    sys.path.insert(0, str(COMFY_ROOT))

SPEC = importlib.util.spec_from_file_location("webui_prompt_bridge_nodes_test", REPO_ROOT / "nodes.py")
NODES = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(NODES)


class PromptLibraryTests(unittest.TestCase):
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
