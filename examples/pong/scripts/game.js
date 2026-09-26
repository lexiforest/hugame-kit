import { playSound } from "./sound.js";

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const startButton = document.querySelector("#start");
const playerLabel = document.querySelector("#player-score");
const cpuLabel = document.querySelector("#cpu-score");
const status = document.querySelector("#status");
const keys = new Set();
const paddle = { width: 14, height: 92 };
let playerY = 154;
let cpuY = 154;
let playerScore = 0;
let cpuScore = 0;
let playing = false;
let hostPaused = false;
let statusBeforePause = "";
let previous = 0;
let ball = { x: 320, y: 200, vx: 260, vy: 120 };

function updateLabels() {
  playerLabel.textContent = String(playerScore);
  cpuLabel.textContent = String(cpuScore);
}

function serve(direction = Math.random() < 0.5 ? -1 : 1) {
  ball = {
    x: canvas.width / 2,
    y: 100 + Math.random() * 200,
    vx: direction * (250 + Math.random() * 30),
    vy: (Math.random() - 0.5) * 230,
  };
}

function newGame() {
  if (hostPaused) return;
  playSound("start");
  playerY = cpuY = (canvas.height - paddle.height) / 2;
  playerScore = 0;
  cpuScore = 0;
  playing = true;
  previous = 0;
  serve(1);
  updateLabels();
  status.textContent = "First to seven wins. Keep the ball in play!";
  canvas.focus();
}

function finish() {
  playing = false;
  const won = playerScore > cpuScore;
  playSound(won ? "success" : "failure");
  status.textContent = won
    ? "You won the match! Choose New game for another."
    : "The computer won this one. Ready for a rematch?";
  window.Hugame?.score(playerScore);
  window.Hugame?.gameOver(playerScore);
}

function movePlayer(amount) {
  if (hostPaused) return;
  playerY = Math.max(0, Math.min(canvas.height - paddle.height, playerY + amount));
  draw();
  canvas.focus();
}

document
  .querySelectorAll("[data-move]")
  .forEach((button) =>
    button.addEventListener("click", () => movePlayer(Number(button.dataset.move) * 48)),
  );
startButton.addEventListener("click", newGame);
canvas.addEventListener("keydown", (event) => {
  if (hostPaused) return;
  if (["ArrowUp", "ArrowDown", "w", "s"].includes(event.key)) {
    event.preventDefault();
    keys.add(event.key.toLowerCase());
  }
});
canvas.addEventListener("keyup", (event) => keys.delete(event.key.toLowerCase()));
canvas.addEventListener("blur", () => keys.clear());
canvas.addEventListener("pointerdown", moveToPointer);
canvas.addEventListener("pointermove", (event) => {
  if (event.buttons) moveToPointer(event);
});

function moveToPointer(event) {
  if (hostPaused) return;
  const bounds = canvas.getBoundingClientRect();
  const y = ((event.clientY - bounds.top) / bounds.height) * canvas.height;
  playerY = Math.max(0, Math.min(canvas.height - paddle.height, y - paddle.height / 2));
  canvas.focus();
}

function bouncePaddle(x, y, side) {
  playSound("action");
  const center = y + paddle.height / 2;
  const offset = (ball.y - center) / (paddle.height / 2);
  ball.vx = Math.abs(ball.vx) * side * 1.035;
  ball.vy = Math.max(-330, Math.min(330, ball.vy + offset * 150));
  ball.x = side > 0 ? x + paddle.width + 9 : x - 9;
}

function update(dt) {
  const movement =
    (keys.has("arrowup") || keys.has("w") ? -1 : 0) +
    (keys.has("arrowdown") || keys.has("s") ? 1 : 0);
  movePlayer(movement * 330 * dt);
  const target = ball.y - paddle.height / 2;
  cpuY += Math.max(-235 * dt, Math.min(235 * dt, target - cpuY));
  cpuY = Math.max(0, Math.min(canvas.height - paddle.height, cpuY));
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;
  if (ball.y < 9 || ball.y > canvas.height - 9) {
    ball.y = Math.max(9, Math.min(canvas.height - 9, ball.y));
    ball.vy *= -1;
  }
  if (
    ball.vx < 0 &&
    ball.x - 9 <= 35 + paddle.width &&
    ball.x > 35 &&
    ball.y >= playerY &&
    ball.y <= playerY + paddle.height
  )
    bouncePaddle(35, playerY, 1);
  if (
    ball.vx > 0 &&
    ball.x + 9 >= 591 &&
    ball.x < 591 + paddle.width &&
    ball.y >= cpuY &&
    ball.y <= cpuY + paddle.height
  )
    bouncePaddle(591, cpuY, -1);
  if (ball.x < -20 || ball.x > canvas.width + 20) {
    const playerWon = ball.x > canvas.width;
    if (playerWon) playerScore++;
    else cpuScore++;
    updateLabels();
    window.Hugame?.score(playerScore);
    if (playerScore >= 7 || cpuScore >= 7) finish();
    else {
      playSound(playerWon ? "collect" : "failure");
      serve(playerWon ? -1 : 1);
    }
  }
}

function draw() {
  const court = ctx.createLinearGradient(0, 0, 0, canvas.height);
  court.addColorStop(0, "#1a0a42");
  court.addColorStop(1, "#3b126c");
  ctx.fillStyle = court;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "#ff4fa333";
  ctx.lineWidth = 2;
  for (let y = 40; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
  ctx.setLineDash([12, 14]);
  ctx.strokeStyle = "#fff36b99";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 18);
  ctx.lineTo(canvas.width / 2, canvas.height - 18);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.shadowColor = "#42e8e0";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#42e8e0";
  ctx.roundRect(35, playerY, paddle.width, paddle.height, 7);
  ctx.fill();
  ctx.shadowColor = "#ff4fa3";
  ctx.fillStyle = "#ff4fa3";
  ctx.roundRect(591, cpuY, paddle.width, paddle.height, 7);
  ctx.fill();
  ctx.shadowColor = "#fff36b";
  ctx.shadowBlur = 22;
  ctx.fillStyle = "#fff36b";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function tick(now) {
  const dt = !hostPaused && previous ? Math.min(0.035, (now - previous) / 1000) : 0;
  previous = now;
  if (!hostPaused) {
    if (playing) update(dt);
    draw();
  }
  requestAnimationFrame(tick);
}

window.Hugame?.on?.("pause", () => {
  if (hostPaused) return;
  hostPaused = true;
  keys.clear();
  statusBeforePause = status.textContent;
  if (playing) status.textContent = "Paused. The ball is holding its position.";
});
window.Hugame?.on?.("resume", () => {
  if (!hostPaused) return;
  hostPaused = false;
  previous = 0;
  if (playing) status.textContent = statusBeforePause;
});

updateLabels();
draw();
requestAnimationFrame(tick);
