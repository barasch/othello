import test from "node:test";
import assert from "node:assert/strict";
import {
  BLACK,
  WHITE,
  PASS,
  advanceAfterMove,
  applyMove,
  coordinateOf,
  countDiscs,
  initialBoard,
  isTerminal,
  legalMoves,
  replayEvents,
} from "../site/js/rules.js";

test("initial position has the four standard black moves", () => {
  const board = initialBoard();
  assert.deepEqual(legalMoves(board, BLACK).map(({ move }) => coordinateOf(move)), ["D3", "C4", "F5", "E6"]);
  assert.deepEqual(countDiscs(board), { black: 2, white: 2, empty: 60 });
});

test("a legal move places one disc and turns every bracketed disc", () => {
  const board = applyMove(initialBoard(), 19, BLACK);
  assert.ok(board);
  assert.equal(board[19], BLACK);
  assert.equal(board[27], BLACK);
  assert.deepEqual(countDiscs(board), { black: 4, white: 1, empty: 59 });
});

test("illegal moves and illegal passes are rejected", () => {
  assert.equal(applyMove(initialBoard(), 0, BLACK), null);
  assert.throws(() => replayEvents([{ side: BLACK, move: PASS }]), /Illegal pass/);
});

test("a filled position is terminal", () => {
  const board = new Array(64).fill(BLACK);
  assert.equal(isTerminal(board), true);
  assert.deepEqual(advanceAfterMove(board, BLACK), { nextSide: WHITE, passedSide: null, gameOver: true });
});
