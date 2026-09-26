import { playSound } from "./sound.js";

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const startButton = document.querySelector("#start");
const dropButton = document.querySelector("#drop");
const scoreLabel = document.querySelector("#score");
const timeLabel = document.querySelector("#time");
const status = document.querySelector("#status");
const saveStatus = document.querySelector("#save-status");

const miner = { x: 400, y: 38 };
let treasures = [];
let score = 0;
let timeLeft = 45;
let playing = false;
let hostPaused = false;
let previous = 0;
let angle = -0.9;
let swingDirection = 1;
let ropeLength = 55;
let clawState = "swinging";
let caught = null;
let roundTreasures = 0;
let profile = {
  completedRounds: 0,
  totalScore: 0,
  totalTreasures: 0,
  bestScore: 0,
};

function tell(message) {
  status.textContent = message;
}

function random(min, max) {
  return min + Math.random() * (max - min);
}

function overlaps(candidate) {
  return treasures.some(
    (item) =>
      Math.hypot(item.x - candidate.x, item.y - candidate.y) <
      item.radius + candidate.radius + 18,
  );
}

function makeTreasure(kind, x, y, radius) {
  const table = {
    nugget: {
      value: Math.round(radius * 11),
      weight: 1 + radius / 22,
      color: "#ffc83d",
    },
    boulder: { value: 25, weight: 4.5, color: "#786c70" },
    gem: { value: 650, weight: 0.75, color: "#62efff" },
  };
  return { kind, x, y, radius, ...table[kind] };
}

function fillMine() {
  treasures = [];
  const kinds = [
    ...Array(10).fill("nugget"),
    ...Array(5).fill("boulder"),
    ...Array(3).fill("gem"),
  ];
  for (const kind of kinds) {
    const radius =
      kind === "gem"
        ? 12
        : kind === "boulder"
          ? random(19, 30)
          : random(15, 28);
    let item;
    for (let attempt = 0; attempt < 80; attempt++) {
      item = makeTreasure(kind, random(45, 755), random(155, 415), radius);
      if (!overlaps(item)) break;
    }
    treasures.push(item);
  }
}

function updateScore(value) {
  score = value;
  scoreLabel.textContent = String(score);
  window.Hugame?.score(score);
}

function hookPosition() {
  return {
    x: miner.x + Math.sin(angle) * ropeLength,
    y: miner.y + Math.cos(angle) * ropeLength,
  };
}

function releaseClaw() {
  if (!playing || hostPaused || clawState !== "swinging") return;
  clawState = "extending";
  dropButton.disabled = true;
  playSound("action");
  tell("The claw is digging down…");
}

function reportAchievement(action) {
  if (!window.Hugame?.achievements) return;
  action(window.Hugame.achievements).catch((error) => {
    saveStatus.textContent = `Achievement unavailable: ${error.message}`;
  });
}

function collectCaught() {
  if (!caught) return;
  playSound("collect");
  updateScore(score + caught.value);
  if (caught.kind !== "boulder") {
    roundTreasures++;
    reportAchievement((achievements) => achievements.unlock("first-find"));
    reportAchievement((achievements) =>
      achievements.setProgress(
        "treasure-hunter",
        profile.totalTreasures + roundTreasures,
      ),
    );
  }
  tell(
    caught.kind === "gem"
      ? `A sparkling gem! +${caught.value}`
      : caught.kind === "boulder"
        ? `A heavy rock. +${caught.value}`
        : `Golden haul! +${caught.value}`,
  );
  caught = null;
}

async function finishRound() {
  if (!playing) return;
  playing = false;
  dropButton.disabled = true;
  playSound(score ? "success" : "failure");
  tell(`Time! You hauled up ${score} points.`);
  window.Hugame?.gameOver(score);
  profile = {
    completedRounds: profile.completedRounds + 1,
    totalScore: profile.totalScore + score,
    totalTreasures: profile.totalTreasures + roundTreasures,
    bestScore: Math.max(profile.bestScore, score),
  };
  if (!window.Hugame?.progress) {
    saveStatus.textContent = `Best: ${profile.bestScore}. Play again and beat it!`;
    return;
  }
  try {
    const saved = await window.Hugame.progress.save(profile, {
      schemaVersion: 1,
    });
    saveStatus.textContent = `Miner record saved (${saved.storage}). Best: ${profile.bestScore}.`;
    await window.Hugame.achievements?.setProgress(
      "gold-rush",
      profile.totalScore,
    );
  } catch (error) {
    saveStatus.textContent = `Record not saved: ${error.message}`;
  }
}

function newGame() {
  fillMine();
  updateScore(0);
  timeLeft = 45;
  timeLabel.textContent = "45";
  playing = true;
  previous = 0;
  angle = -0.9;
  swingDirection = 1;
  ropeLength = 55;
  clawState = "swinging";
  caught = null;
  roundTreasures = 0;
  dropButton.disabled = false;
  tell("Press Space or tap the mine when the claw points at treasure.");
  saveStatus.textContent = `All-time gold: ${profile.totalScore}. Best: ${profile.bestScore}.`;
  canvas.focus();
  draw();
}

function roundedBox(x, y, width, height, radius, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function drawTreasure(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  if (item.kind === "gem") {
    ctx.fillStyle = item.color;
    ctx.beginPath();
    ctx.moveTo(0, -item.radius);
    ctx.lineTo(item.radius, -2);
    ctx.lineTo(item.radius * 0.55, item.radius);
    ctx.lineTo(-item.radius * 0.55, item.radius);
    ctx.lineTo(-item.radius, -2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#d8ffff";
    ctx.lineWidth = 3;
    ctx.stroke();
  } else {
    ctx.fillStyle = item.color;
    ctx.beginPath();
    for (let point = 0; point < 9; point++) {
      const turn = (point / 9) * Math.PI * 2;
      const distance = item.radius * (point % 2 ? 0.78 : 1);
      ctx.lineTo(Math.cos(turn) * distance, Math.sin(turn) * distance);
    }
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = item.kind === "nugget" ? "#fff19a" : "#afa1a0";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
}

function drawMiner() {
  roundedBox(342, 15, 116, 50, 18, "#743b29");
  ctx.fillStyle = "#f2ba83";
  ctx.beginPath();
  ctx.arc(miner.x, 34, 20, 0, Math.PI * 2);
  ctx.fill();
  roundedBox(376, 11, 48, 13, 6, "#ffd14f");
  roundedBox(370, 20, 60, 8, 4, "#e39b2d");
  ctx.fillStyle = "#2b1721";
  ctx.beginPath();
  ctx.arc(393, 34, 2.5, 0, Math.PI * 2);
  ctx.arc(407, 34, 2.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#6b301f";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(400, 40, 9, 0.15, Math.PI - 0.15);
  ctx.stroke();
}

function draw() {
  const sky = ctx.createLinearGradient(0, 0, 0, 450);
  sky.addColorStop(0, "#55223c");
  sky.addColorStop(0.28, "#8a463d");
  sky.addColorStop(0.29, "#3b2637");
  sky.addColorStop(1, "#120f20");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, 800, 450);
  ctx.fillStyle = "#f2a650";
  ctx.beginPath();
  ctx.moveTo(0, 130);
  for (let x = 0; x <= 800; x += 50)
    ctx.lineTo(x, 115 + Math.sin(x * 0.035) * 22);
  ctx.lineTo(800, 150);
  ctx.lineTo(0, 150);
  ctx.fill();
  ctx.fillStyle = "#2b1a2b";
  for (let x = 25; x < 800; x += 75) {
    ctx.beginPath();
    ctx.arc(x, 210 + (x % 130), 4 + (x % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  treasures.forEach(drawTreasure);
  const hook = hookPosition();
  ctx.strokeStyle = "#d8c4a8";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(miner.x, miner.y + 18);
  ctx.lineTo(hook.x, hook.y);
  ctx.stroke();
  ctx.save();
  ctx.translate(hook.x, hook.y);
  ctx.rotate(-angle);
  ctx.strokeStyle = "#dce5ed";
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-13, -2);
  ctx.quadraticCurveTo(-18, 15, -7, 22);
  ctx.moveTo(13, -2);
  ctx.quadraticCurveTo(18, 15, 7, 22);
  ctx.stroke();
  ctx.restore();
  if (caught)
    drawTreasure({ ...caught, x: hook.x, y: hook.y + caught.radius + 12 });
  drawMiner();
  if (!playing) {
    roundedBox(245, 184, 310, 90, 16, "#100b19e8");
    ctx.fillStyle = "#ffe58d";
    ctx.textAlign = "center";
    ctx.font = "bold 28px system-ui";
    ctx.fillText(score ? `Final haul: ${score}` : "Gold Miner", 400, 222);
    ctx.fillStyle = "#fff8df";
    ctx.font = "17px system-ui";
    ctx.fillText("Press New game to enter the mine", 400, 252);
  }
}

function updateClaw(dt) {
  if (clawState === "swinging") {
    angle += swingDirection * dt * 1.35;
    if (angle > 1.15 || angle < -1.15) {
      angle = Math.max(-1.15, Math.min(1.15, angle));
      swingDirection *= -1;
    }
    return;
  }
  if (clawState === "extending") {
    ropeLength += 360 * dt;
    const hook = hookPosition();
    const hit = treasures.find(
      (item) =>
        Math.hypot(item.x - hook.x, item.y - hook.y) <= item.radius + 15,
    );
    if (hit) {
      caught = hit;
      treasures = treasures.filter((item) => item !== hit);
      clawState = "retracting";
    } else if (hook.x < 5 || hook.x > 795 || hook.y > 445)
      clawState = "retracting";
    return;
  }
  const speed = 330 / (caught?.weight ?? 1);
  ropeLength = Math.max(55, ropeLength - speed * dt);
  if (ropeLength === 55) {
    collectCaught();
    clawState = "swinging";
    dropButton.disabled = false;
  }
}

function tick(now) {
  const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 0;
  previous = now;
  if (playing && !hostPaused) {
    timeLeft = Math.max(0, timeLeft - dt);
    timeLabel.textContent = String(Math.ceil(timeLeft));
    updateClaw(dt);
    if (timeLeft === 0) void finishRound();
    draw();
  }
  requestAnimationFrame(tick);
}

startButton.addEventListener("click", () => {
  playSound("start");
  newGame();
});
dropButton.addEventListener("click", releaseClaw);
canvas.addEventListener("pointerdown", () => {
  canvas.focus();
  releaseClaw();
});
canvas.addEventListener("keydown", (event) => {
  if (event.code === "Space" || event.code === "Enter") {
    event.preventDefault();
    releaseClaw();
  }
});

window.Hugame?.on?.("pause", () => {
  hostPaused = true;
  if (playing) tell("Paused. Your timer is safe.");
});
window.Hugame?.on?.("resume", () => {
  hostPaused = false;
  previous = 0;
  if (playing) tell("Back to the mine! Drop the claw when you are ready.");
});
window.Hugame?.on?.("viewport", () => draw());

async function loadProfile() {
  if (window.Hugame?.progress) {
    try {
      const saved = await window.Hugame.progress.load();
      if (saved.data && saved.schemaVersion !== 1)
        throw new Error("This record uses a newer format.");
      if (saved.data) profile = { ...profile, ...saved.data };
      saveStatus.textContent = `Miner record loaded (${saved.storage}). Best: ${profile.bestScore}.`;
    } catch (error) {
      saveStatus.textContent = `Miner record unavailable: ${error.message}`;
    }
  } else
    saveStatus.textContent =
      "Local standalone play does not save your miner record.";
  startButton.disabled = false;
  tell("Press New game to begin.");
  draw();
}

draw();
void loadProfile();
requestAnimationFrame(tick);
