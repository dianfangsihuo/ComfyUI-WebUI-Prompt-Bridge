import { readFileSync } from "node:fs";
import vm from "node:vm";
import assert from "node:assert/strict";

const source = readFileSync(new URL("../web/webui_prompt_bridge.js", import.meta.url), "utf8");
const helperStart = source.indexOf("function withDeferredPromptInputSync(");
const helperEnd = source.indexOf("\nfunction ", helperStart + 1);
const inputStart = source.indexOf("    const onInput = (textarea, event = null) => {");
const inputEnd = source.indexOf("\n    const positive = createPromptRow(", inputStart);
assert(helperStart >= 0 && helperEnd > helperStart && inputStart >= 0 && inputEnd > inputStart);
const counts = { sync: 0, deferred: 0, translations: 0 };
const context = vm.createContext({
    clearPromptPlacementWarning() {},
    setPromptTranslateStatus() {},
    sync() { counts.sync++; },
    schedulePromptInputSync() { counts.deferred++; },
    scheduleAutoTranslateInput() { counts.translations++; },
});
vm.runInContext(source.slice(helperStart, helperEnd) + "\n" + source.slice(inputStart, inputEnd), context);
const onInput = vm.runInContext("onInput", context);
const batch = context.withDeferredPromptInputSync;
const textarea = { __webuiBridgeKind: "positive" };

onInput(textarea, { isTrusted: false });
assert.equal(counts.sync, 1, "Normal programmatic input must still update the widget");
onInput(textarea, { isTrusted: true });
assert.equal(counts.deferred, 1, "Native typing lost its debounce path");
const initial = { ...counts };
const result = batch(textarea, () => {
    onInput(textarea, { isTrusted: false });
    assert.equal(textarea.__webuiBridgeDeferPromptInputSync, true);
    return { changed: true, newIndexes: [1, 2] };
});
assert.deepEqual(result, { changed: true, newIndexes: [1, 2] });
assert.deepEqual(counts, initial, "Reorder input performed an early render or translation");
assert.equal(textarea.__webuiBridgeDeferPromptInputSync, undefined);
context.sync(); // The existing afterChange callback commits selection and text once.
assert.equal(counts.sync - initial.sync, 1, "One reorder must have one commit");
assert.equal(textarea.__webuiBridgeAutoTranslateVersion, 3, "An old translation could overwrite a reorder");
textarea.__webuiBridgeAutoTranslating = true;
batch(textarea, () => onInput(textarea, { isTrusted: false }));
assert.equal(textarea.__webuiBridgeAutoTranslatePending, true, "Reordering during translation lost its retry flag");
textarea.__webuiBridgeAutoTranslating = false;

batch(textarea, () => batch(textarea, () => assert.equal(textarea.__webuiBridgeDeferPromptInputSync, true)));
assert.equal(textarea.__webuiBridgeDeferPromptInputSync, undefined);
assert.throws(() => batch(textarea, () => { throw new Error("cancel"); }), /cancel/);
assert.equal(textarea.__webuiBridgeDeferPromptInputSync, undefined, "An exception left input synchronization disabled");
textarea.__webuiBridgeDeferPromptInputSync = false;
batch(textarea, () => {});
assert.equal(textarea.__webuiBridgeDeferPromptInputSync, false);
onInput(textarea, { isTrusted: false });
assert.equal(counts.sync, initial.sync + 2, "Later edits stopped synchronizing");
console.log("Prompt input transaction: single reorder commit, native/programmatic input, nested updates, translation invalidation and exception cleanup passed.");
