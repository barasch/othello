import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("the static entry point identifies the game and loads the module app", async () => {
  const html = await readFile(new URL("../site/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>Othello<\/title>/);
  assert.match(html, /type="module" src="js\/app\.js"/);
  assert.match(html, /meta name="viewport"/);
});

test("the rules page credits the engine source and trademark owner", async () => {
  const html = await readFile(new URL("../site/rules.html", import.meta.url), "utf8");
  assert.match(html, /Roemer B\. Lievaart/);
  assert.match(html, /Othello is a trademark/);
});
