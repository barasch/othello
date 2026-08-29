import { BLACK, WHITE, PASS, coordinateOf, opponent } from "./rules.js";

const EMPTY = 0;
const EDGE = 3;
const INF = 9000;
const DIRECTIONS = [-1, -11, -10, -9, 1, 11, 10, 9];
const CORNERS = [11, 18, 81, 88];
const INNER_CORNERS = [22, 27, 72, 77];
const MAX_PLY = 80;

function toSentinel(board) {
  const output = new Int8Array(100);
  output.fill(EDGE);
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      output[(row + 1) * 10 + column + 1] = board[row * 8 + column];
    }
  }
  return output;
}

function toMove64(position) {
  if (position === -1) return PASS;
  return (Math.floor(position / 10) - 1) * 8 + (position % 10) - 1;
}

function applyAt(board, position, side, buffer) {
  if (board[position] !== EMPTY) return 0;
  const other = opponent(side);
  let count = 0;

  for (const direction of DIRECTIONS) {
    let cursor = position + direction;
    const start = count;
    while (board[cursor] === other) {
      buffer[count] = cursor;
      count += 1;
      cursor += direction;
    }
    if (board[cursor] !== side) count = start;
  }

  if (!count) return 0;
  board[position] = side;
  for (let i = 0; i < count; i += 1) board[buffer[i]] = side;
  return count;
}

function undoAt(board, position, side, buffer, count) {
  board[position] = EMPTY;
  const other = opponent(side);
  for (let i = 0; i < count; i += 1) board[buffer[i]] = other;
}

function staticValue(board, side) {
  const other = opponent(side);
  let value = 0;
  for (let i = 0; i < 4; i += 1) {
    const corner = board[CORNERS[i]];
    const inner = board[INNER_CORNERS[i]];
    value += corner === side ? 300 : corner === other ? -300 : 0;
    value += inner === side ? -50 : inner === other ? 50 : 0;
  }
  return value;
}

function terminalValue(board, side) {
  const other = opponent(side);
  let difference = 0;
  for (let row = 1; row <= 8; row += 1) {
    for (let column = 1; column <= 8; column += 1) {
      const value = board[row * 10 + column];
      if (value === side) difference += 1;
      if (value === other) difference -= 1;
    }
  }
  if (difference > 0) return 8000 + difference;
  if (difference < 0) return -8000 + difference;
  return 0;
}

function createSearchState(level) {
  return {
    level,
    nodes: 0,
    buffers: Array.from({ length: MAX_PLY }, () => new Int8Array(64)),
    pv: Array.from({ length: MAX_PLY }, () => new Int16Array(MAX_PLY).fill(-2)),
    pvLength: new Uint8Array(MAX_PLY),
  };
}

function recordPv(state, ply, move) {
  const row = state.pv[ply];
  row[ply] = move;
  const childLength = state.pvLength[ply + 1];
  for (let i = ply + 1; i < childLength; i += 1) row[i] = state.pv[ply + 1][i];
  state.pvLength[ply] = Math.max(ply + 1, childLength);
}

function negamax(board, side, depth, previousPass, alpha, beta, ply, state) {
  state.nodes += 1;
  state.pvLength[ply] = ply;

  if (depth > state.level) return staticValue(board, side);

  let best = depth < state.level - 1 ? alpha : -INF;
  let legalCount = 0;
  const buffer = state.buffers[ply];

  for (let row = 1; row <= 8; row += 1) {
    for (let column = 1; column <= 8; column += 1) {
      const position = row * 10 + column;
      const flipped = applyAt(board, position, side, buffer);
      if (!flipped) continue;
      legalCount += 1;
      const value = -negamax(
        board,
        opponent(side),
        depth + 1,
        false,
        -beta,
        -best,
        ply + 1,
        state,
      );
      undoAt(board, position, side, buffer, flipped);

      if (value > best) {
        best = value;
        recordPv(state, ply, position);
        if (best >= beta || best >= 8003) return best;
      }
    }
  }

  if (!legalCount) {
    if (previousPass) return terminalValue(board, side);
    best = -negamax(board, opponent(side), depth + 1, true, -beta, -best, ply + 1, state);
    recordPv(state, ply, -1);
  }

  return depth >= state.level - 1 ? best + legalCount * 8 : best;
}

function rootLines(board64, side, level) {
  const board = toSentinel(board64);
  const candidates = [];

  for (let row = 1; row <= 8; row += 1) {
    for (let column = 1; column <= 8; column += 1) {
      const position = row * 10 + column;
      const state = createSearchState(level);
      const flipped = applyAt(board, position, side, state.buffers[0]);
      if (!flipped) continue;
      const score = -negamax(board, opponent(side), 1, false, -INF, INF, 1, state);
      undoAt(board, position, side, state.buffers[0], flipped);
      const moves = [toMove64(position)];
      for (let ply = 1; ply < state.pvLength[1]; ply += 1) {
        moves.push(toMove64(state.pv[1][ply]));
      }
      candidates.push({ score, moves, nodes: state.nodes });
    }
  }

  if (!candidates.length) {
    const state = createSearchState(level);
    const score = negamax(board, side, 0, false, -INF, INF, 0, state);
    const moves = [];
    for (let ply = 0; ply < state.pvLength[0]; ply += 1) moves.push(toMove64(state.pv[0][ply]));
    candidates.push({ score, moves, nodes: state.nodes });
  }

  candidates.sort((a, b) => b.score - a.score || String(a.moves[0]).localeCompare(String(b.moves[0])));
  return candidates;
}

export function analyzePosition(board, side, level, multiPv = 1) {
  const safeLevel = Math.max(0, Math.min(10, Math.trunc(level)));
  const safeLines = Math.max(1, Math.min(3, Math.trunc(multiPv)));
  const started = performance.now();
  const candidates = rootLines(board, side, safeLevel);
  const elapsedMs = performance.now() - started;
  const perspective = side === BLACK ? 1 : -1;
  const nodes = candidates.reduce((total, line) => total + line.nodes, 0);

  return {
    level: safeLevel,
    nodes,
    elapsedMs,
    lines: candidates.slice(0, safeLines).map((line) => ({
      score: line.score * perspective,
      moves: line.moves,
    })),
  };
}

export function chooseMove(board, side, level) {
  const result = analyzePosition(board, side, level, 1);
  return {
    ...result,
    move: result.lines[0]?.moves[0] ?? PASS,
  };
}

export function formatLine(moves) {
  return moves.map((move) => move === PASS ? "pass" : coordinateOf(move)).join(" ");
}
