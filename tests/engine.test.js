import test from "node:test";
import assert from "node:assert/strict";
import { BLACK, PASS, applyMove, initialBoard, legalMoves, opponent } from "../site/js/rules.js";
import { analyzePosition, chooseMove } from "../site/js/engine.js";

test("the engine returns a legal move throughout the public difficulty range", () => {
  const board = initialBoard();
  const legal = new Set(legalMoves(board, BLACK).map(({ move }) => move));
  for (const level of [1, 3, 6, 10]) {
    const result = chooseMove(board, BLACK, level);
    assert.ok(legal.has(result.move), `level ${level} returned a legal move`);
    assert.equal(result.level, level);
    assert.ok(result.nodes > 0);
  }
});

test("principal variations replay legally", () => {
  const board = initialBoard();
  const side = BLACK;
  const result = analyzePosition(board, side, 4, 3);
  assert.equal(result.lines.length, 3);

  for (const line of result.lines) {
    let lineBoard = board;
    let lineSide = side;
    for (const move of line.moves) {
      if (move === PASS) {
        assert.equal(legalMoves(lineBoard, lineSide).length, 0);
      } else {
        const next = applyMove(lineBoard, move, lineSide);
        assert.ok(next, `${move} is legal in the calculated line`);
        lineBoard = next;
      }
      lineSide = opponent(lineSide);
    }
  }
});

test("terminal positions have no move and an exact-scale score", () => {
  const board = new Array(64).fill(BLACK);
  const result = chooseMove(board, BLACK, 2);
  assert.equal(result.move, PASS);
  assert.ok(result.lines[0].score >= 8064);
});
