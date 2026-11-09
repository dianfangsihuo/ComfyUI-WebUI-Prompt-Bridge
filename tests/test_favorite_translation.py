import copy
import unittest
from unittest import mock

from test_prompt_library import NODES


class FavoriteTranslationTests(unittest.TestCase):
    def setUp(self):
        self.items = [
            {"id": "a", "prompt": "blue sky", "name": "blue sky", "category": "scenes", "subCategory": "sky"},
            {"id": "b", "prompt": "1girl", "name": "My label", "category": "people"},
            {"id": "c", "prompt": "red hair", "name": "红发"},
        ]
        self.before = copy.deepcopy(self.items)

    def preview(self, item_id="a", matched=True):
        with mock.patch.object(NODES, "_storage_get", return_value=self.items), \
             mock.patch.object(NODES, "_storage_set") as write, \
             mock.patch.object(NODES, "_translate_prompt_all_in_one_text", return_value=[
                 {"input": "blue sky", "local": "蓝天" if matched else "blue sky", "matched": matched}
             ]) as translate:
            result = NODES._preview_favorite_chinese_name("positive", item_id)
            write.assert_not_called()
        return result, translate

    def test_preview_uses_stored_prompt_without_writing(self):
        result, translate = self.preview()
        self.assertEqual(result["status"], "ready")
        self.assertEqual(result["name"], "蓝天")
        self.assertEqual(translate.call_args.args[:3], ("blue sky", "local", "zh_CN"))
        self.assertEqual(self.items, self.before)

    def test_preview_preserves_custom_and_chinese_names(self):
        for item_id in ["b", "c", "missing"]:
            result, translate = self.preview(item_id)
            self.assertEqual(result["status"], "skipped")
            translate.assert_not_called()

    def test_unmatched_preview_keeps_original(self):
        result, _ = self.preview(matched=False)
        self.assertEqual(result["status"], "failed")
        self.assertEqual(result["name"], "")

    def test_save_is_single_transaction_and_preserves_everything_else(self):
        entries = [{"id": item["id"], "prompt": item["prompt"], "expected_name": item["name"], "name": "中文说明"} for item in self.items]
        with mock.patch.object(NODES, "_storage_get", return_value=self.items) as read, mock.patch.object(NODES, "_storage_set") as write:
            result = NODES._mutate_prompt_all_in_one_favorites("positive", "fill_chinese_names", entries=entries)
            self.assertEqual(result["changed"], 1)
            read.assert_called_once(); write.assert_called_once()
            saved = write.call_args.args[1]
            expected = copy.deepcopy(self.before); expected[0]["name"] = "中文说明"
            self.assertEqual(saved, expected)
            self.assertEqual(self.items, self.before)

    def test_concurrent_edit_or_delete_does_not_overwrite(self):
        for change in [{"prompt": "old"}, {"expected_name": "old"}, {"id": "missing"}, {"name": "English only"}]:
            entry = {"id": "a", "prompt": "blue sky", "expected_name": "blue sky", "name": "蓝天", **change}
            with mock.patch.object(NODES, "_storage_get", return_value=self.items), mock.patch.object(NODES, "_storage_set") as write:
                result = NODES._mutate_prompt_all_in_one_favorites("positive", "fill_chinese_names", entries=[entry])
                self.assertEqual(result["changed"], 0); write.assert_not_called()

    def test_large_prompt_bounded_before_translation(self):
        self.items[0]["prompt"] = ", ".join(["tag"] * 33); self.items[0]["name"] = ""
        result, translate = self.preview()
        self.assertEqual(result["status"], "skipped"); translate.assert_not_called()

    def test_legacy_tags_only_favorite_keeps_payload(self):
        legacy = [{"id": "legacy", "name": "", "tags": [{"value": "blue sky", "disabled": False, "localValue": ""}], "category": "Old"}]
        original = copy.deepcopy(legacy)
        with mock.patch.object(NODES, "_storage_get", return_value=legacy), mock.patch.object(NODES, "_storage_set") as write:
            result = NODES._mutate_prompt_all_in_one_favorites("negative", "fill_chinese_names", entries=[
                {"id": "legacy", "prompt": "blue sky", "expected_name": "", "name": "蓝天"}])
            self.assertEqual(result["changed"], 1)
            self.assertEqual(write.call_args.args[1][0]["tags"], original[0]["tags"])
            self.assertEqual(write.call_args.args[1][0]["category"], "Old")

    def test_partial_translation_cannot_be_saved_as_complete_preview(self):
        with mock.patch.object(NODES, "_storage_get", return_value=self.items), \
             mock.patch.object(NODES, "_translate_prompt_all_in_one_text", return_value=[
                 {"input": "blue", "local": "蓝色", "matched": True},
                 {"input": "unknown", "local": "unknown", "matched": False}]), \
             mock.patch.object(NODES, "_storage_set") as write:
            result = NODES._preview_favorite_chinese_name("positive", "a")
            self.assertEqual(result["status"], "failed"); self.assertEqual(result["name"], ""); write.assert_not_called()


if __name__ == "__main__":
    unittest.main()
