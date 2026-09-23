import { mergeLine } from "./logic.js";
const mode = document.body.dataset.game,
  canvas = document.querySelector("canvas"),
  ctx = canvas.getContext("2d");
const status = document.querySelector("#status"),
  scoreLabel = document.querySelector("#score"),
  start = document.querySelector("#start");
let score = 0,
  playing = false,
  over = false,
  previous = 0,
  elapsed = 0;
let bird, pipes, spawn, snake, direction, queued, food, grid, won;
function tell(text) {
  status.textContent = text;
}
function points(value) {
  score = value;
  scoreLabel.textContent = String(score);
  window.Hugame?.score(score);
}
function finish(text) {
  playing = false;
  over = true;
  tell(text + " Press New game to try again.");
  window.Hugame?.gameOver(score);
}
function newFood() {
  const free = [];
  for (let y = 0; y < 20; y++)
    for (let x = 0; x < 20; x++)
      if (!snake.some((p) => p.x === x && p.y === y)) free.push({ x, y });
  if (!free.length) {
    finish("You filled the board!");
    return;
  }
  food = free[Math.floor(Math.random() * free.length)];
}
function addTile() {
  const free = [];
  grid.forEach((n, i) => {
    if (!n) free.push(i);
  });
  if (free.length)
    grid[free[Math.floor(Math.random() * free.length)]] = Math.random() < 0.9 ? 2 : 4;
}
function reset() {
  points(0);
  over = false;
  playing = true;
  elapsed = 0;
  previous = 0;
  won = false;
  bird = { y: 220, v: 0 };
  pipes = [];
  spawn = 0.4;
  snake = [
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 },
  ];
  direction = { x: 1, y: 0 };
  queued = direction;
  newFood();
  grid = Array(16).fill(0);
  addTile();
  addTile();
  tell(
    mode === "flappy"
      ? "Tap the board or press Space to flap."
      : mode === "snake"
        ? "Use arrows, swipe, or the direction buttons."
        : "Slide matching tiles together. Reach 2048!",
  );
  canvas.focus();
  draw();
}
function moveTiles(dx, dy) {
  if (!playing) return;
  const before = grid.join(",");
  let gained = 0;
  for (let a = 0; a < 4; a++) {
    const ids = [];
    for (let b = 0; b < 4; b++)
      ids.push(dx ? a * 4 + (dx > 0 ? 3 - b : b) : (dy > 0 ? 3 - b : b) * 4 + a);
    const merged = mergeLine(ids.map((i) => grid[i]));
    gained += merged.gained;
    ids.forEach((id, i) => (grid[id] = merged.line[i]));
  }
  if (grid.join(",") !== before) {
    points(score + gained);
    addTile();
  }
  if (!won && grid.includes(2048)) {
    won = true;
    tell("2048! You won. Keep playing for a bigger tile.");
    window.Hugame?.gameOver(score);
  }
  const canMove = grid.some(
    (v, i) => !v || (i % 4 < 3 && v === grid[i + 1]) || (i < 12 && v === grid[i + 4]),
  );
  if (!canMove) finish("No moves left. Final score: " + score + ".");
  draw();
}
function steer(dx, dy) {
  if (mode === "tiles") {
    moveTiles(dx, dy);
    return;
  }
  if (mode === "snake" && playing && (dx !== -direction.x || dy !== -direction.y))
    queued = { x: dx, y: dy };
}
function flap() {
  if (mode === "flappy" && playing) bird.v = -290;
}
document.querySelectorAll("[data-dir]").forEach((button) =>
  button.addEventListener("click", () => {
    const [x, y] = button.dataset.dir.split(",").map(Number);
    steer(x, y);
    canvas.focus();
  }),
);
start.addEventListener("click", reset);
canvas.addEventListener("keydown", (e) => {
  const dirs = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
    a: [-1, 0],
    d: [1, 0],
    w: [0, -1],
    s: [0, 1],
  };
  if (dirs[e.key]) {
    e.preventDefault();
    steer(...dirs[e.key]);
  }
  if (e.code === "Space") {
    e.preventDefault();
    flap();
  }
});
let touch;
canvas.addEventListener("pointerdown", (e) => {
  canvas.focus();
  touch = { x: e.clientX, y: e.clientY };
  canvas.setPointerCapture(e.pointerId);
  flap();
});
canvas.addEventListener("pointerup", (e) => {
  if (!touch) return;
  const dx = e.clientX - touch.x,
    dy = e.clientY - touch.y;
  touch = null;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
  if (Math.abs(dx) > Math.abs(dy)) steer(Math.sign(dx), 0);
  else steer(0, Math.sign(dy));
});
canvas.addEventListener("pointercancel", () => {
  touch = null;
});
function box(x, y, w, h, color, r = 10) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}
function draw() {
  ctx.clearRect(0, 0, 480, 480);
  const sky = ctx.createLinearGradient(0, 0, 0, 480);
  sky.addColorStop(0, "#59c9f5");
  sky.addColorStop(0.7, "#bdeeff");
  sky.addColorStop(1, "#fff0b8");
  box(0, 0, 480, 480, sky, 20);
  if (mode === "tiles") {
    const colors = {
      2: "#e4eff4",
      4: "#c5e8dd",
      8: "#82d6bf",
      16: "#45bba9",
      32: "#20a6ad",
      64: "#238db9",
      128: "#677cdf",
      256: "#8d6cde",
      512: "#b871cf",
      1024: "#edac76",
      2048: "#f4cb6c",
    };
    grid.forEach((v, i) => {
      const x = 14 + (i % 4) * 116,
        y = 14 + Math.floor(i / 4) * 116;
      box(x, y, 104, 104, colors[v] || "#23334f");
      if (v) {
        ctx.fillStyle = v <= 8 ? "#193348" : "#fff";
        ctx.font = "bold " + (v >= 1024 ? 30 : 40) + "px system-ui";
        ctx.textAlign = "center";
        ctx.fillText(v, x + 52, y + 67);
      }
    });
  }
  if (mode === "snake") {
    ctx.strokeStyle = "#1a2b43";
    ctx.lineWidth = 1;
    for (let i = 1; i < 20; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 24, 0);
      ctx.lineTo(i * 24, 480);
      ctx.moveTo(0, i * 24);
      ctx.lineTo(480, i * 24);
      ctx.stroke();
    }
    if (food) box(food.x * 24 + 3, food.y * 24 + 3, 18, 18, "#ffac91", 7);
    snake.forEach((p, i) => box(p.x * 24 + 2, p.y * 24 + 2, 20, 20, i ? "#42bfa4" : "#b1f9d7", 6));
  }
  if (mode === "flappy") {
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = "#ffffffc9";
      ctx.beginPath();
      ctx.arc((i * 97 + 40) % 480, 60 + (i % 3) * 50, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    pipes.forEach((p) => {
      box(p.x, -20, 64, p.gap - 75 + 20, "#35b967", 8);
      box(p.x + 7, -20, 12, p.gap - 75 + 20, "#79df88", 5);
      box(p.x, p.gap + 75, 64, 480 - p.gap - 75, "#35b967", 8);
      box(p.x + 7, p.gap + 75, 12, 480 - p.gap - 75, "#79df88", 5);
    });
    ctx.fillStyle = "#ffcf70";
    ctx.beginPath();
    ctx.ellipse(115, bird.y, 18, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    box(107, bird.y, 17, 8, "#ef7a36", 5);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(122, bird.y - 5, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#11324d";
    ctx.beginPath();
    ctx.arc(124, bird.y - 5, 2, 0, Math.PI * 2);
    ctx.fill();
    box(0, 457, 480, 23, "#66bf55", 0);
    box(0, 457, 480, 6, "#a9e66f", 0);
  }
  if (over) {
    box(55, 194, 370, 92, "#091322e8", 16);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 27px system-ui";
    ctx.fillText("Round complete", 240, 232);
    ctx.font = "18px system-ui";
    ctx.fillText("Score: " + score, 240, 263);
  }
}
function tick(now) {
  const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
  previous = now;
  if (playing && mode === "flappy") {
    bird.v += 780 * dt;
    bird.y += bird.v * dt;
    spawn -= dt;
    if (spawn <= 0) {
      pipes.push({ x: 500, gap: 140 + Math.random() * 200, passed: false });
      spawn = 1.7;
    }
    for (const p of pipes) {
      p.x -= 145 * dt;
      if (!p.passed && p.x + 64 < 97) {
        p.passed = true;
        points(score + 1);
      }
      if (
        115 + 16 > p.x &&
        115 - 16 < p.x + 64 &&
        (bird.y - 13 < p.gap - 75 || bird.y + 13 > p.gap + 75)
      )
        finish("You hit a pipe.");
    }
    pipes = pipes.filter((p) => p.x > -70);
    if (bird.y < 14 || bird.y > 450) finish("Watch the sky and the ground.");
    draw();
  }
  if (playing && mode === "snake") {
    elapsed += dt;
    if (elapsed >= Math.max(0.075, 0.15 - score * 0.002)) {
      elapsed = 0;
      direction = queued;
      const head = { x: snake[0].x + direction.x, y: snake[0].y + direction.y };
      const eating = head.x === food.x && head.y === food.y;
      if (
        head.x < 0 ||
        head.x >= 20 ||
        head.y < 0 ||
        head.y >= 20 ||
        snake.slice(0, eating ? undefined : -1).some((p) => p.x === head.x && p.y === head.y)
      )
        finish("Snake bumped into something.");
      else {
        snake.unshift(head);
        if (eating) {
          points(score + 1);
          newFood();
        } else snake.pop();
      }
      draw();
    }
  }
  requestAnimationFrame(tick);
}
reset();
playing = false;
tell("Press New game to begin.");
requestAnimationFrame(tick);
