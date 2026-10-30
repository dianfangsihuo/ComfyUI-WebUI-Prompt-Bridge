"""Regression coverage for the main bridge's optional image input gate."""
import json
import tempfile
import types
import unittest
from unittest import mock

from test_prompt_library import NODES


class Img2ImgGateTests(unittest.TestCase):
    def setUp(self):
        self.empty_image = object()
        self.empty_mask = object()
        self.clip = types.SimpleNamespace(
            tokenize=lambda text: text,
            encode_from_tokens_scheduled=lambda tokens: [[tokens, {}]],
        )
        empty_patch = mock.patch.object(
            NODES, "_empty_bridge_image", return_value=(self.empty_image, self.empty_mask),
        )
        self.empty = empty_patch.start()
        self.addCleanup(empty_patch.stop)

    def build(self, **kwargs):
        return NODES.WebUIPromptBridge().build(
            model="model", clip=self.clip,
            positive_prompt="cat", negative_prompt="blurry",
            default_clip_strength=1.0, fail_on_missing_lora=True,
            **kwargs,
        )

    @staticmethod
    def img2img_config(result):
        return json.loads(result[7])["modules"]["img2img"]

    def test_disabled_accepts_actual_legacy_workflow_values(self):
        result = self.build(
            module_img2img_enabled=False,
            module_img2img_image="img2img", module_img2img_mask="img2img",
            module_img2img_mode="img2img", module_img2img_denoise=0.0,
        )
        self.assertIs(result[8], self.empty_image)
        self.assertIs(result[9], self.empty_mask)
        self.assertFalse(self.img2img_config(result)["enabled"])

    def test_disabled_ignores_stale_image_and_mask_without_validation_or_io(self):
        cases = (
            ("img2img", "img2img"),  # Actual failing workflow values.
            ("missing.png", "missing_mask.png"),
            ("photo.gif", "mask.bmp"),
            ("../outside.png", "../mask.png"),
            ("", "img2img"),
            (None, False),
        )
        for image, mask in cases:
            with (
                self.subTest(image=image, mask=mask),
                mock.patch.object(NODES, "_coerce_bridge_image_ref") as normalize,
                mock.patch.object(NODES, "_load_bridge_image_tensor") as load_image,
                mock.patch.object(NODES, "_load_bridge_mask_tensor") as load_mask,
            ):
                result = self.build(
                    module_img2img_enabled=False,
                    module_img2img_image=image, module_img2img_mask=mask,
                )
                normalize.assert_not_called()
                load_image.assert_not_called()
                load_mask.assert_not_called()
                self.assertIs(result[8], self.empty_image)
                self.assertIs(result[9], self.empty_mask)
                self.assertEqual(result[4:6], ("cat", "blurry"))
                config = self.img2img_config(result)
                self.assertFalse(config["enabled"])
                self.assertEqual((config["image"], config["mask"]), ("", ""))

    def test_enabled_rejects_invalid_image_and_mask_formats(self):
        for image, mask in (("img2img", ""), ("photo.gif", ""), ("photo.png", "img2img")):
            with (
                self.subTest(image=image, mask=mask),
                tempfile.TemporaryDirectory() as directory,
                mock.patch.object(NODES.folder_paths, "get_input_directory", return_value=directory),
                mock.patch.object(NODES, "_load_bridge_image_tensor") as load_image,
            ):
                with self.assertRaisesRegex(ValueError, "Bridge image must be PNG, JPEG, or WebP"):
                    self.build(
                        module_img2img_enabled=True,
                        module_img2img_image=image, module_img2img_mask=mask,
                    )
                load_image.assert_not_called()

    def test_enabled_preserves_path_safety_checks(self):
        with tempfile.TemporaryDirectory() as directory, mock.patch.object(
            NODES.folder_paths, "get_input_directory", return_value=directory,
        ):
            for image in ("../outside.png", directory + "/absolute.png"):
                with self.subTest(image=image), self.assertRaisesRegex(ValueError, "inside the ComfyUI input directory"):
                    self.build(module_img2img_enabled=True, module_img2img_image=image)

    def test_enabled_loads_supported_formats_and_clears_alpha_mask_for_img2img(self):
        pixels, alpha, blank = object(), object(), object()
        for extension in ("png", "jpg", "jpeg", "webp", "PNG"):
            image = "bridge/photo." + extension
            with (
                self.subTest(extension=extension),
                tempfile.TemporaryDirectory() as directory,
                mock.patch.object(NODES.folder_paths, "get_input_directory", return_value=directory),
                mock.patch.object(NODES, "_load_bridge_image_tensor", return_value=(pixels, alpha)) as load_image,
                mock.patch.object(NODES, "_empty_mask_for_image", return_value=blank) as blank_mask,
            ):
                result = self.build(
                    module_img2img_enabled=True, module_img2img_image=image,
                    module_img2img_denoise=0.65,
                )
                load_image.assert_called_once_with(image)
                blank_mask.assert_called_once_with(pixels)
                self.assertIs(result[8], pixels)
                self.assertIs(result[9], blank)
                self.assertEqual(result[10:12], (0.65, "img2img"))
                self.assertTrue(self.img2img_config(result)["enabled"])
                self.assertEqual(self.img2img_config(result)["image"], image)

    def test_enabled_inpaint_preserves_alpha_or_explicit_mask(self):
        pixels, alpha, mask_pixels = object(), object(), object()
        for mask in ("", "bridge/mask.png"):
            with (
                self.subTest(mask=mask),
                tempfile.TemporaryDirectory() as directory,
                mock.patch.object(NODES.folder_paths, "get_input_directory", return_value=directory),
                mock.patch.object(NODES, "_load_bridge_image_tensor", return_value=(pixels, alpha)),
                mock.patch.object(NODES, "_load_bridge_mask_tensor", return_value=mask_pixels) as load_mask,
                mock.patch.object(NODES, "_empty_mask_for_image") as blank_mask,
            ):
                result = self.build(
                    module_img2img_enabled=True, module_img2img_image="bridge/photo.png",
                    module_img2img_mask=mask, module_img2img_mode="inpaint",
                )
                self.assertIs(result[9], mask_pixels if mask else alpha)
                self.assertEqual(result[11], "inpaint")
                blank_mask.assert_not_called()
                if mask:
                    load_mask.assert_called_once_with(mask, pixels)
                else:
                    load_mask.assert_not_called()

    def test_enabled_without_an_image_keeps_existing_empty_output_behavior(self):
        with mock.patch.object(NODES, "_load_bridge_image_tensor") as load_image:
            result = self.build(module_img2img_enabled=True)
        load_image.assert_not_called()
        self.assertIs(result[8], self.empty_image)
        self.assertFalse(self.img2img_config(result)["enabled"])


if __name__ == "__main__":
    unittest.main()
