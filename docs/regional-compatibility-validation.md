# Regional conditioning compatibility validation

## Scope

Fix: construct percentage area sizes and offsets using the connected model's latent dimensions. This addresses the reported `IndexError` in ComfyUI's area resolver, not all regional image-quality issues.

## Verified

- Local ComfyUI 0.20.1, Python 3.11.9, PyTorch 2.7.0+cu128, RTX 5070 Ti.
- Anima baseV10: vertical, horizontal, 2x2 grid, global base prompt, distinct regional negatives, batch size 4.
- Each matrix generation includes first sampling and 1.5x latent upscale plus second sampling; `er_sde` / `simple` used in the expanded matrix.
- SDXL base: regional generation and second sampling completed.
- FaceDetailerPipe with face_yolov8m: two refined crop outputs were saved, confirming detections rather than a no-detection bypass.
- FaceDetailer output passed through SeedVR2 3B FP8 / SDPA to 1024x1024 successfully.
- Earlier validation: VAE re-encoding a crop plus DifferentialDiffusion sampling completed.
- The unmodified area resolver extracted from official ComfyUI v0.33.0 source passed 2D and 3D first-pass, upscale and crop dimensions. This is a function-level test, not a complete v0.33.0 runtime test.
- Unit suite: 24 tests passed before expanded GPU testing.

Evidence is retained locally under `output/regional-validation/`: matrix-jobs.json, matrix-results.json, seedvr2-result.json, face-crop-result.json and the submitted API prompts. Images are in ComfyUI's `output/regional_validation/` directory.

## Remaining limits

- Fan's exact WAI-ANIMA_v10Base10 checkpoint is unavailable locally; Anima baseV10 is a same-architecture substitute.
- Fan uses ComfyUI 0.33.0 / Python 3.13 / PyTorch 2.9.1, not the local runtime.
- Exact hand_yolov9c, face_yolov9c, Eyeful_v2-Individual and animeNSFWSegm_xlRes1280 detectors are unavailable locally.
- Fan's SeedVR2 7B mixed-block weights / flash_attn_2 / 2560px settings were not tested; available 3B weights / SDPA / 1024px were tested instead.
- Batch 4 passed at reduced test resolution, not the fan's 1024x1536 initial resolution. Memory sufficiency at full resolution is not guaranteed.
- Regional boundary seams remain. Percentage conditions on detailer crops are relative to the crop, not automatically remapped from the original image; successful execution does not certify semantic region placement for every crop.
- Incompatible NoobAI LoRA weights on Anima are separate from this fix; remove or replace them with matching LoRAs.

## Delivery conclusion

The reported area dimensionality crash has a targeted fix and substantial regression evidence. Offer it as a verified fix for that crash, not a guarantee that every model, plugin, detailer configuration or the fan's entire environment is error-free. Final acceptance requires the fan's original environment to run the updated node after restarting ComfyUI.
