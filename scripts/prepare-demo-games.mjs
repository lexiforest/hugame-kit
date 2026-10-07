import { chromium } from "@playwright/test";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
import assert from "node:assert/strict";

const games = [
  { folder: "flappy-finch", title: "Flappy Finch" },
  { folder: "2048", title: "2048" },
  { folder: "neon-snake", title: "Neon Snake" },
  { folder: "minesweeper", title: "Minesweeper" },
  { folder: "pong", title: "Pocket Pong" },
  { folder: "sudoku", title: "Sudoku" },
  { folder: "tic-tac-toe", title: "Tic-Tac-Toe" },
  { folder: "game-of-life", title: "Game of Life" },
  { folder: "gold-miner", title: "Gold Miner" },
  { folder: "pelican-pedal", title: "Pelican Pedal" },
  { folder: "match-3-puzzle", title: "Garden Match" },
];
const root = resolve("examples");
const server = createServer(async (req, res) => {
  try {
    const path = resolve(root, "." + new URL(req.url, "http://localhost").pathname);
    if (!path.startsWith(root + "/")) {
      res.writeHead(404).end();
      return;
    }
    const body = await readFile(path);
    res.setHeader(
      "content-type",
      { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" }[extname(path)] ??
        "application/octet-stream",
    );
    res.end(body);
  } catch {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
  for (const game of games) {
    await page.goto(`http://127.0.0.1:${server.address().port}/${game.folder}/index.html`);
    await page.getByRole("button", { name: "New game" }).click();
    if (game.folder === "flappy-finch") {
      await page.keyboard.press("Space");
      await page.waitForTimeout(650);
      await page.keyboard.press("Space");
      await page.waitForTimeout(600);
    } else if (["2048", "neon-snake", "pong"].includes(game.folder)) {
      await page.keyboard.press(game.folder === "2048" ? "ArrowLeft" : "ArrowDown");
      await page.waitForTimeout(250);
    } else if (game.folder === "minesweeper") {
      await page.locator("canvas").click({ position: { x: 250, y: 250 } });
    } else if (game.folder === "tic-tac-toe") {
      await page.keyboard.press("Space");
      await page.waitForTimeout(300);
    } else if (game.folder === "game-of-life") {
      await page.getByRole("button", { name: "Play", exact: true }).click();
      await page.waitForTimeout(550);
      await page.getByRole("button", { name: "Pause", exact: true }).click();
    } else if (game.folder === "gold-miner") {
      await page.getByRole("button", { name: "Drop claw", exact: true }).click();
      await page.waitForTimeout(3000);
    } else if (game.folder === "pelican-pedal") {
      for (let pedal = 0; pedal < 8; pedal++) {
        await page.keyboard.press(pedal % 2 ? "ArrowRight" : "ArrowLeft");
        await page.waitForTimeout(110);
      }
      await page.keyboard.press("Space");
      await page.waitForTimeout(650);
    } else if (game.folder === "match-3-puzzle") {
      await page.getByRole("button", { name: "Show hint", exact: true }).click();
      await page.keyboard.press("Space");
      await page.waitForTimeout(700);
    }
    await page.screenshot({ path: `${root}/${game.folder}/cover.png` });
    console.log(`${game.title}: real 640 × 400 gameplay cover captured.`);
  }
  await page.close();
  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    hasTouch: true,
  });
  const play = await context.newPage();
  const errors = [];
  play.on("pageerror", (error) => errors.push(error.message));
  await play.clock.install();
  for (const game of games) {
    await play.goto(`http://127.0.0.1:${server.address().port}/${game.folder}/index.html`);
    await play.getByRole("button", { name: "New game" }).click();
    assert.equal(
      await play.locator("canvas").evaluate((el) => el === document.activeElement),
      true,
    );
    if (game.folder === "2048") {
      for (const key of [
        "ArrowLeft",
        "ArrowDown",
        "ArrowRight",
        "ArrowUp",
        "ArrowLeft",
        "ArrowDown",
        "ArrowRight",
        "ArrowUp",
      ])
        await play.keyboard.press(key);
      await play.getByRole("button", { name: "Left", exact: true }).tap();
      assert.ok(Number(await play.locator("#score").textContent()) > 0);
    } else if (["flappy-finch", "neon-snake"].includes(game.folder)) {
      if (game.folder === "flappy-finch") {
        await play.keyboard.press("Space");
        await play.locator("canvas").tap();
      } else await play.getByRole("button", { name: "Up", exact: true }).tap();
      await play.clock.runFor(4000);
      assert.match(await play.locator("#status").textContent(), /Press New game to try again/);
    } else if (game.folder === "minesweeper") {
      await play.locator("canvas").tap({ position: { x: 180, y: 180 } });
      assert.notEqual(await play.locator("#mines").textContent(), "");
    } else if (game.folder === "pong") {
      await play.keyboard.down("ArrowDown");
      await play.clock.runFor(500);
      await play.keyboard.up("ArrowDown");
      assert.match(await play.locator("#status").textContent(), /First to seven/);
    } else if (game.folder === "sudoku") {
      await play.keyboard.press("ArrowRight");
      await play.keyboard.press("1");
      assert.notEqual(await play.locator("#score").textContent(), "");
    } else if (game.folder === "tic-tac-toe") {
      await play.keyboard.press("Space");
      await play.clock.runFor(400);
      assert.match(await play.locator("#status").textContent(), /Your turn|three|draw/i);
    } else if (game.folder === "game-of-life") {
      await play.getByRole("button", { name: "Play", exact: true }).tap();
      await play.clock.runFor(600);
      await play.getByRole("button", { name: "Pause", exact: true }).tap();
      assert.ok(Number(await play.locator("#generation").textContent()) > 0);
    } else if (game.folder === "gold-miner") {
      await play.getByRole("button", { name: "Drop claw", exact: true }).tap();
      await play.clock.runFor(4000);
      assert.match(await play.locator("#status").textContent(), /claw|haul|gem|rock|gold/i);
    } else if (game.folder === "pelican-pedal") {
      for (let pedal = 0; pedal < 8; pedal++)
        await play.getByRole("button", { name: pedal % 2 ? "Right pedal" : "Left pedal" }).tap();
      await play.getByRole("button", { name: "Jump", exact: true }).tap();
      await play.clock.runFor(1000);
      assert.ok(Number.parseInt(await play.locator("#score").textContent(), 10) > 0);
    } else if (game.folder === "match-3-puzzle") {
      await play.getByRole("button", { name: "Show hint", exact: true }).tap();
      await play.keyboard.press("Space");
      await play.clock.runFor(1000);
      assert.ok(Number.parseInt(await play.locator("#score").textContent(), 10) > 0);
    }
    await play.getByRole("button", { name: "New game" }).tap();
    if (await play.locator("#score").count())
      assert.equal(await play.locator("#score").textContent(), "0");
    for (const viewport of [
      { width: 360, height: 800 },
      { width: 844, height: 390 },
      { width: 920, height: 575 },
    ]) {
      await play.setViewportSize(viewport);
      assert.deepEqual(
        await play.evaluate(() => {
          const canvas = document.querySelector("canvas").getBoundingClientRect();
          return {
            noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth,
            noVerticalOverflow: document.documentElement.scrollHeight <= innerHeight,
            canvasContained:
              canvas.left >= 0 &&
              canvas.top >= 0 &&
              canvas.right <= innerWidth &&
              canvas.bottom <= innerHeight,
          };
        }),
        { noHorizontalOverflow: true, noVerticalOverflow: true, canvasContained: true },
      );
    }
    console.log(`${game.title}: controls, restart and narrow layout passed.`);
  }
  assert.deepEqual(errors, []);
  const { mergeLine } = await import("../examples/2048/scripts/logic.js");
  assert.deepEqual(mergeLine([2, 2, 2, 2]), { line: [4, 4, 0, 0], gained: 8 });
  assert.deepEqual(mergeLine([2, 2, 4, 0]), { line: [4, 4, 0, 0], gained: 4 });
  assert.deepEqual(mergeLine([0, 4, 0, 4]), { line: [8, 0, 0, 0], gained: 8 });
  console.log("2048 merge rules passed; no browser errors.");
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
