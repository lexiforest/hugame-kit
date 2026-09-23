const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const startButton = document.querySelector("#start");
const digButton = document.querySelector("#dig");
const flagButton = document.querySelector("#flag");
const scoreLabel = document.querySelector("#score");
const minesLabel = document.querySelector("#mines");
const status = document.querySelector("#status");
const size = 9;
const mineCount = 10;
const cell = canvas.width / size;
let cells = [];
let playing = false;
let planted = false;
let startedAt = 0;
let seconds = 0;
let mode = "dig";
let cursor = { x: 4, y: 4 };

function index(x, y) {
  return y * size + x;
}

function neighbors(x, y) {
  const result = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if ((dx || dy) && nx >= 0 && nx < size && ny >= 0 && ny < size) result.push({ x: nx, y: ny });
    }
  return result;
}

function plantMines(safeX, safeY) {
  const blocked = new Set([
    index(safeX, safeY),
    ...neighbors(safeX, safeY).map((p) => index(p.x, p.y)),
  ]);
  const choices = cells.map((_, i) => i).filter((i) => !blocked.has(i));
  for (let i = 0; i < mineCount; i++) {
    const choice = Math.floor(Math.random() * choices.length);
    cells[choices.splice(choice, 1)[0]].mine = true;
  }
  cells.forEach((entry, i) => {
    const x = i % size;
    const y = Math.floor(i / size);
    entry.near = neighbors(x, y).filter((p) => cells[index(p.x, p.y)].mine).length;
  });
  planted = true;
}

function setMode(next) {
  mode = next;
  digButton.setAttribute("aria-pressed", String(mode === "dig"));
  flagButton.setAttribute("aria-pressed", String(mode === "flag"));
  digButton.classList.toggle("secondary", mode !== "dig");
  flagButton.classList.toggle("secondary", mode !== "flag");
}

function updateStats() {
  if (playing && startedAt) seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  scoreLabel.textContent = String(seconds);
  minesLabel.textContent = String(mineCount - cells.filter((entry) => entry.flagged).length);
}

function newGame() {
  cells = Array.from({ length: size * size }, () => ({
    mine: false,
    near: 0,
    open: false,
    flagged: false,
  }));
  playing = true;
  planted = false;
  startedAt = 0;
  seconds = 0;
  cursor = { x: 4, y: 4 };
  setMode("dig");
  status.textContent = "Dig a square. Your first move is always safe.";
  updateStats();
  draw();
  canvas.focus();
}

function finish(won) {
  playing = false;
  updateStats();
  if (won) {
    seconds = Math.max(1, seconds);
    scoreLabel.textContent = String(seconds);
    status.textContent = `Minefield cleared in ${seconds} seconds!`;
    window.Hugame?.score(seconds);
    window.Hugame?.gameOver(seconds);
  } else {
    cells.forEach((entry) => {
      if (entry.mine) entry.open = true;
    });
    status.textContent = "Boom! Choose New game and try another field.";
  }
  draw();
}

function reveal(x, y) {
  if (!playing) return;
  if (!planted) {
    plantMines(x, y);
    startedAt = Date.now();
  }
  const first = cells[index(x, y)];
  if (first.flagged || first.open) return;
  if (first.mine) {
    first.open = true;
    finish(false);
    return;
  }
  const queue = [{ x, y }];
  const seen = new Set();
  while (queue.length) {
    const point = queue.shift();
    const id = index(point.x, point.y);
    if (seen.has(id)) continue;
    seen.add(id);
    const entry = cells[id];
    if (entry.flagged || entry.mine) continue;
    entry.open = true;
    if (!entry.near) neighbors(point.x, point.y).forEach((neighbor) => queue.push(neighbor));
  }
  if (cells.filter((entry) => entry.open && !entry.mine).length === size * size - mineCount)
    finish(true);
  else draw();
}

function toggleFlag(x, y) {
  if (!playing) return;
  const entry = cells[index(x, y)];
  if (entry.open) return;
  entry.flagged = !entry.flagged;
  updateStats();
  draw();
}

function act(x, y, action = mode) {
  cursor = { x, y };
  if (action === "flag") toggleFlag(x, y);
  else reveal(x, y);
}

function pointFromEvent(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: Math.max(
      0,
      Math.min(size - 1, Math.floor(((event.clientX - bounds.left) / bounds.width) * size)),
    ),
    y: Math.max(
      0,
      Math.min(size - 1, Math.floor(((event.clientY - bounds.top) / bounds.height) * size)),
    ),
  };
}

canvas.addEventListener("pointerdown", (event) => {
  event.preventDefault();
  canvas.focus();
  const point = pointFromEvent(event);
  act(point.x, point.y, event.button === 2 ? "flag" : mode);
});
canvas.addEventListener("contextmenu", (event) => event.preventDefault());
canvas.addEventListener("keydown", (event) => {
  const moves = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  if (moves[event.key]) {
    event.preventDefault();
    cursor.x = Math.max(0, Math.min(size - 1, cursor.x + moves[event.key][0]));
    cursor.y = Math.max(0, Math.min(size - 1, cursor.y + moves[event.key][1]));
    draw();
  } else if (event.code === "Space" || event.key === "Enter") {
    event.preventDefault();
    act(cursor.x, cursor.y, "dig");
  } else if (event.key.toLowerCase() === "f") {
    event.preventDefault();
    act(cursor.x, cursor.y, "flag");
  }
});
startButton.addEventListener("click", newGame);
digButton.addEventListener("click", () => setMode("dig"));
flagButton.addEventListener("click", () => setMode("flag"));

function draw() {
  ctx.fillStyle = "#0f2638";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  cells.forEach((entry, i) => {
    const x = i % size;
    const y = Math.floor(i / size);
    const px = x * cell;
    const py = y * cell;
    ctx.fillStyle = entry.open ? "#d9e4e8" : (x + y) % 2 ? "#2d5870" : "#35677f";
    ctx.fillRect(px + 2, py + 2, cell - 4, cell - 4);
    if (entry.flagged && !entry.open) {
      ctx.fillStyle = "#ffd13f";
      ctx.font = "bold 28px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("⚑", px + cell / 2, py + cell * 0.68);
    } else if (entry.open && entry.mine) {
      ctx.fillStyle = "#ee4d3f";
      ctx.beginPath();
      ctx.arc(px + cell / 2, py + cell / 2, cell * 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else if (entry.open && entry.near) {
      const colors = ["", "#176cb0", "#16834d", "#d34939", "#6841a5", "#9a5a13"];
      ctx.fillStyle = colors[Math.min(entry.near, 5)];
      ctx.font = "bold 25px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(String(entry.near), px + cell / 2, py + cell * 0.66);
    }
  });
  ctx.strokeStyle = "#ffd13f";
  ctx.lineWidth = 4;
  ctx.strokeRect(cursor.x * cell + 3, cursor.y * cell + 3, cell - 6, cell - 6);
}

setInterval(() => {
  if (playing && startedAt) updateStats();
}, 250);
newGame();
playing = false;
status.textContent = "Choose New game to begin.";
