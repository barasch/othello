export const EMPTY = 0;
export const BLACK = 1;
export const WHITE = 2;
export const PASS = "pass";

const DIRECTIONS = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0],             [1, 0],
  [-1, 1],  [0, 1],   [1, 1],
];

export function opponent(side) {
  return side === BLACK ? WHITE : BLACK;
}

export function sideName(side) {
  return side === BLACK ? "Black" : "White";
}

export function initialBoard() {
  const board = new Array(64).fill(EMPTY);
  board[indexOf(3, 3)] = WHITE;
  board[indexOf(4, 4)] = WHITE;
  board[indexOf(4, 3)] = BLACK;
  board[indexOf(3, 4)] = BLACK;
  return board;
}

export function indexOf(column, row) {
  return row * 8 + column;
}

export function coordinateOf(index) {
  if (!Number.isInteger(index) || index < 0 || index >= 64) return "?";
  return `${String.fromCharCode(65 + (index % 8))}${Math.floor(index / 8) + 1}`;
}

export function flipsForMove(board, move, side) {
  if (!Array.isArray(board) || board.length !== 64 || board[move] !== EMPTY) return [];
  const column = move % 8;
  const row = Math.floor(move / 8);
  const other = opponent(side);
  const flips = [];

  for (const [dx, dy] of DIRECTIONS) {
    let x = column + dx;
    let y = row + dy;
    const line = [];

    while (x >= 0 && x < 8 && y >= 0 && y < 8) {
      const value = board[indexOf(x, y)];
      if (value === other) {
        line.push(indexOf(x, y));
        x += dx;
        y += dy;
        continue;
      }
      if (value === side && line.length) flips.push(...line);
      break;
    }
  }

  return flips;
}

export function legalMoves(board, side) {
  const moves = [];
  for (let move = 0; move < 64; move += 1) {
    const flips = flipsForMove(board, move, side);
    if (flips.length) moves.push({ move, flips });
  }
  return moves;
}

export function applyMove(board, move, side) {
  const flips = flipsForMove(board, move, side);
  if (!flips.length) return null;
  const next = board.slice();
  next[move] = side;
  for (const index of flips) next[index] = side;
  return next;
}

export function countDiscs(board) {
  let black = 0;
  let white = 0;
  for (const square of board) {
    if (square === BLACK) black += 1;
    if (square === WHITE) white += 1;
  }
  return { black, white, empty: 64 - black - white };
}

export function isTerminal(board) {
  return legalMoves(board, BLACK).length === 0 && legalMoves(board, WHITE).length === 0;
}

export function resultText(board, perspective = BLACK) {
  const { black, white } = countDiscs(board);
  if (black === white) return "Draw";
  const winner = black > white ? BLACK : WHITE;
  const margin = Math.abs(black - white);
  if (perspective === null) return `${sideName(winner)} by ${margin}`;
  return winner === perspective ? `Won by ${margin}` : `Lost by ${margin}`;
}

export function replayEvents(events, through = events.length) {
  let board = initialBoard();
  let side = BLACK;
  const applied = [];

  for (let i = 0; i < Math.min(through, events.length); i += 1) {
    const event = events[i];
    if (!event || event.side !== side) throw new Error(`Unexpected side at ply ${i + 1}`);
    if (event.move === PASS) {
      if (legalMoves(board, side).length) throw new Error(`Illegal pass at ply ${i + 1}`);
    } else {
      const next = applyMove(board, event.move, side);
      if (!next) throw new Error(`Illegal move at ply ${i + 1}`);
      board = next;
    }
    applied.push({ side, move: event.move });
    side = opponent(side);
  }

  return { board, side, applied };
}

export function advanceAfterMove(board, sideThatMoved) {
  const candidate = opponent(sideThatMoved);
  if (legalMoves(board, candidate).length) {
    return { nextSide: candidate, passedSide: null, gameOver: false };
  }
  if (legalMoves(board, sideThatMoved).length) {
    return { nextSide: sideThatMoved, passedSide: candidate, gameOver: false };
  }
  return { nextSide: candidate, passedSide: null, gameOver: true };
}
