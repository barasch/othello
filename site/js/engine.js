import { BLACK, PASS, coordinateOf, opponent } from "./rules.js";

const EMPTY = 0, EDGE = 3, INF = 10000, WIN = 8000;
const DIRECTIONS = [-1, -11, -10, -9, 1, 11, 10, 9];
const CORNERS = [11, 18, 81, 88];
const INNER_CORNERS = [22, 27, 72, 77];
const SQUARES = Array.from({ length: 64 }, (_, i) => (Math.floor(i / 8) + 1) * 10 + i % 8 + 1);
// Ordering changes search cost, never the value of a completed search.
const SEARCH_ORDER = [...CORNERS, ...SQUARES.filter((p) => !CORNERS.includes(p))];

function toSentinel(board) {
  const output = new Int8Array(100).fill(EDGE);
  SQUARES.forEach((p, i) => { output[p] = board[i]; });
  return output;
}
function toMove64(p) { return p === -1 ? PASS : (Math.floor(p / 10) - 1) * 8 + p % 10 - 1; }
function isLegal(board, p, side) {
  if (board[p] !== EMPTY) return false;
  const other = opponent(side);
  for (const direction of DIRECTIONS) {
    let cursor = p + direction;
    if (board[cursor] !== other) continue;
    do cursor += direction; while (board[cursor] === other);
    if (board[cursor] === side) return true;
  }
  return false;
}
function applyAt(board, p, side, buffer) {
  if (board[p] !== EMPTY) return 0;
  const other = opponent(side);
  let count = 0;
  for (const direction of DIRECTIONS) {
    let cursor = p + direction;
    const start = count;
    while (board[cursor] === other) {
      buffer[count++] = cursor;
      cursor += direction;
    }
    if (board[cursor] !== side) count = start;
  }
  if (!count) return 0;
  board[p] = side;
  for (let i = 0; i < count; i++) board[buffer[i]] = side;
  return count;
}
function undoAt(board, p, side, buffer, count) {
  board[p] = EMPTY;
  for (let i = 0; i < count; i++) board[buffer[i]] = opponent(side);
}
function staticValue(board, side) {
  const other = opponent(side);
  let value = 0;
  for (let i = 0; i < 4; i++) {
    const corner = board[CORNERS[i]], inner = board[INNER_CORNERS[i]];
    if (corner === side) value += 300;
    else if (corner === other) value -= 300;
    else value += inner === side ? -50 : inner === other ? 50 : 0;
  }
  // Put both sides' mobility at the same horizon. Unlike the original's
  // depth-dependent additions, this is antisymmetric and safe for alpha-beta.
  for (const p of SQUARES) {
    if (board[p] !== EMPTY) continue;
    if (isLegal(board, p, side)) value += 8;
    if (isLegal(board, p, other)) value -= 8;
  }
  return value;
}
function terminalValue(board, side) {
  let difference = 0;
  for (const p of SQUARES) difference += board[p] === side ? 1 : board[p] === opponent(side) ? -1 : 0;
  return difference ? Math.sign(difference) * WIN + difference : 0;
}
function stateFor() {
  return {
    nodes: 0, horizon: false, table: new Map(),
    buffers: Array.from({ length: 128 }, () => new Int8Array(64)),
    moves: Array.from({ length: 128 }, () => new Int16Array(64)),
    pv: Array.from({ length: 128 }, () => new Int16Array(128)),
    lengths: new Uint8Array(128),
  };
}
function recordPv(state, ply, move) {
  state.pv[ply][ply] = move;
  const length = state.lengths[ply + 1];
  for (let i = ply + 1; i < length; i++) state.pv[ply][i] = state.pv[ply + 1][i];
  state.lengths[ply] = Math.max(ply + 1, length);
}
function negamax(board, side, remaining, previousPass, alpha, beta, ply, state) {
  state.nodes++;
  state.lengths[ply] = ply;
  const moves = state.moves[ply];
  let count = 0;
  for (const p of SEARCH_ORDER) if (isLegal(board, p, side)) moves[count++] = p;
  // Resolve terminal positions and passes BEFORE the heuristic horizon.
  if (!count) {
    if (previousPass) return terminalValue(board, side);
    const score = -negamax(board, opponent(side), remaining, true, -beta, -alpha, ply + 1, state);
    recordPv(state, ply, -1);
    return score;
  }
  if (remaining === 0) { state.horizon = true; return staticValue(board, side); }
  const originalAlpha = alpha;
  const key = remaining >= 3 ? board.join('') + side + (previousPass ? 'p' : '') : null;
  const cached = key ? state.table.get(key) : null;
  if (cached && cached.depth === remaining && (cached.bound === 'exact' || (cached.bound === 'lower' && cached.score >= beta) || (cached.bound === 'upper' && cached.score <= alpha))) {
    state.horizon ||= cached.horizon;
    cached.line.forEach((move, i) => { state.pv[ply][ply + i] = move; });
    state.lengths[ply] = ply + cached.line.length;
    return cached.score;
  }
  let best = -INF;
  const buffer = state.buffers[ply];
  if (remaining >= 3 && count > 1) {
    const ranks = [];
    for (let i = 0; i < count; i++) {
      const p = moves[i];
      if (p === cached?.line[0]) { ranks.push({p, rank: 10000}); continue; }
      const flipped = applyAt(board, p, side, buffer);
      let mobility = 0;
      for (const q of SQUARES) if (isLegal(board, q, opponent(side))) mobility++;
      const corner = CORNERS.includes(p) ? 100 : 0;
      const near = INNER_CORNERS.indexOf(p);
      const penalty = near >= 0 && board[CORNERS[near]] === EMPTY ? 30 : 0;
      undoAt(board, p, side, buffer, flipped);
      ranks.push({p, rank: corner - penalty - mobility});
    }
    ranks.sort((a,b) => b.rank - a.rank);
    ranks.forEach(({p},i) => { moves[i] = p; });
  }
  for (let i = 0; i < count; i++) {
    const p = moves[i], flipped = applyAt(board, p, side, buffer);
    const score = -negamax(board, opponent(side), remaining - 1, false, -beta, -alpha, ply + 1, state);
    undoAt(board, p, side, buffer, flipped);
    if (score > best) { best = score; recordPv(state, ply, p); }
    if (score > alpha) alpha = score;
    if (alpha >= beta) break;
  }
  if (key) {
    if (state.table.size >= 100000) state.table.clear();
    state.table.set(key, {depth: remaining, score: best, bound: best <= originalAlpha ? 'upper' : best >= beta ? 'lower' : 'exact',
      line: Array.from(state.pv[ply].slice(ply,state.lengths[ply])), horizon: state.horizon});
  }
  return best;
}

export function evaluatePosition(board, side) { return staticValue(toSentinel(board), side); }
export function analyzePosition(board64, side, level, multiPv = 1) {
  const safeLevel = Math.max(0, Math.min(10, Math.trunc(level)));
  const safeLines = Math.max(1, Math.min(3, Math.trunc(multiPv)));
  const started = performance.now(), board = toSentinel(board64), state = stateFor();
  const candidates = [];
  const fullySearched = board64.filter((v) => v === EMPTY).length <= safeLevel + 1;
  let alpha = -INF, anyHorizon = false;
  for (const p of SQUARES) {
    const flipped = applyAt(board, p, side, state.buffers[0]);
    if (!flipped) continue;
    state.horizon = false;
    // The old level convention examines level + 1 placements including root.
    // A single requested line can share alpha across root moves.
    const score = -negamax(board, opponent(side), safeLevel, false, -INF, safeLines === 1 ? -alpha : INF, 1, state);
    undoAt(board, p, side, state.buffers[0], flipped);
    anyHorizon ||= state.horizon;
    if (safeLines === 1 && candidates.length && score <= alpha) continue;
    const moves = [toMove64(p)];
    for (let ply = 1; ply < state.lengths[1]; ply++) moves.push(toMove64(state.pv[1][ply]));
    candidates.push({ score, moves, solved: Math.abs(score) >= WIN || (score === 0 && (fullySearched || !state.horizon)) });
    alpha = Math.max(alpha, score);
  }
  if (!candidates.length) {
    state.horizon = false;
    const score = negamax(board, side, safeLevel + 1, false, -INF, INF, 0, state);
    const moves = [];
    for (let ply = 0; ply < state.lengths[0]; ply++) moves.push(toMove64(state.pv[0][ply]));
    candidates.push({ score, moves, solved: Math.abs(score) >= WIN || (score === 0 && (fullySearched || !state.horizon)) });
  }
  if (anyHorizon && !fullySearched) for (const c of candidates) if (c.score === 0) c.solved = false;
  candidates.sort((a, b) => b.score - a.score);
  const perspective = side === BLACK ? 1 : -1;
  return {
    level: safeLevel, nodes: state.nodes, elapsedMs: performance.now() - started,
    lines: candidates.slice(0, safeLines).map(({ score, moves, solved }) => ({ score: score * perspective || 0, moves, solved })),
  };
}
export function chooseMove(board, side, level) {
  const result = analyzePosition(board, side, level, 1);
  return { ...result, move: result.lines[0]?.moves[0] ?? PASS };
}
export function formatLine(moves) { return moves.map((m) => m === PASS ? "pass" : coordinateOf(m)).join(" "); }
