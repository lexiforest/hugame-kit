import { playSound } from "./sound.js";

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const startButton = document.querySelector("#start");
const eraseButton = document.querySelector("#erase");
const pad = document.querySelector(".number-pad");
const scoreLabel = document.querySelector("#score");
const status = document.querySelector("#status");
const baseSolution =
  "534678912672195348198342567859761423426853791713924856961537284287419635345286179";
const basePuzzle =
  "530070000600195000098000060800060003400803001700020006060000280000419005000080079";
const cellSize = canvas.width / 9;
let solution = [];
let values = [];
let fixed = [];
let selected = 2;
let playing = false;
let startedAt = 0;
let seconds = 0;

for (let number = 1; number <= 9; number++) {
  const button = document.createElement("button");
  button.textContent = String(number);
  button.setAttribute("aria-label", `Enter ${number}`);
  button.addEventListener("click", () => enter(number));
  pad.append(button);
}

function shuffledDigits() {
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]];
  }
  return digits;
}

function updateTime() {
  if (playing) seconds = Math.floor((Date.now() - startedAt) / 1000);
  scoreLabel.textContent = String(seconds);
}

function newGame() {
  const map = shuffledDigits();
  solution = [...baseSolution].map((value) => map[Number(value) - 1]);
  values = [...basePuzzle].map((value) => (value === "0" ? 0 : map[Number(value) - 1]));
  fixed = values.map(Boolean);
  selected = values.findIndex((value) => !value);
  playing = true;
  startedAt = Date.now();
  seconds = 0;
  status.textContent = "Select a square and enter a number.";
  updateTime();
  draw();
  canvas.focus();
}

function enter(number) {
  if (!playing || fixed[selected]) return;
  values[selected] = number;
  const wrong = Boolean(number && number !== solution[selected]);
  if (wrong)
    status.textContent = "That number does not fit here yet.";
  else status.textContent = "Keep going — every row, column, and box matters.";
  const solved = values.every(Boolean) && values.every((value, i) => value === solution[i]);
  if (solved) {
    playing = false;
    playSound("success");
    updateTime();
    seconds = Math.max(1, seconds);
    scoreLabel.textContent = String(seconds);
    status.textContent = `Puzzle solved in ${seconds} seconds!`;
    window.Hugame?.score(seconds);
    window.Hugame?.gameOver(seconds);
  } else playSound(wrong ? "failure" : "move");
  draw();
  canvas.focus();
}

function selectFromPointer(event) {
  const bounds = canvas.getBoundingClientRect();
  const x = Math.max(
    0,
    Math.min(8, Math.floor(((event.clientX - bounds.left) / bounds.width) * 9)),
  );
  const y = Math.max(
    0,
    Math.min(8, Math.floor(((event.clientY - bounds.top) / bounds.height) * 9)),
  );
  selected = y * 9 + x;
  draw();
  canvas.focus();
}

canvas.addEventListener("pointerdown", selectFromPointer);
canvas.addEventListener("keydown", (event) => {
  const row = Math.floor(selected / 9);
  const column = selected % 9;
  if (event.key === "ArrowLeft") selected = row * 9 + Math.max(0, column - 1);
  else if (event.key === "ArrowRight") selected = row * 9 + Math.min(8, column + 1);
  else if (event.key === "ArrowUp") selected = Math.max(0, row - 1) * 9 + column;
  else if (event.key === "ArrowDown") selected = Math.min(8, row + 1) * 9 + column;
  else if (/^[1-9]$/.test(event.key)) {
    enter(Number(event.key));
    return;
  } else if (["Backspace", "Delete", "0"].includes(event.key)) {
    enter(0);
    return;
  } else return;
  event.preventDefault();
  draw();
});
startButton.addEventListener("click", () => {
  playSound("start");
  newGame();
});
eraseButton.addEventListener("click", () => enter(0));

function draw() {
  ctx.fillStyle = "#fffaf0";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const selectedValue = values[selected];
  values.forEach((value, i) => {
    const x = (i % 9) * cellSize;
    const y = Math.floor(i / 9) * cellSize;
    const related =
      i === selected ||
      (selectedValue && value === selectedValue) ||
      i % 9 === selected % 9 ||
      Math.floor(i / 9) === Math.floor(selected / 9);
    ctx.fillStyle = i === selected ? "#f4b3a7" : related ? "#dbe8e2" : "#fffaf0";
    ctx.fillRect(x, y, cellSize, cellSize);
    if (value) {
      ctx.fillStyle = fixed[i] ? "#263c49" : value === solution[i] ? "#287b72" : "#c83d45";
      ctx.font = `${fixed[i] ? "bold" : "600"} 29px Avenir, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(value), x + cellSize / 2, y + cellSize / 2 + 1);
    }
  });
  for (let i = 0; i <= 9; i++) {
    ctx.beginPath();
    ctx.strokeStyle = i % 3 === 0 ? "#263c49" : "#b8b3a5";
    ctx.lineWidth = i % 3 === 0 ? 4 : 1;
    ctx.moveTo(i * cellSize, 0);
    ctx.lineTo(i * cellSize, canvas.height);
    ctx.moveTo(0, i * cellSize);
    ctx.lineTo(canvas.width, i * cellSize);
    ctx.stroke();
  }
}

setInterval(() => {
  if (playing) updateTime();
}, 250);
newGame();
playing = false;
status.textContent = "Choose New game for a puzzle.";
