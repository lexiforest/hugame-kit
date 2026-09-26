import { playSound } from "./sound.js";

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const startButton = document.querySelector("#start");
const status = document.querySelector("#status");
const lines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];
let board = Array(9).fill("");
let playing = false;
let thinking = false;
let selected = 4;
let winningLine = null;

function winner(state = board) {
  for (const line of lines)
    if (state[line[0]] && line.every((cell) => state[cell] === state[line[0]]))
      return { mark: state[line[0]], line };
  return state.every(Boolean) ? { mark: "draw", line: null } : null;
}

function newGame() {
  board = Array(9).fill("");
  playing = true;
  thinking = false;
  selected = 4;
  winningLine = null;
  status.textContent = "Your turn. You are X.";
  draw();
  canvas.focus();
}

function finish(result) {
  playing = false;
  winningLine = result.line;
  playSound(result.mark === "X" ? "success" : result.mark === "O" ? "failure" : "action");
  status.textContent =
    result.mark === "X"
      ? "Three in a row — you win!"
      : result.mark === "O"
        ? "The computer found three. Try a rematch!"
        : "A perfect draw. Play again?";
  window.Hugame?.gameOver(result.mark === "X" ? 1 : 0);
  draw();
}

function tacticalMove(mark) {
  for (let i = 0; i < 9; i++) {
    if (board[i]) continue;
    const copy = [...board];
    copy[i] = mark;
    if (winner(copy)?.mark === mark) return i;
  }
  return -1;
}

function computerMove() {
  if (!playing) return;
  let move = tacticalMove("O");
  if (move < 0) move = tacticalMove("X");
  if (move < 0 && !board[4]) move = 4;
  const openCorners = [0, 2, 6, 8].filter((i) => !board[i]);
  if (move < 0 && openCorners.length)
    move = openCorners[Math.floor(Math.random() * openCorners.length)];
  const open = board.map((value, i) => (!value ? i : -1)).filter((i) => i >= 0);
  if (move < 0) move = open[Math.floor(Math.random() * open.length)];
  board[move] = "O";
  thinking = false;
  const result = winner();
  if (result) finish(result);
  else {
    playSound("action");
    status.textContent = "Your turn. Find a line for X.";
    draw();
  }
}

function play(index) {
  if (!playing || thinking || board[index]) return;
  selected = index;
  board[index] = "X";
  const result = winner();
  if (result) {
    finish(result);
    return;
  }
  playSound("move");
  thinking = true;
  status.textContent = "Computer is thinking…";
  draw();
  setTimeout(computerMove, 260);
}

function pointFromEvent(event) {
  const bounds = canvas.getBoundingClientRect();
  const x = Math.max(
    0,
    Math.min(2, Math.floor(((event.clientX - bounds.left) / bounds.width) * 3)),
  );
  const y = Math.max(
    0,
    Math.min(2, Math.floor(((event.clientY - bounds.top) / bounds.height) * 3)),
  );
  return y * 3 + x;
}

canvas.addEventListener("pointerdown", (event) => {
  canvas.focus();
  play(pointFromEvent(event));
});
canvas.addEventListener("keydown", (event) => {
  const row = Math.floor(selected / 3);
  const column = selected % 3;
  if (event.key === "ArrowLeft") selected = row * 3 + Math.max(0, column - 1);
  else if (event.key === "ArrowRight") selected = row * 3 + Math.min(2, column + 1);
  else if (event.key === "ArrowUp") selected = Math.max(0, row - 1) * 3 + column;
  else if (event.key === "ArrowDown") selected = Math.min(2, row + 1) * 3 + column;
  else if (event.code === "Space" || event.key === "Enter") {
    event.preventDefault();
    play(selected);
    return;
  } else return;
  event.preventDefault();
  draw();
});
startButton.addEventListener("click", () => {
  playSound("start");
  newGame();
});

function drawMark(mark, x, y) {
  const centerX = x * 160 + 80;
  const centerY = y * 160 + 80;
  ctx.lineWidth = 18;
  ctx.lineCap = "round";
  if (mark === "X") {
    ctx.strokeStyle = "#ee4f88";
    ctx.beginPath();
    ctx.moveTo(centerX - 42, centerY - 42);
    ctx.lineTo(centerX + 42, centerY + 42);
    ctx.moveTo(centerX + 42, centerY - 42);
    ctx.lineTo(centerX - 42, centerY + 42);
    ctx.stroke();
  } else if (mark === "O") {
    ctx.strokeStyle = "#2bb9b0";
    ctx.beginPath();
    ctx.arc(centerX, centerY, 51, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function draw() {
  ctx.fillStyle = "#fff5d9";
  ctx.fillRect(0, 0, 480, 480);
  ctx.fillStyle = "#ffd96b";
  ctx.fillRect((selected % 3) * 160 + 5, Math.floor(selected / 3) * 160 + 5, 150, 150);
  ctx.strokeStyle = "#7f5aa6";
  ctx.lineWidth = 7;
  for (const position of [160, 320]) {
    ctx.beginPath();
    ctx.moveTo(position, 18);
    ctx.lineTo(position, 462);
    ctx.moveTo(18, position);
    ctx.lineTo(462, position);
    ctx.stroke();
  }
  board.forEach((mark, i) => drawMark(mark, i % 3, Math.floor(i / 3)));
  if (winningLine) {
    const first = winningLine[0];
    const last = winningLine[2];
    ctx.strokeStyle = "#f04475";
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo((first % 3) * 160 + 80, Math.floor(first / 3) * 160 + 80);
    ctx.lineTo((last % 3) * 160 + 80, Math.floor(last / 3) * 160 + 80);
    ctx.stroke();
  }
}

newGame();
playing = false;
status.textContent = "Choose New game to begin.";
