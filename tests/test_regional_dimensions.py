"""CPU-only regression tests; load pure helpers without starting ComfyUI."""
import ast
from pathlib import Path
import re
import types
import unittest


ROOT = Path(__file__).resolve().parents[1]
tree = ast.parse((ROOT / "nodes.py").read_text(encoding="utf-8"))
selected = []
for node in tree.body:
    if isinstance(node, ast.FunctionDef) and (
        node.name.startswith("_regional_")
        or node.name in {"_conditioning_set_values", "_conditioning_set_area", "_build_regional_conditioning"}
    ):
        selected.append(node)
    elif isinstance(node, ast.Assign) and any(
        isinstance(t, ast.Name) and t.id.startswith("_REGIONAL_") for t in node.targets
    ):
        selected.append(node)
NS = {"re": re}
exec(compile(ast.Module(body=selected, type_ignores=[]), "nodes.py", "exec"), NS)


class Clip:
    def tokenize(self, text):
        return text

    def encode_from_tokens_scheduled(self, tokens):
        return [[tokens, {"pooled_output": "preserved"}]]


def model(dimensions):
    return types.SimpleNamespace(get_model_object=lambda name: types.SimpleNamespace(latent_dimensions=dimensions))


class RegionalDimensionsTests(unittest.TestCase):
    def build(self, dimensions, negative="bad BREAK worse", base=False):
        return NS["_build_regional_conditioning"](
            Clip(), "scene ADDBASE cat BREAK dog" if base else "cat BREAK dog",
            negative, "vertical", "1,1", base, False, 0.2, 1.0, model(dimensions),
        )

    def test_sd_2d_unchanged(self):
        area = self.build(2)["positive"][0][1]["area"]
        self.assertEqual(area, ("percentage", 1.0, 0.5, 0.0, 0.0))

    def test_anima_positive_and_negative(self):
        result = self.build(3)
        for key in ("positive", "negative"):
            self.assertEqual(result[key][0][1]["area"], ("percentage", 1.0, 1.0, 0.5, 0.0, 0.0, 0.0))
            self.assertEqual(result[key][1][1]["area"][-1], 0.5)
            self.assertEqual(result[key][0][1]["pooled_output"], "preserved")

    def test_global_base_and_negative_remain_global(self):
        result = self.build(3, negative="bad", base=True)
        self.assertNotIn("area", result["positive"][0][1])
        self.assertNotIn("area", result["negative"][0][1])

    def test_metadata_not_mutated(self):
        original = [["tokens", {"pooled_output": "keep"}]]
        NS["_conditioning_set_area"](original, dict(height=1, width=0.5, y=0, x=0), 1, 3)
        self.assertEqual(original[0][1], {"pooled_output": "keep"})

    def test_dimensions_detection(self):
        self.assertEqual(NS["_regional_latent_dimensions"](None), 2)
        for dimensions in (2, 3):
            self.assertEqual(NS["_regional_latent_dimensions"](model(dimensions)), dimensions)
        with self.assertRaises(ValueError):
            NS["_regional_latent_dimensions"](model(1))

    def test_real_comfy_resolver_at_sampling_and_crop_sizes(self):
        path = ROOT.parents[1] / "comfy" / "samplers.py"
        if not path.exists():
            self.skipTest("ComfyUI checkout not installed")
        sampler_tree = ast.parse(path.read_text(encoding="utf-8"))
        function = next(n for n in sampler_tree.body if isinstance(n, ast.FunctionDef)
                        and n.name == "resolve_areas_and_cond_masks_multidim")
        scope = {}
        exec(compile(ast.Module(body=[function], type_ignores=[]), str(path), "exec"), scope)
        for dims in ((1, 192, 128), (1, 288, 192), (1, 64, 64), (4, 192, 128), (192, 128)):
            result = self.build(len(dims))
            for key in ("positive", "negative"):
                conditions = [item[1] for item in result[key]]
                scope[function.name](conditions, dims, None)
                for condition in conditions:
                    area = condition["area"]
                    self.assertEqual(len(area), 2 * len(dims))
                    self.assertTrue(all(isinstance(v, int) for v in area))
                    for size, offset, maximum in zip(area[:len(dims)], area[len(dims):], dims):
                        self.assertGreater(size, 0)
                        self.assertLessEqual(size + offset, maximum)


if __name__ == "__main__":
    unittest.main()
