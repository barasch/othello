import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { BLACK, WHITE, countDiscs } from "../site/js/rules.js";
import { parseXotList, prepareXotOpening, replayOpening } from "../site/js/openings.js";
import { createAnalysisTree, positionAtNode } from "../site/js/tree.js";

const FIRST_XOT_LINE = "f5d6c4d3c2b3b4b5";

test("an eight-move XOT line replays to a legal position", () => {
  const opening = replayOpening(FIRST_XOT_LINE);
  assert.equal(opening.events.length, 8);
  assert.equal(opening.side, BLACK);
  assert.deepEqual(countDiscs(opening.board), { black: 7, white: 5, empty: 52 });
});

test("a Black start omits the last move when a sequence leaves White to move", () => {
  const sevenMoves = FIRST_XOT_LINE.slice(0, -2);
  assert.equal(replayOpening(sevenMoves).side, WHITE);
  const opening = prepareXotOpening(sevenMoves, BLACK);
  assert.equal(opening.sequence, FIRST_XOT_LINE.slice(0, -4));
  assert.equal(opening.side, BLACK);
  assert.equal(opening.sourceSequence, sevenMoves);
});

test("opening moves become the recorded main line in analysis", () => {
  const opening = replayOpening(FIRST_XOT_LINE);
  const tree = createAnalysisTree({ id: "xot-fixture", moves: opening.events });
  const position = positionAtNode(tree);
  assert.deepEqual(position.board, opening.board);
  assert.equal(position.side, opening.side);
});

test("malformed or illegal opening lines are rejected", () => {
  assert.throws(() => parseXotList("f5d6\n"), /not valid/);
  assert.throws(() => replayOpening("a1a2"), /Illegal opening move/);
});

test("the bundled large list is complete, valid, and unique", async () => {
  const text = await readFile(new URL("../site/data/openingslarge.txt", import.meta.url), "utf8");
  const openings = parseXotList(text);
  assert.equal(openings.length, 10_784);
  assert.equal(new Set(openings).size, openings.length);
  assert.equal(openings[0], FIRST_XOT_LINE);
  for (const sequence of openings) {
    const opening = replayOpening(sequence);
    assert.equal(opening.side, BLACK, `${sequence} should leave Black to move`);
    assert.equal(countDiscs(opening.board).empty, 52);
  }
});
