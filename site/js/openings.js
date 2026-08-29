import {
  BLACK,
  PASS,
  WHITE,
  advanceAfterMove,
  applyMove,
  initialBoard,
} from "./rules.js";

const XOT_LINE = /^(?:[a-h][1-8]){8}$/;
const OPENING_SEQUENCE = /^(?:[a-h][1-8]){1,8}$/;

function coordinates(sequence) {
  const normalized = String(sequence ?? "").trim().toLowerCase();
  if (!OPENING_SEQUENCE.test(normalized)) {
    throw new Error("The opening sequence is not valid");
  }
  return normalized.match(/[a-h][1-8]/g);
}

function moveFromCoordinate(coordinate) {
  const column = coordinate.charCodeAt(0) - 97;
  const row = Number(coordinate[1]) - 1;
  return row * 8 + column;
}

export function parseXotList(text) {
  const lines = String(text ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim().toLowerCase())
    .filter(Boolean);

  if (!lines.length || lines.some((line) => !XOT_LINE.test(line))) {
    throw new Error("The XOT opening list is not valid");
  }
  return lines;
}

export function replayOpening(sequence) {
  const moves = coordinates(sequence);
  let board = initialBoard();
  let side = BLACK;
  const events = [];

  for (const [index, coordinate] of moves.entries()) {
    const move = moveFromCoordinate(coordinate);
    const next = applyMove(board, move, side);
    if (!next) throw new Error(`Illegal opening move ${coordinate} at ply ${index + 1}`);

    board = next;
    events.push({ side, move });
    const advance = advanceAfterMove(board, side);
    if (advance.gameOver && index < moves.length - 1) {
      throw new Error(`Opening continues after the game ends at ply ${index + 1}`);
    }
    if (advance.passedSide !== null) {
      events.push({ side: advance.passedSide, move: PASS });
    }
    side = advance.nextSide;
  }

  return { board, side, events, sequence: moves.join("") };
}

export function prepareXotOpening(sequence, humanColor) {
  if (humanColor !== BLACK && humanColor !== WHITE) {
    throw new Error("The player color is not valid");
  }

  const sourceSequence = coordinates(sequence).join("");
  let prepared = replayOpening(sourceSequence);
  if (humanColor === BLACK && prepared.side === WHITE) {
    const shortened = coordinates(sourceSequence).slice(0, -1).join("");
    prepared = replayOpening(shortened);
  }
  return { ...prepared, sourceSequence };
}
