import test from "node:test";
import assert from "node:assert/strict";
import { BLACK, PASS, WHITE, legalMoves } from "../site/js/rules.js";
import {
  COMPUTER_MOVE_DELAY_MS,
  lastPlacement,
  resolveTurnAfterPlacement,
} from "../site/js/play.js";

const FORCED_BLACK_PASS = [
  WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, WHITE, 0,
  WHITE, WHITE, WHITE, WHITE, BLACK, 0, 0, 0,
  WHITE, BLACK, BLACK, BLACK, 0, 0, 0, 0,
  0, 0, BLACK, BLACK, BLACK, 0, 0, 0,
  0, 0, 0, BLACK, BLACK, BLACK, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
  0, 0, 0, 0, 0, 0, 0, 0,
];

test("a forced human pass waits for acknowledgment", () => {
  assert.equal(legalMoves(FORCED_BLACK_PASS, BLACK).length, 0);
  assert.ok(legalMoves(FORCED_BLACK_PASS, WHITE).length > 0);
  assert.deepEqual(resolveTurnAfterPlacement(FORCED_BLACK_PASS, WHITE, BLACK), {
    nextSide: BLACK,
    gameOver: false,
    humanMustPass: true,
    automaticPass: null,
  });
});

test("a forced computer pass is recorded automatically", () => {
  assert.deepEqual(resolveTurnAfterPlacement(FORCED_BLACK_PASS, WHITE, WHITE), {
    nextSide: WHITE,
    gameOver: false,
    humanMustPass: false,
    automaticPass: { side: BLACK, move: PASS },
  });
});

test("the move marker ignores passes and computer pacing is one second", () => {
  assert.equal(lastPlacement([{ side: BLACK, move: 19 }, { side: WHITE, move: PASS }]), 19);
  assert.equal(COMPUTER_MOVE_DELAY_MS, 1_000);
});
