import { playSound } from "./sound.js";

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const startButton = document.querySelector("#start");
const playButton = document.querySelector("#play");
const stepButton = document.querySelector("#step");
const clearButton = document.querySelector("#clear");
const generationLabel = document.querySelector("#generation");
const populationLabel = document.querySelector("#population");
const status = document.querySelector("#status");
const columns = 30;
const rows = 20;
const cellWidth = canvas.width / columns;
const cellHeight = canvas.height / rows;
let cells = new Uint8Array(columns * rows);
let generation = 0;
let running = false;

function index(x, y) {
  return y * columns + x;
}

function population() {
  return cells.reduce((sum, value) => sum + value, 0);
}

function updateStats() {
  generationLabel.textContent = String(generation);
  populationLabel.textContent = String(population());
  playButton.textContent = running ? "Pause" : "Play";
}

function newGame() {
  cells = Uint8Array.from({ length: columns * rows }, () => (Math.random() < 0.24 ? 1 : 0));
  generation = 0;
  running = false;
  status.textContent = "A random world is ready. Press Play or edit any cell.";
  updateStats();
  draw();
  canvas.focus();
}

function clearWorld() {
  cells = new Uint8Array(columns * rows);
  generation = 0;
  running = false;
  status.textContent = "Empty world. Tap cells to draw a pattern.";
  updateStats();
  draw();
  canvas.focus();
}

function nextGeneration() {
  const next = new Uint8Array(cells.length);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < columns; x++) {
      let nearby = 0;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const nx = x + dx;
          const ny = y + dy;
          if (nx >= 0 && nx < columns && ny >= 0 && ny < rows) nearby += cells[index(nx, ny)];
        }
      const alive = cells[index(x, y)];
      next[index(x, y)] = nearby === 3 || (alive && nearby === 2) ? 1 : 0;
    }
  cells = next;
  generation++;
  const count = population();
  if (!count && running) {
    running = false;
    status.textContent = "This world became quiet. Draw or randomize another pattern.";
  } else status.textContent = running ? "Life is evolving…" : "Advanced one generation.";
  updateStats();
  draw();
}

function togglePlay() {
  if (!population()) {
    status.textContent = "Add a few living cells before pressing Play.";
    return;
  }
  running = !running;
  status.textContent = running ? "Life is evolving…" : "Paused. Edit cells or step once.";
  updateStats();
  canvas.focus();
}

function toggleCell(event) {
  const bounds = canvas.getBoundingClientRect();
  const x = Math.max(
    0,
    Math.min(columns - 1, Math.floor(((event.clientX - bounds.left) / bounds.width) * columns)),
  );
  const y = Math.max(
    0,
    Math.min(rows - 1, Math.floor(((event.clientY - bounds.top) / bounds.height) * rows)),
  );
  cells[index(x, y)] = cells[index(x, y)] ? 0 : 1;
  playSound("move");
  running = false;
  status.textContent = "Cell toggled. Press Play when your pattern is ready.";
  updateStats();
  draw();
  canvas.focus();
}

startButton.addEventListener("click", () => {
  playSound("start");
  newGame();
});
playButton.addEventListener("click", () => {
  playSound("action");
  togglePlay();
});
stepButton.addEventListener("click", () => {
  playSound("move");
  running = false;
  nextGeneration();
  canvas.focus();
});
clearButton.addEventListener("click", () => {
  playSound("action");
  clearWorld();
});
canvas.addEventListener("pointerdown", toggleCell);
canvas.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    playSound("action");
    togglePlay();
  }
});
window.Hugame?.on("pause", () => {
  if (running) togglePlay();
});

function draw() {
  const world = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  world.addColorStop(0, "#061d20");
  world.addColorStop(1, "#0c332b");
  ctx.fillStyle = world;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < columns; x++)
      if (cells[index(x, y)]) {
        ctx.shadowColor = "#aeee5c";
        ctx.shadowBlur = 7;
        ctx.fillStyle = (x + y) % 3 ? "#54d98b" : "#cdf45d";
        ctx.fillRect(x * cellWidth + 2, y * cellHeight + 2, cellWidth - 4, cellHeight - 4);
      }
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "#245044";
  ctx.lineWidth = 1;
  for (let x = 1; x < columns; x++) {
    ctx.beginPath();
    ctx.moveTo(x * cellWidth, 0);
    ctx.lineTo(x * cellWidth, canvas.height);
    ctx.stroke();
  }
  for (let y = 1; y < rows; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * cellHeight);
    ctx.lineTo(canvas.width, y * cellHeight);
    ctx.stroke();
  }
}

setInterval(() => {
  if (running) nextGeneration();
}, 180);
newGame();
