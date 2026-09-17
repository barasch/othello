import {
  BLACK,
  PASS,
  advanceAfterMove,
  applyMove,
  coordinateOf,
  initialBoard,
  legalMoves,
  opponent,
  replayEvents,
} from "./rules.js";

function makeId(prefix = "node") {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}-${random}`;
}

function rootNode() {
  return {
    id: "root",
    parentId: null,
    move: null,
    side: null,
    children: [],
    preferredChildId: null,
    source: "analysis",
  };
}

export function createAnalysisTree(game = null) {
  const tree = {
    id: game ? `game-${game.id}` : makeId("analysis"),
    gameId: game?.id ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    rootId: "root",
    currentNodeId: "root",
    nodes: { root: rootNode() },
  };

  if (!game?.moves?.length) return tree;

  replayEvents(game.moves);
  let parent = tree.nodes.root;
  for (const event of game.moves) {
    const node = {
      id: makeId("played"),
      parentId: parent.id,
      move: event.move,
      side: event.side,
      children: [],
      preferredChildId: null,
      source: "played",
    };
    tree.nodes[node.id] = node;
    parent.children.push(node.id);
    parent.preferredChildId = node.id;
    parent = node;
  }
  tree.currentNodeId = parent.id;
  return tree;
}

export function normalizeTree(value) {
  if (!value || typeof value !== "object" || !value.nodes?.root) return null;
  const nodes = {};
  for (const [id, candidate] of Object.entries(value.nodes)) {
    if (!candidate || candidate.id !== id || !Array.isArray(candidate.children)) continue;
    nodes[id] = {
      id,
      parentId: candidate.parentId ?? null,
      move: candidate.move ?? null,
      side: candidate.side ?? null,
      children: candidate.children.filter((childId) => typeof childId === "string"),
      preferredChildId: candidate.preferredChildId ?? null,
      source: candidate.source === "played" ? "played" : "analysis",
    };
  }
  if (!nodes.root) return null;
  return {
    id: String(value.id || makeId("analysis")),
    gameId: value.gameId ? String(value.gameId) : null,
    createdAt: String(value.createdAt || new Date().toISOString()),
    updatedAt: String(value.updatedAt || new Date().toISOString()),
    rootId: "root",
    currentNodeId: nodes[value.currentNodeId] ? value.currentNodeId : "root",
    nodes,
  };
}

export function pathToNode(tree, nodeId = tree.currentNodeId) {
  const path = [];
  let cursor = tree.nodes[nodeId];
  const seen = new Set();
  while (cursor && cursor.id !== tree.rootId && !seen.has(cursor.id)) {
    seen.add(cursor.id);
    path.push(cursor);
    cursor = tree.nodes[cursor.parentId];
  }
  return path.reverse();
}

export function positionAtNode(tree, nodeId = tree.currentNodeId) {
  const events = pathToNode(tree, nodeId).map(({ side, move }) => ({ side, move }));
  return replayEvents(events);
}

function addChild(tree, parent, move, side, source) {
  const existing = parent.children
    .map((id) => tree.nodes[id])
    .find((node) => node && node.move === move && node.side === side);
  if (existing) return existing;

  const node = {
    id: makeId(source),
    parentId: parent.id,
    move,
    side,
    children: [],
    preferredChildId: null,
    source,
  };
  tree.nodes[node.id] = node;
  parent.children.push(node.id);
  if (!parent.preferredChildId) parent.preferredChildId = node.id;
  return node;
}

export function addVariation(tree, move) {
  const parent = tree.nodes[tree.currentNodeId];
  if (!parent) throw new Error("Selected analysis node is missing");
  const { board, side } = positionAtNode(tree, parent.id);
  const nextBoard = applyMove(board, move, side);
  if (!nextBoard) throw new Error("That move is not legal in this position");

  let node = addChild(tree, parent, move, side, "analysis");
  const advance = advanceAfterMove(nextBoard, side);
  if (advance.passedSide !== null) {
    node = addChild(tree, node, PASS, advance.passedSide, "analysis");
  }
  selectNode(tree, node.id);
  tree.updatedAt = new Date().toISOString();
  return node;
}

export function selectNode(tree, nodeId) {
  if (!tree.nodes[nodeId]) return false;
  tree.currentNodeId = nodeId;
  for (const node of pathToNode(tree, nodeId)) {
    if (tree.nodes[node.parentId]) tree.nodes[node.parentId].preferredChildId = node.id;
  }
  tree.updatedAt = new Date().toISOString();
  return true;
}

export function navigateTree(tree, direction) {
  let node = tree.nodes[tree.currentNodeId];
  if (!node) return tree.rootId;

  if (direction === "first") node = tree.nodes[tree.rootId];
  if (direction === "previous" && node.parentId) node = tree.nodes[node.parentId];
  if (direction === "next") {
    const childId = node.preferredChildId || node.children[0];
    if (childId && tree.nodes[childId]) node = tree.nodes[childId];
  }
  if (direction === "last") {
    while (node.preferredChildId || node.children[0]) {
      const childId = node.preferredChildId || node.children[0];
      if (!tree.nodes[childId]) break;
      node = tree.nodes[childId];
    }
  }

  tree.currentNodeId = node.id;
  return node.id;
}

export function flattenedTree(tree) {
  const rows = [];
  const visit = (nodeId, variationDepth, ply) => {
    const node = tree.nodes[nodeId];
    if (!node) return;
    if (nodeId !== tree.rootId) rows.push({ node, variationDepth, ply });

    const children = node.children.filter((id) => tree.nodes[id]);
    const preferred = node.preferredChildId && children.includes(node.preferredChildId)
      ? node.preferredChildId
      : children[0];
    for (const childId of children.filter((id) => id !== preferred)) {
      visit(childId, variationDepth + 1, ply + 1);
    }
    if (preferred) visit(preferred, variationDepth, ply + 1);
  };
  visit(tree.rootId, 0, 0);
  return rows;
}

export function moveLabel(node, ply) {
  const number = Math.floor((ply - 1) / 2) + 1;
  const prefix = node.side === BLACK ? `${number}.` : `${number}…`;
  const move = node.move === PASS ? "pass" : coordinateOf(node.move);
  return `${prefix} ${move}`;
}

export function nextLegalMoves(tree) {
  const { board, side } = positionAtNode(tree);
  return legalMoves(board, side);
}

export function treeFromEvents(events) {
  return createAnalysisTree({ id: makeId("imported"), moves: events });
}

export function initialPosition() {
  return { board: initialBoard(), side: BLACK };
}
