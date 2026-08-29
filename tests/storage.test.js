import test from "node:test";
import assert from "node:assert/strict";
import { normalizeState } from "../site/js/storage.js";

test("stored settings are clamped to supported first-build ranges", () => {
  const state = normalizeState({
    theme: "violet",
    playSettings: { difficulty: 99, color: "red" },
    analysisSettings: { level: 10, lines: 8 },
  });
  assert.equal(state.theme, "system");
  assert.deepEqual(state.playSettings, { difficulty: 5, color: "random" });
  assert.deepEqual(state.analysisSettings, { level: 4, lines: 1 });
});
