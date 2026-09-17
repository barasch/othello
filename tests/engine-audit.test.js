import test from 'node:test';
import assert from 'node:assert/strict';
import { initialBoard, legalMoves, applyMove, opponent, BLACK, WHITE, PASS, countDiscs } from '../site/js/rules.js';
import { analyzePosition, evaluatePosition } from '../site/js/engine.js';

// Independent, unpruned minimax using the public 8x8 rules, not the search's
// sentinel move generator. Tiny endgames and short horizons keep this bounded.
function reference(board, side, depth, passed = false) {
  const moves = legalMoves(board, side);
  if (!moves.length) {
    if (!passed) return -reference(board, opponent(side), depth, true);
    const c = countDiscs(board), diff = (c.black - c.white) * (side === BLACK ? 1 : -1);
    return diff ? Math.sign(diff) * 8000 + diff : 0;
  }
  if (!depth) return evaluatePosition(board, side);
  return Math.max(...moves.map(({move}) => -reference(applyMove(board, move, side), opponent(side), depth - 1)));
}
function positions() {
  let seed = 20260917;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  const samples = [];
  for (let game = 0; game < 8; game++) {
    let board = initialBoard(), side = BLACK, passes = 0;
    for (let step = 0; step < 125 && passes < 2; step++) {
      const moves = legalMoves(board, side);
      if (!moves.length) { passes++; side = opponent(side); continue; }
      passes = 0;
      if ([48, 32, 16, 5].includes(countDiscs(board).empty)) samples.push({board, side});
      board = applyMove(board, moves[Math.floor(random() * moves.length)].move, side);
      side = opponent(side);
    }
  }
  return samples;
}
test('corner-neighbor penalty disappears when the corner is occupied; evaluation reverses with side', () => {
  const board = Array(64).fill(0); board[9] = BLACK;
  assert.equal(evaluatePosition(board, BLACK), -50);
  board[0] = BLACK;
  assert.equal(evaluatePosition(board, BLACK), 300);
  assert.equal(evaluatePosition(board, WHITE), -300);
});
test('alpha-beta equals independent minimax, including exact five-empty endgames', () => {
  for (const {board, side} of positions()) {
    const level = countDiscs(board).empty === 5 ? 4 : 1;
    const expected = reference(board, side, level + 1) * (side === BLACK ? 1 : -1);
    for (const lines of [1, 3]) {
      const actual = analyzePosition(board, side, level, lines);
      assert.equal(actual.lines[0].score, expected);
      for (const line of actual.lines) {
        let b = board, s = side;
        for (const move of line.moves) {
          if (move === PASS) assert.equal(legalMoves(b,s).length, 0);
          else { b = applyMove(b,move,s); assert.ok(b); }
          s = opponent(s);
        }
      }
      if (countDiscs(board).empty === 5) assert.ok(actual.lines[0].solved);
    }
  }
});
test('a full drawn board is a solved zero, even at level zero', () => {
  const board = Array.from({length:64}, (_,i) => i < 32 ? BLACK : WHITE);
  const result = analyzePosition(board, BLACK, 0);
  assert.equal(result.lines[0].score, 0);
  assert.equal(result.lines[0].solved, true);
});
