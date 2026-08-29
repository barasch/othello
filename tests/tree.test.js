import test from "node:test";
import assert from "node:assert/strict";
import { BLACK, WHITE } from "../site/js/rules.js";
import {
  addVariation,
  createAnalysisTree,
  navigateTree,
  pathToNode,
  positionAtNode,
  selectNode,
} from "../site/js/tree.js";

const playedGame = {
  id: "fixture",
  moves: [
    { side: BLACK, move: 19 },
    { side: WHITE, move: 18 },
  ],
};

test("a recorded game becomes an immutable preferred main line", () => {
  const tree = createAnalysisTree(playedGame);
  const path = pathToNode(tree);
  assert.equal(path.length, 2);
  assert.equal(path[0].source, "played");
  assert.equal(tree.nodes.root.preferredChildId, path[0].id);
  assert.equal(positionAtNode(tree).side, BLACK);
});

test("an alternative move creates a branch without replacing the played line", () => {
  const tree = createAnalysisTree(playedGame);
  const playedFirst = tree.nodes.root.preferredChildId;
  selectNode(tree, "root");
  const variation = addVariation(tree, 26);
  assert.equal(variation.source, "analysis");
  assert.equal(tree.nodes.root.children.length, 2);
  assert.equal(tree.nodes.root.preferredChildId, playedFirst);
});

test("navigation follows parents and preferred children", () => {
  const tree = createAnalysisTree(playedGame);
  navigateTree(tree, "first");
  assert.equal(tree.currentNodeId, "root");
  navigateTree(tree, "next");
  assert.equal(tree.currentNodeId, tree.nodes.root.preferredChildId);
  navigateTree(tree, "last");
  assert.equal(pathToNode(tree).length, 2);
  navigateTree(tree, "previous");
  assert.equal(pathToNode(tree).length, 1);
});
