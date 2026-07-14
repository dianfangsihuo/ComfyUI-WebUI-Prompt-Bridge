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
