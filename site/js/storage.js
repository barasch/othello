import { BLACK, WHITE, PASS } from "./rules.js";
import { normalizeTree } from "./tree.js";

const STORAGE_KEY = "sb.othello.v2";
const MAX_GAMES = 50;
const MAX_ANALYSES = 20;

export const DEFAULT_STATE = Object.freeze({
  version: 2,
  theme: "system",
  tiles: "black-white",
  palette: 0,
  activeTab: "play",
  playSettings: { difficulty: 3, color: "random", opening: "standard" },
  analysisSettings: { level: 4, lines: 1 },
  games: [],
  analyses: [],
});

function integerBetween(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum ? number : fallback;
}

function normalizeMove(event) {
  if (!event || (event.side !== BLACK && event.side !== WHITE)) return null;
  if (event.move === PASS) return { side: event.side, move: PASS };
  const move = Number(event.move);
  if (!Number.isInteger(move) || move < 0 || move >= 64) return null;
  return { side: event.side, move };
}

function normalizeOpeningSequence(value) {
  const sequence = String(value ?? "").trim().toLowerCase();
  return /^(?:[a-h][1-8]){1,8}$/.test(sequence) ? sequence : null;
}

function normalizeGame(game) {
  if (!game || typeof game !== "object" || !Array.isArray(game.moves)) return null;
  const moves = game.moves.map(normalizeMove).filter(Boolean);
  const playerColor = game.playerColor === WHITE ? WHITE : BLACK;
  const black = integerBetween(game.counts?.black, 0, 64, 2);
  const white = integerBetween(game.counts?.white, 0, 64, 2);
  const opening = game.opening === "xot" ? "xot" : "standard";
  return {
    id: String(game.id || `${Date.now()}`),
    playedAt: String(game.playedAt || new Date().toISOString()),
    difficulty: integerBetween(game.difficulty, 1, 5, 5),
    playerColor,
    opening,
    openingSequence: opening === "xot" ? normalizeOpeningSequence(game.openingSequence) : null,
    result: ["win", "loss", "draw"].includes(game.result) ? game.result : "draw",
    counts: { black, white },
    moves,
  };
}

export function normalizeState(value) {
  const source = value && typeof value === "object" ? value : {};
  const color = ["black", "random", "white"].includes(source.playSettings?.color)
    ? source.playSettings.color
    : DEFAULT_STATE.playSettings.color;
  const opening = source.playSettings?.opening === "xot" ? "xot" : "standard";
  const games = Array.isArray(source.games) ? source.games.map(normalizeGame).filter(Boolean) : [];
  const analyses = Array.isArray(source.analyses) ? source.analyses.map(normalizeTree).filter(Boolean) : [];
  return {
    version: 2,
    theme: ["system", "light", "dark"].includes(source.theme) ? source.theme : DEFAULT_STATE.theme,
    tiles: source.tiles === "colors" ? "colors" : "black-white",
    palette: integerBetween(source.palette, 0, 3, 0),
    activeTab: source.activeTab === "analysis" ? "analysis" : "play",
    playSettings: {
      difficulty: integerBetween(source.playSettings?.difficulty, 1, 5, DEFAULT_STATE.playSettings.difficulty),
      color,
      opening,
    },
    analysisSettings: {
      level: integerBetween(source.analysisSettings?.level, 1, 6, DEFAULT_STATE.analysisSettings.level),
      lines: integerBetween(source.analysisSettings?.lines, 1, 3, DEFAULT_STATE.analysisSettings.lines),
    },
    games: games.slice(0, MAX_GAMES),
    analyses: analyses.slice(0, MAX_ANALYSES),
  };
}

export function loadState() {
  try {
    return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"));
  } catch {
    return normalizeState(null);
  }
}

export function saveState(state) {
  const normalized = normalizeState(state);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // The game remains usable when browser storage is disabled or full.
  }
  return normalized;
}

export function storeGame(state, game) {
  state.games = [normalizeGame(game), ...state.games.filter((entry) => entry.id !== game.id)]
    .filter(Boolean)
    .slice(0, MAX_GAMES);
  return saveState(state);
}

export function storeAnalysis(state, tree) {
  const normalized = normalizeTree(tree);
  if (!normalized) return saveState(state);
  state.analyses = [normalized, ...state.analyses.filter((entry) => entry.id !== normalized.id)]
    .slice(0, MAX_ANALYSES);
  return saveState(state);
}

export function gameById(state, id) {
  return state.games.find((game) => game.id === id) ?? null;
}

export function analysisForGame(state, gameId) {
  return state.analyses.find((tree) => tree.gameId === gameId) ?? null;
}

export function recentGames(state, limit = 5) {
  return state.games.slice(0, limit);
}
