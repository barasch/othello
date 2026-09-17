import test from "node:test";
import assert from "node:assert/strict";
import { normalizeState } from "../site/js/storage.js";

test("stored settings are clamped to supported first-build ranges", () => {
  const state = normalizeState({
    theme: "violet",
    playSettings: { difficulty: 99, color: "red", opening: "roulette" },
    analysisSettings: { level: 10, lines: 8 },
  });
  assert.equal(state.theme, "system");
  assert.deepEqual(state.playSettings, { difficulty: 3, color: "random", opening: "standard" });
  assert.deepEqual(state.analysisSettings, { level: 4, lines: 1 });
});

test("an XOT game keeps its opening metadata", () => {
  const state = normalizeState({
    playSettings: { opening: "xot" },
    games: [{
      id: "xot-game",
      moves: [],
      opening: "xot",
      openingSequence: "F5D6C4D3C2B3B4B5",
      counts: { black: 32, white: 32 },
    }],
  });
  assert.equal(state.playSettings.opening, "xot");
  assert.equal(state.games[0].opening, "xot");
  assert.equal(state.games[0].openingSequence, "f5d6c4d3c2b3b4b5");
});
