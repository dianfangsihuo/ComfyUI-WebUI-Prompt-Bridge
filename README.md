# ComfyUI WebUI Prompt Bridge

![ComfyUI WebUI Prompt Bridge workflow](docs/images/webui-prompt-bridge-workflow.png)

**ComfyUI WebUI Prompt Bridge** brings a WebUI-style prompt cockpit into ComfyUI: visual tag editing, Chinese-to-English prompt translation, autocomplete, favorites, LoRA tag parsing, LoRA loading, styles, prompt history and a compact control surface built for anime / Anima workflows.

It is designed for people who like ComfyUI's node graph but still want the fast prompt operations from WebUI extensions such as Prompt All in One and TagComplete.

## Highlights

- WebUI-like prompt editor embedded directly on a ComfyUI node.
- Chinese natural-language prompt translation into English prompt text.
- Tag chips with edit, delete, disable, favorite, copy, weight and reorder actions.
- Drag tags to adjust prompt order.
- Autocomplete from local TagComplete data when available.
- Prompt All in One-style grouped tags and favorites when a WebUI install is configured.
- Online translation through the local Prompt All in One translator when available.
- LoRA prompt tags such as `<lora:name:0.8>` are parsed and applied to both model and CLIP.
- LoRA discovery, matching, missing-LoRA warnings and metadata summary.
- WebUI `styles.csv` loading and editing.
- Prompt history and favorites are stored locally.
- Works as a normal ComfyUI node and returns model, clip, positive conditioning, negative conditioning and readable prompt strings.

## Install

Clone into `ComfyUI/custom_nodes`:

```bash
git clone https://github.com/dianfangsihuo/ComfyUI-WebUI-Prompt-Bridge.git
```

Install requirements if your ComfyUI environment does not already include them:

```bash
pip install -r ComfyUI-WebUI-Prompt-Bridge/requirements.txt
```

Restart ComfyUI, then add:

```text
conditioning/webui -> WebUI Prompt Bridge
```

## Optional WebUI Data Bridge

For the full WebUI-like experience, point the node to an existing AUTOMATIC1111 WebUI folder that has these extensions installed:

- `sd-webui-prompt-all-in-one`
- `a1111-sd-webui-tagcomplete`

Copy `config.local.example.json` to `config.local.json` and edit the paths:

```json
{
  "webui_root": "X:/path/to/stable-diffusion-webui",
  "prompt_all_in_one_dir": "X:/path/to/stable-diffusion-webui/extensions/sd-webui-prompt-all-in-one",
  "tagcomplete_dir": "X:/path/to/stable-diffusion-webui/extensions/a1111-sd-webui-tagcomplete",
  "webui_python_site_packages": "X:/path/to/stable-diffusion-webui/python/Lib/site-packages",
  "styles_file": "X:/path/to/stable-diffusion-webui/styles.csv"
}
```

You can also use environment variables:

```text
WEBUI_PROMPT_BRIDGE_WEBUI_ROOT
WEBUI_PROMPT_BRIDGE_PROMPT_ALL_IN_ONE_DIR
WEBUI_PROMPT_BRIDGE_TAGCOMPLETE_DIR
WEBUI_PROMPT_BRIDGE_WEBUI_SITE_PACKAGES
WEBUI_PROMPT_BRIDGE_STYLES_FILE
WEBUI_PROMPT_BRIDGE_STORAGE_DIR
```

`config.local.json` is intentionally ignored by git so local paths and private settings are not published.

## LoRA Behavior

The node removes LoRA tags from the final text prompt, resolves them against ComfyUI's `loras` folder, and applies them through ComfyUI's LoRA loader API.

Example:

```text
1girl, blue dress, standing by the sea, <lora:my-style-lora:0.75>
```

If `fail_on_missing_lora` is enabled, generation stops when a referenced LoRA is not found. This is useful because silent LoRA failures are one of the easiest ways to get bad output while thinking the workflow is correct.

## Publishing Notes

This repository does not bundle models or LoRAs. Example workflows should use placeholder model names or document required files separately.

Attribution is listed in `NOTICE.md`.

## License

MIT. See `LICENSE`.
