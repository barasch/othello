import {
  BLACK,
  WHITE,
  PASS,
  advanceAfterMove,
  applyMove,
  coordinateOf,
  countDiscs,
  flipsForMove,
  initialBoard,
  isTerminal,
  legalMoves,
  resultText,
  sideName,
} from "./rules.js";
import { formatLine } from "./engine.js";
import {
  addVariation,
  createAnalysisTree,
  flattenedTree,
  moveLabel,
  navigateTree,
  positionAtNode,
  selectNode,
} from "./tree.js";
import {
  analysisForGame,
  gameById,
  loadState,
  recentGames,
  saveState,
  storeAnalysis,
  storeGame,
} from "./storage.js";

const app = document.querySelector("#app");
const liveRegion = document.querySelector("#live-region");
const prefersDark = matchMedia("(prefers-color-scheme: dark)");

let persisted = loadState();
let screen = "start";
let game = null;
let analysisTree = null;
let analysisResult = null;
let menuOpen = false;
let worker = null;
let requestSerial = 0;

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function makeId(prefix) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`}`;
}

function announce(message) {
  liveRegion.textContent = "";
  requestAnimationFrame(() => { liveRegion.textContent = message; });
}

function applyTheme() {
  if (persisted.theme === "system") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = persisted.theme;
  const dark = persisted.theme === "dark" || (persisted.theme === "system" && prefersDark.matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#123b31" : "#fffff8");
}

function persist() {
  persisted = saveState(persisted);
  applyTheme();
}

function stopWorker() {
  worker?.terminate();
  worker = null;
  requestSerial += 1;
}

function randomColor() {
  const value = new Uint8Array(1);
  globalThis.crypto?.getRandomValues?.(value);
  return value[0] % 2 === 0 ? BLACK : WHITE;
}

function selectedPlayerColor() {
  if (persisted.playSettings.color === "black") return BLACK;
  if (persisted.playSettings.color === "white") return WHITE;
  return randomColor();
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Earlier";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(date);
}

function scoreForGame(record) {
  const { black, white } = record.counts;
  const result = record.result === "win" ? "Won" : record.result === "loss" ? "Lost" : "Draw";
  return `${result} · ${black}–${white}`;
}

function recentGameRows(action) {
  const games = recentGames(persisted);
  if (!games.length) return '<p class="empty-state">Completed games will appear here.</p>';
  return `
    <ol class="recent-list">
      ${games.map((record) => `
        <li>
          <button type="button" class="recent-game" data-action="${action}" data-game-id="${escapeHtml(record.id)}">
            <span class="recent-result">${scoreForGame(record)}</span>
            <span class="recent-meta">${formatDate(record.playedAt)} · Level ${record.difficulty} · played ${sideName(record.playerColor)}</span>
          </button>
        </li>
      `).join("")}
    </ol>`;
}

function rangeControl({ id, label, value, min, max, setting }) {
  return `
    <label class="range-setting" for="${id}">
      <span>${label}</span>
      <output id="${id}-output" for="${id}">${value}</output>
    </label>
    <div class="range-wrap">
      <span aria-hidden="true">${min}</span>
      <input id="${id}" type="range" min="${min}" max="${max}" step="1" value="${value}" data-setting="${setting}">
      <span aria-hidden="true">${max}</span>
    </div>`;
}

function renderStart() {
  const tab = persisted.activeTab;
  app.innerHTML = `
    <main class="start-screen">
      <section class="start-card" aria-labelledby="site-title">
        <header class="brand">
          <img src="assets/sb-mark.png" width="72" height="72" alt="">
          <h1 id="site-title">Othello</h1>
        </header>

        <div class="start-tabs" role="tablist" aria-label="Choose a mode">
          <button type="button" role="tab" aria-selected="${tab === "play"}" aria-controls="play-panel" id="play-tab" data-action="tab" data-tab="play">Play</button>
          <button type="button" role="tab" aria-selected="${tab === "analysis"}" aria-controls="analysis-panel" id="analysis-tab" data-action="tab" data-tab="analysis">Analysis</button>
        </div>

        <div class="tab-paper">
          ${tab === "play" ? `
            <section id="play-panel" role="tabpanel" aria-labelledby="play-tab">
              <div class="settings-block">
                ${rangeControl({ id: "difficulty", label: "Difficulty", value: persisted.playSettings.difficulty, min: 1, max: 10, setting: "difficulty" })}
                <fieldset class="color-setting">
                  <legend>Play as</legend>
                  <div class="segmented three-way">
                    ${["black", "random", "white"].map((color) => `
                      <label>
                        <input type="radio" name="player-color" value="${color}" data-setting="color" ${persisted.playSettings.color === color ? "checked" : ""}>
                        <span>${color[0].toUpperCase()}${color.slice(1)}</span>
                      </label>`).join("")}
                  </div>
                </fieldset>
              </div>
              <button type="button" class="primary-action" data-action="start-game">Start</button>
              <section class="recent-section" aria-labelledby="recent-play-title">
                <h2 id="recent-play-title">Previous scores</h2>
                ${recentGameRows("open-game-analysis")}
              </section>
            </section>
          ` : `
            <section id="analysis-panel" role="tabpanel" aria-labelledby="analysis-tab">
              <div class="settings-block">
                ${rangeControl({ id: "analysis-level", label: "Search level", value: persisted.analysisSettings.level, min: 1, max: 6, setting: "analysis-level" })}
                <fieldset class="line-setting">
                  <legend>Calculated lines</legend>
                  <div class="segmented">
                    ${[1, 2, 3].map((lines) => `
                      <label>
                        <input type="radio" name="analysis-lines" value="${lines}" data-setting="analysis-lines" ${persisted.analysisSettings.lines === lines ? "checked" : ""}>
                        <span>${lines}</span>
                      </label>`).join("")}
                  </div>
                </fieldset>
              </div>
              <button type="button" class="primary-action" data-action="new-analysis">New analysis</button>
              <section class="recent-section" aria-labelledby="recent-analysis-title">
                <h2 id="recent-analysis-title">Saved games</h2>
                ${recentGameRows("open-game-analysis")}
              </section>
            </section>
          `}
        </div>

        <footer class="start-footer">
          <span>© 2026 SB</span>
          <a href="https://github.com/barasch/othello/blob/main/LICENSE">CC BY-SA 4.0</a>
        </footer>
      </section>
    </main>`;
}

function latticeSvg() {
  const lines = Array.from({ length: 7 }, (_, i) => i + 1);
  return `
    <svg class="lattice" viewBox="0 0 8 8" aria-hidden="true" preserveAspectRatio="none">
      ${lines.map((n) => `<path d="M ${n} 0 V 8 M 0 ${n} H 8" vector-effect="non-scaling-stroke"/>`).join("")}
    </svg>`;
}

function boardMarkup({ board, legal = [], action, bestMove = null, changed = [] }) {
  const legalSet = new Set(legal.map(({ move }) => move));
  const changedSet = new Set(changed);
  return `
    <div class="board" role="group" aria-label="Othello position">
      ${latticeSvg()}
      ${board.map((square, index) => {
        const isLegal = legalSet.has(index);
        const label = `${coordinateOf(index)}, ${square ? sideName(square) : isLegal ? "legal move" : "empty"}`;
        return `
          <button type="button" class="square${isLegal ? " legal" : ""}${bestMove === index ? " best" : ""}" aria-label="${label}" data-action="${action}" data-move="${index}" ${isLegal ? "" : "disabled"}>
            ${square ? `<span class="disc ${square === BLACK ? "black" : "white"}${changedSet.has(index) ? " changed" : ""}" aria-hidden="true"></span>` : ""}
            ${isLegal ? '<span class="legal-marker" aria-hidden="true"></span>' : ""}
            ${bestMove === index ? '<span class="best-marker" aria-hidden="true"></span>' : ""}
          </button>`;
      }).join("")}
    </div>`;
}

function occupancyMarkup(board) {
  const counts = countDiscs(board);
  const occupied = Math.max(1, counts.black + counts.white);
  const whitePercent = counts.white / occupied * 100;
  const blackPercent = 100 - whitePercent;
  return `
    <div class="occupancy" role="img" aria-label="${counts.black} black and ${counts.white} white discs">
      <span class="occupancy-white" style="height:${whitePercent}%"></span>
      <span class="occupancy-black" style="height:${blackPercent}%"></span>
    </div>`;
}

function menuMarkup(mode) {
  return `
    <button type="button" class="menu-button" data-action="toggle-menu" aria-label="Menu" aria-expanded="${menuOpen}" aria-controls="game-menu">
      <span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>
    </button>
    ${menuOpen ? `
      <div class="menu-popover" id="game-menu">
        <a href="rules.html" target="_blank" rel="noopener">Rules &amp; strategy</a>
        <fieldset>
          <legend>Appearance</legend>
          <div class="menu-themes">
            ${["light", "system", "dark"].map((theme) => `<button type="button" data-action="theme" data-theme="${theme}" aria-pressed="${persisted.theme === theme}">${theme[0].toUpperCase()}${theme.slice(1)}</button>`).join("")}
          </div>
        </fieldset>
        ${mode === "play" ? '<button type="button" data-action="restart">Restart game</button>' : '<button type="button" data-action="new-analysis">New analysis</button>'}
        <button type="button" data-action="start-screen">Start screen</button>
      </div>` : ""}`;
}

function resultDialog() {
  if (!game?.completed || !game.record) return "";
  const { black, white } = game.record.counts;
  return `
    <div class="modal-backdrop">
      <section class="result-dialog" role="dialog" aria-modal="true" aria-labelledby="result-title">
        <p class="eyebrow">Game over</p>
        <h2 id="result-title">${resultText(game.board, game.humanColor)}</h2>
        <p class="final-score"><span>Black ${black}</span><span>White ${white}</span></p>
        <div class="dialog-actions">
          <button type="button" class="primary-action" data-action="analyze-finished">Analyze game</button>
          <button type="button" data-action="restart">Play again</button>
        </div>
      </section>
    </div>`;
}

function renderPlay() {
  const humanTurn = !game.completed && !game.thinking && game.side === game.humanColor;
  const legal = humanTurn ? legalMoves(game.board, game.side) : [];
  app.innerHTML = `
    <main class="game-screen${game.thinking ? " thinking" : ""}">
      ${menuMarkup("play")}
      <div class="play-surface">
        ${boardMarkup({ board: game.board, legal, action: "play-move", changed: game.changed })}
        ${occupancyMarkup(game.board)}
      </div>
      ${resultDialog()}
    </main>`;
}

function beginGame() {
  stopWorker();
  const humanColor = selectedPlayerColor();
  game = {
    board: initialBoard(),
    side: BLACK,
    humanColor,
    difficulty: persisted.playSettings.difficulty,
    moves: [],
    startedAt: new Date().toISOString(),
    thinking: false,
    completed: false,
    changed: [],
    record: null,
  };
  screen = "play";
  menuOpen = false;
  renderPlay();
  announce(`New game. You are ${sideName(humanColor)}.`);
  if (humanColor === WHITE) beginComputerMove();
}

function finishGame() {
  const counts = countDiscs(game.board);
  const playerCount = game.humanColor === BLACK ? counts.black : counts.white;
  const computerCount = game.humanColor === BLACK ? counts.white : counts.black;
  const result = playerCount === computerCount ? "draw" : playerCount > computerCount ? "win" : "loss";
  const record = {
    id: makeId("game"),
    playedAt: new Date().toISOString(),
    difficulty: game.difficulty,
    playerColor: game.humanColor,
    result,
    counts: { black: counts.black, white: counts.white },
    moves: game.moves.slice(),
  };
  game.completed = true;
  game.thinking = false;
  game.record = record;
  persisted = storeGame(persisted, record);
  stopWorker();
  renderPlay();
  announce(`Game over. ${resultText(game.board, game.humanColor)}. Black ${counts.black}, White ${counts.white}.`);
  requestAnimationFrame(() => document.querySelector(".result-dialog .primary-action")?.focus());
}

function performGameMove(move, side) {
  if (game.completed || game.side !== side) return;
  const flips = flipsForMove(game.board, move, side);
  const next = applyMove(game.board, move, side);
  if (!next) return;
  game.board = next;
  game.moves.push({ side, move });
  game.changed = [move, ...flips];
  const advance = advanceAfterMove(game.board, side);
  if (advance.passedSide !== null) {
    game.moves.push({ side: advance.passedSide, move: PASS });
    announce(`${sideName(advance.passedSide)} has no legal move and passes.`);
  }
  game.side = advance.nextSide;
  if (advance.gameOver) {
    finishGame();
    return;
  }
  renderPlay();
  if (game.side !== game.humanColor) beginComputerMove();
}

function beginComputerMove() {
  if (!game || game.completed || game.side === game.humanColor) return;
  stopWorker();
  game.thinking = true;
  renderPlay();
  announce(`${sideName(game.side)} is calculating.`);
  const requestId = ++requestSerial;
  const side = game.side;
  worker = new Worker(new URL("./ai.worker.js", import.meta.url), { type: "module" });
  worker.addEventListener("message", ({ data }) => {
    if (data?.type !== "move" || data.requestId !== requestId || screen !== "play" || !game) return;
    stopWorker();
    game.thinking = false;
    if (data.result.move === PASS) {
      game.moves.push({ side, move: PASS });
      game.side = side === BLACK ? WHITE : BLACK;
      renderPlay();
      return;
    }
    performGameMove(data.result.move, side);
  });
  worker.addEventListener("error", () => {
    stopWorker();
    if (!game || screen !== "play") return;
    game.thinking = false;
    renderPlay();
    announce("The computer could not finish that calculation. Restart the game to try again.");
  });
  worker.postMessage({ type: "move", requestId, board: game.board, side, level: game.difficulty });
}

function showStart(tab = persisted.activeTab) {
  stopWorker();
  screen = "start";
  game = null;
  analysisTree = null;
  analysisResult = null;
  menuOpen = false;
  persisted.activeTab = tab;
  persist();
  renderStart();
}

function openAnalysis(gameRecord = null) {
  stopWorker();
  const saved = gameRecord ? analysisForGame(persisted, gameRecord.id) : null;
  analysisTree = saved ?? createAnalysisTree(gameRecord);
  analysisResult = null;
  screen = "analysis";
  menuOpen = false;
  persisted = storeAnalysis(persisted, analysisTree);
  renderAnalysis();
  requestAnalysis();
}

function formatScore(value) {
  if (value > 0) return `+${value}`;
  if (value < 0) return `−${Math.abs(value)}`;
  return "0";
}

function analysisHeader(board) {
  if (isTerminal(board)) {
    const counts = countDiscs(board);
    return `
      <div class="analysis-value terminal">
        <strong>${resultText(board, null)}</strong>
        <span>Black ${counts.black} · White ${counts.white}</span>
      </div>`;
  }
  if (!analysisResult) {
    return `
      <div class="analysis-value pending">
        <strong>Calculating</strong>
        <span>through level ${persisted.analysisSettings.level}</span>
      </div>`;
  }
  const score = analysisResult.lines[0]?.score ?? 0;
  return `
    <div class="analysis-value">
      <strong>${formatScore(score)}</strong>
      <span>Black perspective · level ${analysisResult.level} of ${persisted.analysisSettings.level}</span>
      <small>${analysisResult.nodes.toLocaleString()} nodes · ${Math.round(analysisResult.elapsedMs).toLocaleString()} ms</small>
    </div>`;
}

function calculatedLines() {
  if (!analysisResult?.lines?.length) return '<p class="empty-state compact">No calculated line yet.</p>';
  return `
    <ol class="calculated-lines">
      ${analysisResult.lines.map((line) => `
        <li><span class="line-score">${formatScore(line.score)}</span><span>${escapeHtml(formatLine(line.moves)) || "—"}</span></li>
      `).join("")}
    </ol>`;
}

function treeMarkup() {
  const rows = flattenedTree(analysisTree);
  if (!rows.length) return '<p class="empty-state compact">Choose a legal move on the lattice to begin a variation.</p>';
  return `
    <ol class="move-tree">
      ${rows.map(({ node, variationDepth, ply }) => `
        <li style="--branch-depth:${Math.min(variationDepth, 6)}">
          <button type="button" data-action="select-node" data-node-id="${escapeHtml(node.id)}" aria-current="${node.id === analysisTree.currentNodeId ? "step" : "false"}" class="${node.source}">
            <span>${moveLabel(node, ply)}</span>
            ${node.source === "played" ? '<small>game</small>' : ""}
          </button>
        </li>
      `).join("")}
    </ol>`;
}

function renderAnalysis() {
  const { board, side } = positionAtNode(analysisTree);
  const legal = isTerminal(board) ? [] : legalMoves(board, side);
  const bestMove = analysisResult?.lines?.[0]?.moves?.[0];
  app.innerHTML = `
    <main class="analysis-screen">
      ${menuMarkup("analysis")}
      <div class="analysis-layout">
        <div class="analysis-board-wrap">
          <div class="play-surface">
            ${boardMarkup({ board, legal, action: "analysis-move", bestMove: Number.isInteger(bestMove) ? bestMove : null })}
            ${occupancyMarkup(board)}
          </div>
        </div>
        <aside class="analysis-panel" aria-label="Position analysis">
          <header>
            <p class="eyebrow">${sideName(side)} to move</p>
            ${analysisHeader(board)}
          </header>
          <section class="panel-section" aria-labelledby="line-title">
            <h2 id="line-title">Calculated line</h2>
            ${calculatedLines()}
          </section>
          <section class="panel-section tree-section" aria-labelledby="tree-title">
            <h2 id="tree-title">Moves</h2>
            <div class="tree-scroll">${treeMarkup()}</div>
          </section>
          <nav class="analysis-nav" aria-label="Move navigation">
            <button type="button" data-action="navigate" data-direction="first" aria-label="First position">│‹</button>
            <button type="button" data-action="navigate" data-direction="previous" aria-label="Previous move">‹</button>
            <button type="button" data-action="navigate" data-direction="next" aria-label="Next move">›</button>
            <button type="button" data-action="navigate" data-direction="last" aria-label="Last position on selected line">›│</button>
          </nav>
        </aside>
      </div>
    </main>`;
}

function saveCurrentAnalysis() {
  persisted = storeAnalysis(persisted, analysisTree);
}

function requestAnalysis() {
  stopWorker();
  const { board, side } = positionAtNode(analysisTree);
  analysisResult = null;
  if (isTerminal(board)) {
    renderAnalysis();
    return;
  }
  renderAnalysis();
  const requestId = ++requestSerial;
  worker = new Worker(new URL("./ai.worker.js", import.meta.url), { type: "module" });
  worker.addEventListener("message", ({ data }) => {
    if (data?.type !== "analysis" || data.requestId !== requestId || screen !== "analysis") return;
    analysisResult = data.result;
    renderAnalysis();
    if (data.complete) stopWorker();
  });
  worker.addEventListener("error", () => {
    stopWorker();
    if (screen === "analysis") announce("The analysis calculation stopped unexpectedly.");
  });
  worker.postMessage({
    type: "analyze",
    requestId,
    board,
    side,
    maxLevel: persisted.analysisSettings.level,
    multiPv: persisted.analysisSettings.lines,
  });
}

app.addEventListener("input", (event) => {
  const input = event.target.closest("input[data-setting]");
  if (!input) return;
  const setting = input.dataset.setting;
  if (setting === "difficulty") {
    persisted.playSettings.difficulty = Number(input.value);
    document.querySelector("#difficulty-output").value = input.value;
  }
  if (setting === "analysis-level") {
    persisted.analysisSettings.level = Number(input.value);
    document.querySelector("#analysis-level-output").value = input.value;
  }
  if (setting === "color") persisted.playSettings.color = input.value;
  if (setting === "analysis-lines") persisted.analysisSettings.lines = Number(input.value);
  persist();
});

app.addEventListener("click", (event) => {
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const action = control.dataset.action;

  if (action === "tab") {
    persisted.activeTab = control.dataset.tab;
    persist();
    renderStart();
  }
  if (action === "start-game") beginGame();
  if (action === "new-analysis") openAnalysis();
  if (action === "open-game-analysis") {
    const record = gameById(persisted, control.dataset.gameId);
    if (record) openAnalysis(record);
  }
  if (action === "play-move" && game && !game.thinking && game.side === game.humanColor) {
    performGameMove(Number(control.dataset.move), game.humanColor);
  }
  if (action === "toggle-menu") {
    menuOpen = !menuOpen;
    screen === "play" ? renderPlay() : renderAnalysis();
  }
  if (action === "theme") {
    persisted.theme = control.dataset.theme;
    persist();
    screen === "play" ? renderPlay() : screen === "analysis" ? renderAnalysis() : renderStart();
  }
  if (action === "restart") showStart("play");
  if (action === "start-screen") showStart(screen === "analysis" ? "analysis" : "play");
  if (action === "analyze-finished" && game?.record) openAnalysis(game.record);
  if (action === "analysis-move" && analysisTree) {
    try {
      addVariation(analysisTree, Number(control.dataset.move));
      saveCurrentAnalysis();
      requestAnalysis();
    } catch (error) {
      announce(error.message);
    }
  }
  if (action === "select-node" && analysisTree && selectNode(analysisTree, control.dataset.nodeId)) {
    saveCurrentAnalysis();
    requestAnalysis();
  }
  if (action === "navigate" && analysisTree) {
    navigateTree(analysisTree, control.dataset.direction);
    saveCurrentAnalysis();
    requestAnalysis();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menuOpen) {
    menuOpen = false;
    screen === "play" ? renderPlay() : renderAnalysis();
    document.querySelector(".menu-button")?.focus();
    return;
  }
  if (screen !== "analysis" || event.target.matches("input, button, a")) return;
  if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) event.preventDefault();
  if (event.key === "ArrowLeft") navigateTree(analysisTree, "previous");
  else if (event.key === "ArrowRight") navigateTree(analysisTree, "next");
  else if (event.key === "Home") navigateTree(analysisTree, "first");
  else if (event.key === "End") navigateTree(analysisTree, "last");
  else return;
  saveCurrentAnalysis();
  requestAnalysis();
});

prefersDark.addEventListener("change", () => {
  if (persisted.theme === "system") applyTheme();
});

applyTheme();
renderStart();
