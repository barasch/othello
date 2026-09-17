import { PASS, advanceAfterMove } from "./rules.js";

export const COMPUTER_MOVE_DELAY_MS = 1_000;

export function lastPlacement(events) {
  if (!Array.isArray(events)) return null;
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (Number.isInteger(events[index]?.move)) return events[index].move;
  }
  return null;
}

export function resolveTurnAfterPlacement(board, sideThatMoved, humanColor) {
  const advance = advanceAfterMove(board, sideThatMoved);
  if (advance.gameOver) {
    return {
      nextSide: advance.nextSide,
      gameOver: true,
      humanMustPass: false,
      automaticPass: null,
    };
  }

  const humanMustPass = advance.passedSide === humanColor;
  const automaticPass = advance.passedSide !== null && !humanMustPass
    ? { side: advance.passedSide, move: PASS }
    : null;

  return {
    nextSide: humanMustPass ? humanColor : advance.nextSide,
    gameOver: false,
    humanMustPass,
    automaticPass,
  };
}

export const DIFFICULTY_LEVELS = [null, null, 1, 4, 7, 10];
export function engineLevel(difficulty) { return DIFFICULTY_LEVELS[difficulty] ?? null; }
export function randomLegalMove(moves, random = Math.random) {
  return moves.length ? moves[Math.min(moves.length - 1, Math.floor(random() * moves.length))].move : PASS;
}
