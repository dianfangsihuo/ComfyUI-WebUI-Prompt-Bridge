# WebUIPromptBridge Codex Project Context

Updated: 2026-11-09

## Community integration (v0.4.38, 2026-11-09)

- Branch `codex/nodes2-community-integration`: see `docs/community-integration-2026-11-09.md` for contributor provenance and Issue/PR dispositions.
- Frontend 1.58.7 adds subgrid ancestors between a DOM widget and `.lg-node-widgets`; repairing only the inner widget leaves a connected panel clipped by a 0px ancestor. Traverse/synchronize the complete host chain and verify rendered ancestor heights/hit-testing, not only `isConnected`.
- Favorites Chinese labels use explicit preview + save with original-prompt/name checks; never overwrite English prompts or custom names automatically. Test provider operations use builtin or synthetic responses.
- v0.4.38 preserves magicdolls PR #11/#12/#13 original commits as release ancestors. See the integration document for precise tested scope; publication does not imply reporter-machine confirmation.

## Latest layout audit (v0.4.37)

- See `docs/layout-audit-2026-11-08.md` for verified scope and limits; the early blank-panel reproduction report only established mounting, not usable internal layout.
- Repair invalid Prompt/LoRA section budgets even when stale minimum heights were saved; keep node dimensions, valid manual splits and inner editor heights. All comparisons must use unscaled CSS layout pixels.
- Existing elements own their preferred section/sidebar sizes. Global layout storage is a new-panel default, not an authority shared by every node during serialization or resize.
- Keep typed-array native `setSize` support, LoRA overlay restoration, and the socket-aware Vue prompt-only host positioning/health checks.
- `tools/test_layout_budget.mjs` tests pure layout budgets, independent preferences and typed-array resize; `tools/test_layout_browser.mjs --isolated --url=...` runs a disposable two-renderer layout matrix without generation.
- Inspect rendered node, host and panel bounds **and** internal section allocation. A connected DOM element or visible input alone is not layout acceptance.

This file is a maintainer-oriented memory map for future Codex sessions. It is not release documentation. Read this first when debugging layout, persistence, LoRA performance, or DOM element location issues.

## Fast Start

- Repo: `D:\ai\ComfyUI-aki-v1.6\ComfyUI-aki-v1.6\ComfyUI\custom_nodes\WebUIPromptBridge`
- ComfyUI root: `D:\ai\ComfyUI-aki-v1.6\ComfyUI-aki-v1.6\ComfyUI`
- Local ComfyUI URL normally used for validation: `http://127.0.0.1:8188`
- A cache-busting URL is useful after frontend edits: `http://127.0.0.1:8188/?codex_reload=<stamp>`
- Start ComfyUI from the ComfyUI root:

```powershell
cd D:\ai\ComfyUI-aki-v1.6\ComfyUI-aki-v1.6\ComfyUI
D:\ai\ComfyUI-aki-v1.6\ComfyUI-aki-v1.6\python\python.exe main.py
```

- Quick health check:

```powershell
Invoke-WebRequest -UseBasicParsing -Uri http://127.0.0.1:8188 -TimeoutSec 5
```

## User Constraints

- Do local fixes and validation first.
- Do not publish, package, commit, push, or change release flow unless explicitly asked.
- User prefers to manually accept UI changes in ComfyUI before release work.
- Main compatibility target is latest ComfyUI, including Nodes 2.0, while preserving old LiteGraph behavior.

## Project Shape

- `__init__.py` exports `NODE_CLASS_MAPPINGS`, `NODE_DISPLAY_NAME_MAPPINGS`, and `WEB_DIRECTORY = "./web"`.
- `nodes.py` is the Python backend: ComfyUI node definitions, settings storage, WebUI integration, LoRA metadata APIs, image upload APIs, module helper nodes.
- `web/webui_prompt_bridge.js` is the ComfyUI frontend extension: DOM widget panel, layout repair, prompt editor, LoRA browser, settings dialogs, external port labels.
- `tools/verify_frontend_compat.mjs` is the Playwright regression suite.
- `workflows/anima-webui-prompt-bridge.json` is the main regression workflow.
- `config.local.json` is local runtime config and can be very large; do not casually rewrite it.
- `output/playwright/` receives regression screenshots.

## Backend Map

Important backend locations in `nodes.py`:

- Defaults: `DEFAULT_BRIDGE_SETTINGS`, `UI_VISIBILITY_DEFAULTS`, and `UI_VISIBILITY_LEGACY_KEYS` near the top.
- Local config path: `LOCAL_CONFIG_PATH = NODE_DIR / "config.local.json"`.
- Settings update path: `_update_bridge_settings()` writes into `config.local.json`.
- Main node: `class WebUIPromptBridge`.
- Main node return names: `model`, `clip`, `positive`, `negative`, `positive_text`, `negative_text`, `lora_info`, `module_config`, `image`, `mask`, `img2img_denoise`, `img2img_mode`.
- LoRA runtime load: `WebUIPromptBridge._load_lora()` and `WebUIPromptBridge.run()`.
- LoRA metadata helpers: `_lora_metadata_summary()`, `_lora_detail()`, `_lora_basic_detail()`, `_read_lora_raw_metadata()`, `_read_lora_user_metadata()`.
- Node mappings: `NODE_CLASS_MAPPINGS` near the bottom.

Important backend routes:

- `GET/POST /webui_prompt_bridge/settings`
- `GET/POST /webui_prompt_bridge/ai_config`
- `POST /webui_prompt_bridge/ai_config/test`
- `POST /webui_prompt_bridge/ai_config/models`
- `GET /webui_prompt_bridge/webui_integration`
- `POST /webui_prompt_bridge/webui_integration`
- `GET /webui_prompt_bridge/models`
- `GET /webui_prompt_bridge/loras?detail=basic`
- `GET /webui_prompt_bridge/lora_thumbnail?name=...`
- `GET /webui_prompt_bridge/lora_info?name=...`
- `GET /webui_prompt_bridge/lora_user_metadata?name=...&detail=basic|full`
- `POST /webui_prompt_bridge/lora_user_metadata`
- `POST /webui_prompt_bridge/lora_preview`
- `GET/POST /webui_prompt_bridge/custom_tags`
- `GET/POST /webui_prompt_bridge/styles`
- `GET /webui_prompt_bridge/prompt_all_in_one`

For LoRA performance, the frontend should use `/webui_prompt_bridge/loras?detail=basic` for the first list load. Full safetensors metadata should be lazy-loaded only when needed.

## Frontend Extension Map

Important frontend locations in `web/webui_prompt_bridge.js`:

- Target node constants: `TARGET_NODE = "WebUIPromptBridge"` and `IMAGE_INPUT_NODE = "WebUIPromptBridgeImageInput"`.
- Hidden widget schema mirror: `BRIDGE_WIDGET_DEFINITIONS`. Keep this aligned with backend widget order.
- Panel defaults and repair constants: `DEFAULT_PANEL_WIDTH`, `DEFAULT_PANEL_HEIGHT`, `PANEL_MIN_WIDTH`, `PANEL_MIN_HEIGHT`, `DOM_WIDGET_*`, `EXTERNAL_SLOT_LABEL_*`.
- Layout storage version: `LAYOUT_STORAGE_VERSION`.
- LoRA paging keys: `LORA_PAGE_SIZE_KEY`, `LORA_PAGE_SIZE_USER_KEY`, `DEFAULT_LORA_PAGE_SIZE = 32`.
- Local storage helpers: `readLocalBoolean()`, `writeLocalBoolean()`, `readLocalNumber()`, `writeLocalNumber()`, `migrateLayoutStorage()`.
- Resize helpers: `applyStoredHeight()`, `setResizeTargetHeight()`, `createHeightResizeGrip()`, `createHeightSplitGrip()`, `installSidebarWidthDrag()`.
- Bad saved size detection: `shouldRepairBridgePanelSize()`.
- External port label lifecycle: `bridgeNodeIsInCurrentGraph()`, `cleanupBridgeSlotLabelOverlays()`, `installBridgeSlotLabelOverlay()`.
- Prompt row creation: `createPromptRow()`.
- Main panel construction: `buildBridgePanel()`.
- DOM widget install: `installBridgePanel()` and `node.addDOMWidget("webui_prompt_frontend", ...)`.
- CSS injection: `addStyles()`.
- Comfy extension hook: `app.registerExtension({ name: "WebUI.PromptBridge.Frontend", ... })`.

The frontend uses `app.registerExtension` and `beforeRegisterNodeDef`. For `WebUIPromptBridge`, it chains:

- `onNodeCreated`: set default color/size and schedule panel install.
- `onConfigure`: sanitize widget values, repair bad saved sizes, repair legacy widget order/defaults, schedule panel install.
- `onDrawForeground`: draw/self-heal external port labels and reinstall panel if the DOM widget becomes unusable.
- `beforeConfigureGraph` / `afterConfigureGraph`: sanitize metadata, filter stale missing-node warnings, schedule layout repair.

## DOM Selector Map

Use these selectors in Playwright or the browser console:

- Whole panel: `.webui-bridge-panel`
- DOM widget shell guard: `.webui-bridge-dom-widget-shell`
- Top prompt/action row: `.webui-bridge-toprow`
- Prompt column: `.webui-bridge-prompts`
- Positive prompt row: `.webui-bridge-positive-prompt-row`
- Positive textarea: `.webui-bridge-positive-prompt-row textarea`
- Any prompt row: `.webui-bridge-prompt-row`
- Prompt textarea reset button: `.webui-bridge-prompt-label-btn`
- Prompt chips: `.webui-bridge-prompt-chips`
- Section splitter/resizer: `.webui-bridge-section-resizer`
- Main panel splitter: `.webui-bridge-panel-splitter`
- Right action sidebar: `.webui-bridge-action-column`
- Sidebar toggle button: `.webui-bridge-side-toggle`
- Sidebar width drag grip: `.webui-bridge-side-resizer`
- Whole node width grip: `.webui-bridge-node-width-resizer`
- Extra Networks/LoRA section: `.webui-bridge-extra`
- LoRA search: `.webui-bridge-search`
- LoRA page size select: `.webui-bridge-page-size`
- LoRA page indicator: `.webui-bridge-page-info`
- LoRA tree: `.webui-bridge-network-tree`
- LoRA card grid: `.webui-bridge-card-grid`
- LoRA cards: `.webui-bridge-card`
- LoRA edit modal: `.webui-bridge-lora-edit`
- LoRA quick overlay close: `.webui-bridge-lora-overlay-close`
- External slot overlay wrapper: `.webui-bridge-slot-label-overlay`
- External slot labels: `.webui-bridge-slot-label`
- Settings/dialog mask: `.webui-bridge-config-mask`
- Settings/dialog panel: `.webui-bridge-config-panel`
- General visibility target lookup: `[data-visibility-key="<key>"]`

Useful console snippets:

```javascript
const bridge = app.graph._nodes.find((node) => node.type === "WebUIPromptBridge");
bridge?.size;
bridge?.widgets?.map((widget) => [widget.name, widget.value]);
document.querySelector(".webui-bridge-positive-prompt-row textarea")?.getBoundingClientRect();
document.querySelectorAll(".webui-bridge-slot-label-overlay").length;
[...document.querySelectorAll(".webui-bridge-slot-label")].map((item) => item.textContent);
localStorage.getItem("webui-bridge-action-column-collapsed");
```

## Saved State Map

Server-side saved settings live in `config.local.json` under `settings`:

- `layout_preset`
- `tag_display`
- `lora_card_size`
- `node_tutorial_popup`
- `ui_visibility`
- data/translation source fields

Important `ui_visibility` keys:

- `top_lora`: controls the `快速添加 LoRA` button; default is `true`.
- `top_webui`, `top_clip`, `top_fail_on_missing`
- `model_switch`, `regional_control`, `size_controls`, `layout_presets`, `prompt_tools`, `styles`, `lora_browser`
- module sections: `module_img2img`, `module_mask`, `module_table`, `module_negative_common`, `module_flip`, `module_presets`, `module_controlnet`, `module_adetailer`, `module_sam`, `module_upscale`, `module_regional_lora`

Client-side layout/local UI state lives in `localStorage`:

- `webui-bridge-layout-storage-version`
- `webui-bridge-toprow-height`
- `webui-bridge-extra-height`
- `webui-bridge-extra-collapsed`
- `webui-bridge-action-column-collapsed`
- `webui-bridge-action-column-width`
- `webui-bridge-negative-collapsed`
- `webui-bridge-textarea-height-prompt`
- `webui-bridge-textarea-height-negative-prompt`
- `webui-bridge-chip-size-positive`
- `webui-bridge-chip-size-negative`
- `webui-bridge-lora-page-size`
- `webui-bridge-lora-page-size-user-set`
- `webui-bridge-font-size`
- `webui-bridge-node-tutorial-seen-v2`

The sidebar collapsed key is intentionally not cleared by the generic layout reset. This prevents "hide sidebar" from being lost after reload or graph layout repair.

## Current UI Compatibility Fixes

These fixes exist in the current local worktree and should be preserved unless intentionally redesigned:

- Bad saved node sizes are repaired in `shouldRepairBridgePanelSize()` and in `onConfigure`.
- DOM widget wrapper, panel size, and LiteGraph node size are kept aligned after configure/reload/layout repair.
- Port labels are external overlays, not interior rows, so they do not consume node panel space.
- External port overlays are tagged with `data-bridge-node-id` and cleaned by current-graph membership to avoid orphan labels remaining on canvas.
- `onDrawForeground` self-heals missing slot label overlays when the panel is usable.
- Positive textarea native/manual height is persisted through `webui-bridge-textarea-height-prompt` and must not be overwritten by adaptive layout.
- `fitPromptColumnToContent()` should only gently auto-fit when no manual height exists.
- Adaptive layout must skip while the DOM widget is offscreen/unmeasurable; keep the last visible layout state instead of sampling 0px hidden geometry.
- Large saved layouts must settle after load and model/mode switches: prompt/top row height should shrink or grow only to its visible content comfort height, while the capped LoRA section must not expand into half-node space.
- When the negative prompt is collapsed from a full layout, the LoRA section may temporarily exceed the normal 520px inline cap to reclaim the released vertical space and avoid a large empty bottom area.
- `快速添加 LoRA` replaces the old top LoRA button label and defaults to visible.
- LoRA list defaults to paging: `DEFAULT_LORA_PAGE_SIZE = 32`.
- First LoRA list load should be basic-detail only. Lazy detail calls are made when selecting/editing/using a LoRA.
- Visibility settings load is asynchronous, so after settings arrive the frontend must reapply `applyUiVisibility()`.

## Regression Tests

Syntax checks:

```powershell
node --check web/webui_prompt_bridge.js
node --check tools/verify_frontend_compat.mjs
D:/ai/ComfyUI-aki-v1.6/ComfyUI-aki-v1.6/python/python.exe -m py_compile nodes.py
```

Full frontend compatibility run:

```powershell
node tools/verify_frontend_compat.mjs --url=http://127.0.0.1:8188
```

Optional generation queue test:

```powershell
node tools/verify_frontend_compat.mjs --url=http://127.0.0.1:8188 --queue
```

The main regression suite currently covers:

- Bridge event propagation does not block canvas widgets.
- Common Comfy widgets remain clickable.
- Workflow switch nodes still work.
- Current and custom workflow layouts are preserved.
- Prompt/LoRA ergonomics and section resizing.
- Full-layout negative prompt collapse reclaims released space into LoRA instead of leaving a large blank below.
- Restore size stability.
- Offscreen canvas pan/return does not collapse prompt or LoRA layout.
- Large saved layouts settle after load and after mode/model switches without changing node size.
- Flat saved size repair.
- Large saved node sizes are preserved while port gutters stay outside the DOM panel.
- Sidebar collapse persistence and orphan external port label cleanup.
- Positive textarea manual height persistence.
- Quick LoRA button default visibility.
- Visibility settings persistence across reload.
- LoRA default paging and basic-detail load.
- LoRA browser insert flow.
- Settings round trip into widget values and graphToPrompt.
- Negative prompt collapse persistence.
- Old workflow compatibility.

Useful recent expected signals:

- `ok: true`
- `sidebarCollapsePersistenceAndSlotLabelCleanup.overlayCount: 1`
- `sidebarCollapsePersistenceAndSlotLabelCleanup.collapsedAfterReload: true`
- `sidebarCollapsePersistenceAndSlotLabelCleanup.stored: "1"`
- `positiveTextareaManualHeightPersists`: `260 -> 260 -> 260`
- `loraDefaultPagingAndBasicLoad.cardCount: 32`
- `bridgeConsoleErrors: 0`

## Common Debug Paths

If the UI is squeezed or ports are covered:

1. Inspect `bridge.size`, `.webui-bridge-panel` dimensions, and `.webui-bridge-slot-label-overlay`.
2. Check `shouldRepairBridgePanelSize()`, `normalizeBridgePanelSize()`, and `installBridgePanel()`.
3. Run `verifyFlatSavedBridgeSizeRepair` and `verifyLargeSavedBridgeSizePreservedAndPortGutters` through the full suite.

If textareas bounce back after dragging:

1. Inspect `localStorage.getItem("webui-bridge-textarea-height-prompt")`.
2. Inspect `.webui-bridge-positive-prompt-row textarea`.
3. Check `createPromptRow()`, `rememberTextareaNativeHeight()`, `setResizeTargetHeight()`, and the adaptive layout block for manual-height bypass.

If sidebar collapse is not saved:

1. Inspect `localStorage.getItem("webui-bridge-action-column-collapsed")`.
2. Check `applyActionCollapsedState()`.
3. Ensure `resetNodeLayoutCache()` does not clear the sidebar collapsed key.

If external port labels leave canvas residue:

1. Inspect `document.querySelectorAll(".webui-bridge-slot-label-overlay")`.
2. Inspect each overlay's `dataset.bridgeNodeId`.
3. Check `cleanupBridgeSlotLabelOverlays()` and whether nodes are still in `app.graph._nodes`.

If LoRA UI is slow:

1. Confirm first list request is `/webui_prompt_bridge/loras?detail=basic`.
2. Confirm page size is 32 unless the user explicitly selected all.
3. Confirm card count does not equal the entire LoRA library on first render.
4. Inspect lazy calls to `/lora_user_metadata` and `/lora_info`.

If settings disappear after refresh:

1. Distinguish server settings in `config.local.json` from client layout state in `localStorage`.
2. Check `GET /webui_prompt_bridge/settings` response.
3. Check `_update_bridge_settings()` and `applyUiVisibility()`.
4. Run `verifyVisibilitySettingsPersistAcrossReload` and `verifyBridgeSettingsRoundTrip`.

## Known Environmental Notes

- This ComfyUI install can print unrelated startup noise from old backup custom-node folders. Do not assume every startup warning belongs to WebUIPromptBridge.
- Frontend JS changes need a ComfyUI reload and usually a browser cache-busting query.
- `config.local.json` may contain machine-specific paths and large local data. Avoid wholesale formatting churn.
- Use PowerShell 7 (`pwsh`) for Windows commands when encoding or nested quoting matters.

## Files Most Often Touched

- `web/webui_prompt_bridge.js`: layout, DOM, settings UI, LoRA browser, Comfy extension hooks.
- `nodes.py`: backend APIs, Comfy node definitions, defaults, local settings, LoRA metadata.
- `tools/verify_frontend_compat.mjs`: Playwright regression coverage and UI selectors.
- `workflows/anima-webui-prompt-bridge.json`: main workflow fixture.
- `config.local.example.json`: only update if new config shape needs documentation.

## Do Not Forget

- Keep `BRIDGE_WIDGET_DEFINITIONS` in sync with backend widget order.
- Preserve unknown trailing widget values when repairing old workflows.
- Do not mix DOM widget assumptions too tightly with ComfyUI internals; prefer guarded hooks and self-healing checks.
- Do not render all LoRA cards by default for large libraries.
- Do not clear user layout preferences while repairing bad saved graph sizes.
- Do not publish or package until the user accepts the local UI.
