import { playSound } from "./sound.js";
import {
  BOARD_SIZE,
  areAdjacent,
  createBoard,
  findMatches,
  findPossibleMove,
  swap,
} from "./logic.js";

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const startButton = document.querySelector("#start");
const restartButton = document.querySelector("#restart");
const hintButton = document.querySelector("#hint");
const nextButton = document.querySelector("#next");
const levelLabel = document.querySelector("#level");
const scoreLabel = document.querySelector("#score");
const bestLabel = document.querySelector("#best");
const movesLabel = document.querySelector("#moves");
const goalLabel = document.querySelector("#goal");
const status = document.querySelector("#status");
const saveStatus = document.querySelector("#save-status");

const CELL = canvas.width / BOARD_SIZE;
const TILES = [
  { name: "coral berries", color: "#ef646d", light: "#ff9b91", shape: "circle" },
  { name: "golden stars", color: "#f5b942", light: "#ffe58b", shape: "star" },
  { name: "mint leaves", color: "#4abb78", light: "#a9e986", shape: "leaf" },
  { name: "blue drops", color: "#3c9fe8", light: "#9ee8ff", shape: "drop" },
  { name: "violet flowers", color: "#9064d6", light: "#d1aff7", shape: "flower" },
  { name: "pink hearts", color: "#e860a5", light: "#ffacd1", shape: "heart" },
];
const LEVELS = [
  { moves: 16, typeCount: 5, goal: 0, count: 10 },
  { moves: 16, typeCount: 5, goal: 1, count: 13 },
  { moves: 17, typeCount: 5, goal: 2, count: 16 },
  { moves: 17, typeCount: 6, goal: 3, count: 18 },
  { moves: 18, typeCount: 6, goal: 4, count: 20 },
  { moves: 18, typeCount: 6, goal: 5, count: 22 },
  { moves: 19, typeCount: 6, goal: 0, count: 25 },
  { moves: 19, typeCount: 6, goal: 2, count: 28 },
  { moves: 20, typeCount: 6, goal: 4, count: 31 },
  { moves: 21, typeCount: 6, goal: 5, count: 35 },
];
const profileDefaults = { unlockedLevel: 1, completedLevels: 0, bestScore: 0 };

let profile = { ...profileDefaults };
let board = [];
let levelIndex = 0;
let moves = 0;
let goalRemaining = 0;
let score = 0;
let levelStartScore = 0;
let cursor = 27;
let selected = null;
let playing = false;
let busy = false;
let hostPaused = false;
let lastReportedScore = -1;

function tell(message) {
  status.textContent = message;
}

function reportAchievement(action) {
  if (!window.Hugame?.achievements) return;
  action(window.Hugame.achievements).catch((error) => {
    saveStatus.textContent = `Achievement unavailable: ${error.message}`;
  });
}

function reportScore() {
  scoreLabel.textContent = String(score);
  bestLabel.textContent = String(Math.max(profile.bestScore, score));
  if (score !== lastReportedScore) {
    lastReportedScore = score;
    window.Hugame?.score(score);
  }
}

function updateLabels() {
  const level = LEVELS[levelIndex];
  levelLabel.textContent = `${levelIndex + 1} / ${LEVELS.length}`;
  movesLabel.textContent = String(moves);
  goalLabel.textContent = `${goalRemaining} ${TILES[level.goal].name}`;
  reportScore();
}

function startLevel(index) {
  levelIndex = index;
  const level = LEVELS[levelIndex];
  board = createBoard(level.typeCount);
  moves = level.moves;
  goalRemaining = level.count;
  levelStartScore = score;
  cursor = 27;
  selected = null;
  playing = true;
  busy = false;
  hintButton.disabled = false;
  restartButton.disabled = false;
  nextButton.hidden = true;
  tell(`Level ${levelIndex + 1}: collect ${level.count} ${TILES[level.goal].name}.`);
  updateLabels();
  draw();
  canvas.focus();
}

function newGame() {
  if (busy) return;
  playSound("start");
  score = 0;
  lastReportedScore = -1;
  startLevel(0);
}

function restartLevel() {
  if (busy) return;
  playSound("start");
  score = levelStartScore;
  startLevel(levelIndex);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function animationPause(milliseconds) {
  await delay(milliseconds);
  while (hostPaused) await delay(50);
}

function collapseBoard() {
  const typeCount = LEVELS[levelIndex].typeCount;
  for (let column = 0; column < BOARD_SIZE; column++) {
    const remaining = [];
    for (let row = BOARD_SIZE - 1; row >= 0; row--) {
      const value = board[row * BOARD_SIZE + column];
      if (value !== null) remaining.push(value);
    }
    for (let row = BOARD_SIZE - 1; row >= 0; row--)
      board[row * BOARD_SIZE + column] =
        remaining[BOARD_SIZE - 1 - row] ?? Math.floor(Math.random() * typeCount);
  }
}

async function clearCascades(initialMatches) {
  let matches = initialMatches;
  let combo = 1;
  let matchedOnce = false;
  while (matches.size) {
    matchedOnce = true;
    const goalType = LEVELS[levelIndex].goal;
    const collected = [...matches].filter((index) => board[index] === goalType).length;
    goalRemaining = Math.max(0, goalRemaining - collected);
    score += matches.size * 50 * combo;
    for (const index of matches) board[index] = null;
    playSound(combo > 1 ? "success" : "collect");
    tell(combo > 1 ? `Cascade ×${combo}! Keep it growing.` : "Lovely match!");
    updateLabels();
    draw();
    await animationPause(150);
    collapseBoard();
    draw();
    await animationPause(170);
    matches = findMatches(board);
    combo++;
  }
  if (matchedOnce)
    reportAchievement((achievements) => achievements.unlock("first-bloom"));
}

async function saveProgress() {
  if (!window.Hugame?.progress) {
    saveStatus.textContent = `Best score: ${profile.bestScore}.`;
    return;
  }
  try {
    const saved = await window.Hugame.progress.save(profile, { schemaVersion: 1 });
    saveStatus.textContent = `Garden record saved (${saved.storage}).`;
  } catch (error) {
    saveStatus.textContent = `Record not saved: ${error.message}`;
  }
}

async function finishLevel() {
  playing = false;
  hintButton.disabled = true;
  profile.completedLevels = Math.max(profile.completedLevels, levelIndex + 1);
  profile.unlockedLevel = Math.max(
    profile.unlockedLevel,
    Math.min(LEVELS.length, levelIndex + 2),
  );
  profile.bestScore = Math.max(profile.bestScore, score);
  bestLabel.textContent = String(profile.bestScore);
  reportAchievement((achievements) =>
    achievements.setProgress("garden-climber", profile.completedLevels),
  );
  reportAchievement((achievements) =>
    achievements.setProgress("garden-master", profile.completedLevels),
  );
  void saveProgress();
  playSound("success");

  if (levelIndex === LEVELS.length - 1) {
    tell(`Garden complete! You cleared all ten levels with ${score} points.`);
    nextButton.hidden = true;
    window.Hugame?.gameOver(score);
  } else {
    tell(`Level ${levelIndex + 1} cleared! The next garden is ready.`);
    nextButton.hidden = false;
  }
  draw();
}

async function finishTurn() {
  if (goalRemaining === 0) {
    await finishLevel();
    return;
  }
  if (moves === 0) {
    playing = false;
    hintButton.disabled = true;
    playSound("failure");
    tell(`Out of moves! Restart level ${levelIndex + 1} and try a new board.`);
    window.Hugame?.gameOver(score);
    draw();
    return;
  }
  if (!findPossibleMove(board)) {
    board = createBoard(LEVELS[levelIndex].typeCount);
    tell("No swaps remained, so the garden was gently reshuffled.");
  } else tell(`${moves} moves left. Collect ${goalRemaining} more ${TILES[LEVELS[levelIndex].goal].name}.`);
  updateLabels();
  draw();
}

async function attemptSwap(first, second) {
  if (!playing || busy || !areAdjacent(first, second)) return;
  busy = true;
  selected = null;
  swap(board, first, second);
  playSound("action");
  draw();
  await animationPause(110);
  const matches = findMatches(board);
  if (!matches.size) {
    swap(board, first, second);
    playSound("failure");
    tell("That swap makes no match. Try another pair.");
    busy = false;
    draw();
    return;
  }
  moves--;
  await clearCascades(matches);
  await finishTurn();
  busy = false;
}

function choose(index) {
  if (!playing || busy) return;
  cursor = index;
  if (selected === null) {
    selected = index;
    playSound("move");
    tell("Now choose a neighboring tile to swap.");
    draw();
    return;
  }
  if (selected === index) {
    selected = null;
    playSound("move");
    draw();
    return;
  }
  if (areAdjacent(selected, index)) {
    void attemptSwap(selected, index);
    return;
  }
  selected = index;
  playSound("move");
  draw();
}

function showHint() {
  if (!playing || busy) return;
  const hint = findPossibleMove(board);
  if (!hint) return;
  [selected, cursor] = hint;
  playSound("action");
  tell("Hint: swap the two glowing tiles.");
  draw();
  canvas.focus();
}

function roundedRect(x, y, width, height, radius, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function starPath(radius) {
  ctx.beginPath();
  for (let point = 0; point < 10; point++) {
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const distance = point % 2 ? radius * 0.45 : radius;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    if (!point) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function drawShape(type, x, y, radius) {
  const tile = TILES[type];
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = tile.color;
  ctx.strokeStyle = "#ffffff99";
  ctx.lineWidth = 4;
  ctx.shadowColor = `${tile.color}aa`;
  ctx.shadowBlur = 10;
  if (tile.shape === "circle") {
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.78, 0, Math.PI * 2);
  } else if (tile.shape === "star") starPath(radius * 0.9);
  else if (tile.shape === "leaf") {
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 0.72, radius, Math.PI / 4, 0, Math.PI * 2);
  } else if (tile.shape === "drop") {
    ctx.beginPath();
    ctx.moveTo(0, -radius);
    ctx.bezierCurveTo(radius, -radius * 0.1, radius * 0.82, radius, 0, radius);
    ctx.bezierCurveTo(-radius * 0.82, radius, -radius, -radius * 0.1, 0, -radius);
  } else if (tile.shape === "flower") {
    ctx.beginPath();
    for (let petal = 0; petal < 6; petal++) {
      const angle = (petal * Math.PI) / 3;
      ctx.moveTo(Math.cos(angle) * radius * 0.2, Math.sin(angle) * radius * 0.2);
      ctx.arc(Math.cos(angle) * radius * 0.58, Math.sin(angle) * radius * 0.58, radius * 0.38, 0, Math.PI * 2);
    }
  } else {
    ctx.beginPath();
    ctx.moveTo(0, radius);
    ctx.bezierCurveTo(-radius * 1.25, radius * 0.2, -radius, -radius * 0.65, -radius * 0.42, -radius * 0.65);
    ctx.bezierCurveTo(-radius * 0.12, -radius * 0.65, 0, -radius * 0.4, 0, -radius * 0.18);
    ctx.bezierCurveTo(0, -radius * 0.4, radius * 0.12, -radius * 0.65, radius * 0.42, -radius * 0.65);
    ctx.bezierCurveTo(radius, -radius * 0.65, radius * 1.25, radius * 0.2, 0, radius);
  }
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.fillStyle = tile.light;
  ctx.beginPath();
  ctx.ellipse(-radius * 0.25, -radius * 0.3, radius * 0.2, radius * 0.1, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function draw() {
  const background = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  background.addColorStop(0, "#315d4e");
  background.addColorStop(1, "#183f3d");
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < BOARD_SIZE * BOARD_SIZE; index++) {
    const column = index % BOARD_SIZE;
    const row = Math.floor(index / BOARD_SIZE);
    const x = column * CELL;
    const y = row * CELL;
    roundedRect(x + 5, y + 5, CELL - 10, CELL - 10, 16, (row + column) % 2 ? "#f7eccd" : "#fff8df");
    if (board[index] !== null && board[index] !== undefined)
      drawShape(board[index], x + CELL / 2, y + CELL / 2, CELL * 0.32);
    if (index === selected || index === cursor) {
      ctx.strokeStyle = index === selected ? "#ffd24d" : "#ffffffcc";
      ctx.lineWidth = index === selected ? 7 : 3;
      ctx.beginPath();
      ctx.roundRect(x + 4, y + 4, CELL - 8, CELL - 8, 17);
      ctx.stroke();
    }
  }

  if (!playing && board.length) {
    roundedRect(112, 264, 416, 112, 22, "#173b37e8");
    ctx.fillStyle = "#fff7d7";
    ctx.textAlign = "center";
    ctx.font = "900 30px ui-rounded, system-ui";
    ctx.fillText(goalRemaining === 0 ? "Level cleared!" : "Garden resting", 320, 311);
    ctx.font = "700 17px system-ui";
    ctx.fillText(goalRemaining === 0 ? "Continue when you are ready" : "Restart this level to try again", 320, 344);
    ctx.textAlign = "start";
  }
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  const bounds = canvas.getBoundingClientRect();
  const column = Math.max(0, Math.min(BOARD_SIZE - 1, Math.floor(((event.clientX - bounds.left) / bounds.width) * BOARD_SIZE)));
  const row = Math.max(0, Math.min(BOARD_SIZE - 1, Math.floor(((event.clientY - bounds.top) / bounds.height) * BOARD_SIZE)));
  canvas.focus();
  choose(row * BOARD_SIZE + column);
});

canvas.addEventListener("keydown", (event) => {
  const row = Math.floor(cursor / BOARD_SIZE);
  const column = cursor % BOARD_SIZE;
  if (event.key === "ArrowLeft") cursor = row * BOARD_SIZE + Math.max(0, column - 1);
  else if (event.key === "ArrowRight") cursor = row * BOARD_SIZE + Math.min(BOARD_SIZE - 1, column + 1);
  else if (event.key === "ArrowUp") cursor = Math.max(0, row - 1) * BOARD_SIZE + column;
  else if (event.key === "ArrowDown") cursor = Math.min(BOARD_SIZE - 1, row + 1) * BOARD_SIZE + column;
  else if (event.code === "Space" || event.code === "Enter") {
    event.preventDefault();
    choose(cursor);
    return;
  } else if (event.code === "Escape") selected = null;
  else return;
  event.preventDefault();
  playSound("move");
  draw();
});

startButton.addEventListener("click", newGame);
restartButton.addEventListener("click", restartLevel);
hintButton.addEventListener("click", showHint);
nextButton.addEventListener("click", () => {
  playSound("start");
  startLevel(levelIndex + 1);
});

window.Hugame?.on?.("pause", () => {
  hostPaused = true;
  if (playing) tell("Paused. The garden will wait for you.");
});
window.Hugame?.on?.("resume", () => {
  hostPaused = false;
  if (playing) tell(`${moves} moves left. Collect ${goalRemaining} more ${TILES[LEVELS[levelIndex].goal].name}.`);
});
window.Hugame?.on?.("viewport", draw);

async function loadProfile() {
  if (window.Hugame?.progress) {
    try {
      const saved = await window.Hugame.progress.load();
      if (saved.data && saved.schemaVersion !== 1)
        throw new Error("This garden record uses a newer format.");
      if (saved.data) profile = { ...profileDefaults, ...saved.data };
      saveStatus.textContent = `Garden record loaded (${saved.storage}).`;
    } catch (error) {
      saveStatus.textContent = `Garden record unavailable: ${error.message}`;
    }
  } else saveStatus.textContent = "Standalone play keeps no garden record.";
  bestLabel.textContent = String(profile.bestScore);
  startButton.disabled = false;
  tell("Press New game to begin at level one.");
}

draw();
void loadProfile();
