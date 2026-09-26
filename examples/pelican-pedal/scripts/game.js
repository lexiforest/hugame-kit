import { playSound } from "./sound.js";

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");
const startButton = document.querySelector("#start");
const leftButton = document.querySelector("#left");
const rightButton = document.querySelector("#right");
const jumpButton = document.querySelector("#jump");
const scoreLabel = document.querySelector("#score");
const bestLabel = document.querySelector("#best");
const status = document.querySelector("#status");
const saveStatus = document.querySelector("#save-status");

const WIDTH = 960;
const HEIGHT = 600;
const RIDER_X = 250;
const GROUND_Y = 452;
const WHEEL_RADIUS = 27;
const METRES_PER_PIXEL = 0.08;
const profileDefaults = {
  rides: 0,
  bestDistance: 0,
  totalDistance: 0,
  monstersCleared: 0,
};

let profile = { ...profileDefaults };
let playing = false;
let hostPaused = false;
let previous = 0;
let worldX = 0;
let speed = 0;
let riderY = GROUND_Y - WHEEL_RADIUS;
let velocityY = 0;
let grounded = true;
let fellIntoGap = false;
let lastPedal = null;
let lastPedalAt = 0;
let pedalFlash = null;
let runMonsters = 0;
let clearedGaps = new Set();
let clearedMonsters = new Set();
let lastReportedScore = -1;
let scenery = [];
let gaps = [];
let monsters = [];

function tell(message) {
  status.textContent = message;
}

function reportAchievement(action) {
  if (!window.Hugame?.achievements) return;
  action(window.Hugame.achievements).catch((error) => {
    saveStatus.textContent = `Achievement unavailable: ${error.message}`;
  });
}

function buildCourse() {
  scenery = [];
  gaps = [];
  monsters = [];
  let obstacleX = 820 + Math.random() * 220;
  let sceneryX = 180 + Math.random() * 180;
  let previousObstacle = null;
  let repeatedObstacle = 0;

  for (let section = 0; section < 90; section++) {
    sceneryX += 280 + Math.random() * 220;
    scenery.push({
      x: sceneryX,
      kind: Math.floor(Math.random() * 3),
      size: 0.75 + Math.random() * 0.55,
    });

    const obstacle =
      repeatedObstacle >= 2
        ? previousObstacle === "gap"
          ? "monster"
          : "gap"
        : Math.random() < 0.48
          ? "gap"
          : "monster";

    if (obstacle === previousObstacle) repeatedObstacle++;
    else repeatedObstacle = 0;
    previousObstacle = obstacle;

    if (obstacle === "gap") {
      const width = 105 + Math.random() * Math.min(125, 50 + section * 2.5);
      gaps.push({ x: obstacleX, width, id: `g${section}` });
    } else {
      monsters.push({
        x: obstacleX,
        width: 54,
        height: 48 + Math.random() * 16,
        hue: Math.random() < 0.5 ? "#9b5de5" : "#ef476f",
        phase: Math.random() * Math.PI * 2,
        id: `m${section}`,
      });
    }

    obstacleX += 450 + Math.random() * 300;
  }
}

function gapAt(x) {
  return gaps.find((gap) => x > gap.x && x < gap.x + gap.width);
}

function groundAt(x) {
  return gapAt(x) ? HEIGHT + 100 : GROUND_Y;
}

function distance() {
  return Math.max(0, Math.floor(worldX * METRES_PER_PIXEL));
}

function updateScore() {
  const metres = distance();
  scoreLabel.textContent = String(metres);
  bestLabel.textContent = String(Math.max(profile.bestDistance, metres));
  if (metres !== lastReportedScore) {
    const previousScore = lastReportedScore;
    lastReportedScore = metres;
    window.Hugame?.score(metres);
    if (previousScore < 100 && metres >= 100)
      reportAchievement((achievements) =>
        achievements.setProgress("century-ride", metres),
      );
  }
}

function newRide() {
  playSound("start");
  buildCourse();
  playing = true;
  previous = 0;
  worldX = 0;
  speed = 0;
  riderY = GROUND_Y - WHEEL_RADIUS;
  velocityY = 0;
  grounded = true;
  fellIntoGap = false;
  lastPedal = null;
  lastPedalAt = 0;
  pedalFlash = null;
  runMonsters = 0;
  clearedGaps = new Set();
  clearedMonsters = new Set();
  lastReportedScore = -1;
  saveStatus.textContent = `Best ride: ${profile.bestDistance} m.`;
  tell("Alternate Left and Right to pedal. Space jumps!");
  canvas.focus();
  updateScore();
  draw();
}

function pedal(side) {
  if (!playing || hostPaused) return;
  const now = performance.now();
  pedalFlash = side;
  const button = side === "left" ? leftButton : rightButton;
  button.classList.add("pressed");
  setTimeout(() => button.classList.remove("pressed"), 90);

  if (side === lastPedal) {
    tell(`Use the ${side === "left" ? "right" : "left"} pedal next!`);
    return;
  }

  speed = Math.min(410, speed + 54);
  playSound("move");
  lastPedal = side;
  lastPedalAt = now;
  if (speed > 290) tell("Great rhythm! Watch the trail ahead.");
}

function jump() {
  if (!playing || hostPaused || !grounded) return;
  velocityY = -620;
  grounded = false;
  playSound("action");
  jumpButton.classList.add("pressed");
  setTimeout(() => jumpButton.classList.remove("pressed"), 90);
  tell("Wings up!");
}

async function endRide(reason) {
  if (!playing) return;
  playing = false;
  const metres = distance();
  speed = 0;
  playSound("failure");
  tell(`${reason} You rode ${metres} m. Press New game to try again.`);
  window.Hugame?.gameOver(metres);
  profile = {
    rides: profile.rides + 1,
    bestDistance: Math.max(profile.bestDistance, metres),
    totalDistance: profile.totalDistance + metres,
    monstersCleared: profile.monstersCleared + runMonsters,
  };
  bestLabel.textContent = String(profile.bestDistance);
  if (!window.Hugame?.progress) {
    saveStatus.textContent = `Best ride: ${profile.bestDistance} m.`;
    return;
  }
  try {
    const saved = await window.Hugame.progress.save(profile, { schemaVersion: 1 });
    saveStatus.textContent = `Cycling record saved (${saved.storage}). Best: ${profile.bestDistance} m.`;
    await window.Hugame.achievements?.setProgress(
      "monster-masher",
      profile.monstersCleared,
    );
  } catch (error) {
    saveStatus.textContent = `Record not saved: ${error.message}`;
  }
}

function update(dt, now) {
  const oldX = worldX;
  const oldRiderY = riderY;
  speed = Math.max(0, speed - dt * (lastPedal && now - lastPedalAt < 1200 ? 21 : 55));
  worldX += speed * dt;

  const currentGround = groundAt(worldX + 36);
  if (currentGround > HEIGHT && grounded) {
    grounded = false;
    fellIntoGap = true;
  }
  if (!grounded) {
    velocityY += 1450 * dt;
    riderY += velocityY * dt;
    const landingGround = groundAt(worldX + 36);
    if (
      !fellIntoGap &&
      landingGround === GROUND_Y &&
      riderY >= GROUND_Y - WHEEL_RADIUS
    ) {
      riderY = GROUND_Y - WHEEL_RADIUS;
      velocityY = 0;
      grounded = true;
    }
  }

  for (const gap of gaps) {
    const rear = oldX - 25;
    const front = worldX - 25;
    if (!clearedGaps.has(gap.id) && rear < gap.x + gap.width && front >= gap.x + gap.width) {
      clearedGaps.add(gap.id);
      playSound("collect");
      reportAchievement((achievements) => achievements.unlock("first-flight"));
      tell("Bridge cleared! Keep pedalling.");
    }
  }

  for (const monster of monsters) {
    if (clearedMonsters.has(monster.id)) continue;
    const relativeX = monster.x - worldX + RIDER_X;
    if (relativeX < RIDER_X - 45) {
      clearedMonsters.add(monster.id);
      runMonsters++;
      playSound("collect");
      tell("Monster dodged!");
      reportAchievement((achievements) =>
        achievements.setProgress(
          "monster-masher",
          profile.monstersCleared + runMonsters,
        ),
      );
      continue;
    }
    const monsterTop = GROUND_Y - monster.height + Math.sin(now * 0.004 + monster.phase) * 5;
    const previousWheelBottom = oldRiderY + WHEEL_RADIUS;
    const wheelBottom = riderY + WHEEL_RADIUS;
    const riderBottom = riderY + 5;
    const touchingMonster =
      Math.abs(relativeX - RIDER_X) < monster.width * 0.55 + 27 &&
      wheelBottom > monsterTop + 4 &&
      riderBottom < GROUND_Y + 20;
    if (!touchingMonster) continue;

    const stompedMonster =
      !grounded &&
      velocityY > 0 &&
      previousWheelBottom <= monsterTop + 8;
    if (stompedMonster) {
      clearedMonsters.add(monster.id);
      runMonsters++;
      riderY = monsterTop - WHEEL_RADIUS;
      velocityY = -300;
      playSound("collect");
      tell("Monster stomped!");
      reportAchievement((achievements) =>
        achievements.setProgress(
          "monster-masher",
          profile.monstersCleared + runMonsters,
        ),
      );
    } else {
      void endRide("A marsh monster caught your wheel!");
      return;
    }
  }

  if (riderY > HEIGHT + 60) {
    void endRide("Splash! The bridge had a gap.");
    return;
  }
  updateScore();
}

function roundRect(x, y, width, height, radius, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  ctx.fill();
}

function drawCloud(x, y, scale) {
  ctx.fillStyle = "#ffffffc9";
  ctx.beginPath();
  ctx.arc(x, y, 28 * scale, Math.PI, 0);
  ctx.arc(x + 34 * scale, y - 16 * scale, 35 * scale, Math.PI, 0);
  ctx.arc(x + 72 * scale, y, 27 * scale, Math.PI, 0);
  ctx.lineTo(x + 72 * scale, y + 18 * scale);
  ctx.lineTo(x, y + 18 * scale);
  ctx.closePath();
  ctx.fill();
}

function drawBackground() {
  const sky = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  sky.addColorStop(0, "#62d5ef");
  sky.addColorStop(0.62, "#d9f6de");
  sky.addColorStop(1, "#ffd67c");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "#fff8ab";
  ctx.beginPath();
  ctx.arc(805, 95, 52, 0, Math.PI * 2);
  ctx.fill();
  drawCloud(80 - (worldX * 0.06) % 1100, 105, 1);
  drawCloud(570 - (worldX * 0.035) % 1200, 165, 0.72);

  ctx.fillStyle = "#51b8d0";
  ctx.fillRect(0, 318, WIDTH, HEIGHT - 318);
  ctx.strokeStyle = "#b7f7f1";
  ctx.lineWidth = 5;
  for (let x = -((worldX * 0.22) % 90); x < WIDTH + 90; x += 90) {
    ctx.beginPath();
    ctx.arc(x, 360, 42, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();
  }

  ctx.fillStyle = "#65b47a";
  ctx.beginPath();
  ctx.moveTo(0, 354);
  for (let x = 0; x <= WIDTH; x += 80)
    ctx.lineTo(x, 335 + Math.sin((x + worldX * 0.12) * 0.015) * 30);
  ctx.lineTo(WIDTH, 410);
  ctx.lineTo(0, 410);
  ctx.fill();
}

function drawScenery() {
  for (const item of scenery) {
    const x = item.x - worldX * 0.72 + RIDER_X;
    if (x < -100 || x > WIDTH + 100) continue;
    ctx.save();
    ctx.translate(x, 385);
    ctx.scale(item.size, item.size);
    if (item.kind === 0) {
      ctx.strokeStyle = "#7f6542";
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(0, 40);
      ctx.lineTo(0, -34);
      ctx.stroke();
      ctx.fillStyle = "#58a94f";
      for (const turn of [-1.15, -0.5, 0.15]) {
        ctx.save();
        ctx.rotate(turn);
        ctx.beginPath();
        ctx.ellipse(16, -35, 13, 42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    } else {
      ctx.fillStyle = item.kind === 1 ? "#ff8fa4" : "#ffd166";
      for (let petal = 0; petal < 6; petal++) {
        const angle = (petal / 6) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(Math.cos(angle) * 15, Math.sin(angle) * 15, 12, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = "#6b4f32";
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function drawTrail() {
  ctx.fillStyle = "#72553f";
  ctx.fillRect(0, GROUND_Y + 16, WIDTH, HEIGHT - GROUND_Y);
  ctx.fillStyle = "#f4c565";
  ctx.fillRect(0, GROUND_Y, WIDTH, 25);
  ctx.fillStyle = "#ffe69b";
  ctx.fillRect(0, GROUND_Y, WIDTH, 7);

  for (const gap of gaps) {
    const x = gap.x - worldX + RIDER_X;
    if (x > WIDTH || x + gap.width < 0) continue;
    ctx.clearRect(x, GROUND_Y - 1, gap.width, HEIGHT - GROUND_Y + 1);
    ctx.fillStyle = "#328fae";
    ctx.fillRect(x, GROUND_Y - 1, gap.width, HEIGHT - GROUND_Y + 1);
    ctx.fillStyle = "#fff0c2";
    for (const edge of [x - 7, x + gap.width]) {
      ctx.save();
      ctx.translate(edge, GROUND_Y + 9);
      ctx.rotate(edge === x - 7 ? -0.35 : 0.35);
      ctx.fillRect(-6, -16, 12, 34);
      ctx.restore();
    }
  }

  ctx.strokeStyle = "#be8740";
  ctx.lineWidth = 4;
  for (let x = -((worldX - RIDER_X) % 74); x < WIDTH; x += 74) {
    if (!gapAt(worldX + x - RIDER_X)) {
      ctx.beginPath();
      ctx.moveTo(x, GROUND_Y + 5);
      ctx.lineTo(x + 20, GROUND_Y + 19);
      ctx.stroke();
    }
  }
}

function drawMonster(monster, now) {
  const x = monster.x - worldX + RIDER_X;
  if (x < -100 || x > WIDTH + 100 || clearedMonsters.has(monster.id)) return;
  const bounce = Math.sin(now * 0.004 + monster.phase) * 5;
  const y = GROUND_Y - monster.height + bounce;
  ctx.fillStyle = monster.hue;
  ctx.beginPath();
  ctx.roundRect(x - monster.width / 2, y, monster.width, monster.height + 12, 22);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(x - 11, y + 17, 8, 0, Math.PI * 2);
  ctx.arc(x + 11, y + 17, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#173658";
  ctx.beginPath();
  ctx.arc(x - 9, y + 18, 3, 0, Math.PI * 2);
  ctx.arc(x + 9, y + 18, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#572858";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 12, y + 39);
  ctx.quadraticCurveTo(x, y + 31, x + 12, y + 39);
  ctx.stroke();
  ctx.strokeStyle = monster.hue;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x - 15, GROUND_Y + 4);
  ctx.lineTo(x - 20, GROUND_Y + 13);
  ctx.moveTo(x + 15, GROUND_Y + 4);
  ctx.lineTo(x + 20, GROUND_Y + 13);
  ctx.stroke();
}

function drawBike(now) {
  const x = RIDER_X;
  const y = riderY;
  const spin = worldX / WHEEL_RADIUS;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = "#173658";
  ctx.lineWidth = 5;
  for (const wheelX of [-35, 35]) {
    ctx.beginPath();
    ctx.arc(wheelX, 0, WHEEL_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.save();
    ctx.translate(wheelX, 0);
    ctx.rotate(spin);
    ctx.lineWidth = 2;
    for (let spoke = 0; spoke < 4; spoke++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(-WHEEL_RADIUS + 3, 0);
      ctx.lineTo(WHEEL_RADIUS - 3, 0);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.strokeStyle = "#ff675d";
  ctx.lineWidth = 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(-35, 0);
  ctx.lineTo(-5, -28);
  ctx.lineTo(18, 0);
  ctx.lineTo(-35, 0);
  ctx.lineTo(4, 0);
  ctx.lineTo(35, 0);
  ctx.lineTo(20, -37);
  ctx.stroke();
  ctx.strokeStyle = "#173658";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(20, -37);
  ctx.lineTo(37, -42);
  ctx.moveTo(-13, -32);
  ctx.lineTo(-1, -32);
  ctx.stroke();

  const pedalAngle = spin * 1.6;
  ctx.fillStyle = "#173658";
  ctx.beginPath();
  ctx.arc(3, 0, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#173658";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(3, 0);
  ctx.lineTo(3 + Math.cos(pedalAngle) * 18, Math.sin(pedalAngle) * 18);
  ctx.stroke();

  ctx.translate(-6, -73);
  ctx.rotate(grounded ? Math.sin(now * 0.012) * 0.025 : -0.09);
  ctx.fillStyle = "#fff7e0";
  ctx.beginPath();
  ctx.ellipse(0, 0, 27, 41, -0.15, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#f6a93b";
  ctx.beginPath();
  ctx.moveTo(18, -22);
  ctx.lineTo(62, -12);
  ctx.lineTo(19, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fff7e0";
  ctx.beginPath();
  ctx.arc(5, -35, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#173658";
  ctx.beginPath();
  ctx.arc(13, -41, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#59b7d4";
  ctx.beginPath();
  ctx.moveTo(-18, -47);
  ctx.quadraticCurveTo(5, -75, 28, -50);
  ctx.lineTo(22, -36);
  ctx.quadraticCurveTo(0, -54, -18, -35);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#f6a93b";
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(-14, 28);
  ctx.lineTo(-9 + Math.cos(pedalAngle) * 18, 64 + Math.sin(pedalAngle) * 12);
  ctx.moveTo(6, 28);
  ctx.lineTo(11 - Math.cos(pedalAngle) * 18, 64 - Math.sin(pedalAngle) * 12);
  ctx.stroke();
  ctx.restore();
}

function drawSpeedometer() {
  roundRect(22, HEIGHT - 76, 177, 48, 15, "#ffffffd9");
  ctx.fillStyle = "#39718b";
  ctx.font = "800 13px system-ui";
  ctx.fillText("PEDAL RHYTHM", 38, HEIGHT - 55);
  roundRect(38, HEIGHT - 47, 143, 10, 5, "#d8e7dd");
  roundRect(38, HEIGHT - 47, (143 * speed) / 410, 10, 5, "#ff675d");
}

function draw(now = 0) {
  drawBackground();
  drawScenery();
  drawTrail();
  monsters.forEach((monster) => drawMonster(monster, now));
  drawBike(now);
  drawSpeedometer();

  if (!playing) {
    roundRect(274, 214, 412, 144, 25, "#173658df");
    ctx.fillStyle = "#fff4a8";
    ctx.textAlign = "center";
    ctx.font = "900 35px ui-rounded, system-ui";
    ctx.fillText(distance() ? `${distance()} metres!` : "Ready to ride?", WIDTH / 2, 266);
    ctx.fillStyle = "#fff";
    ctx.font = "700 18px system-ui";
    ctx.fillText("Left · Right · Left · Right to pedal", WIDTH / 2, 304);
    ctx.fillText("Space to jump", WIDTH / 2, 332);
    ctx.textAlign = "start";
  }
}

function tick(now) {
  const dt = previous ? Math.min((now - previous) / 1000, 0.04) : 0;
  previous = now;
  if (playing && !hostPaused) update(dt, now);
  draw(now);
  requestAnimationFrame(tick);
}

function bindButton(button, action) {
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    action();
    canvas.focus();
  });
}

startButton.addEventListener("click", newRide);
bindButton(leftButton, () => pedal("left"));
bindButton(rightButton, () => pedal("right"));
bindButton(jumpButton, jump);
canvas.addEventListener("pointerdown", () => {
  canvas.focus();
  jump();
});
window.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (event.code === "ArrowLeft" || event.code === "KeyA") {
    event.preventDefault();
    pedal("left");
  } else if (event.code === "ArrowRight" || event.code === "KeyD") {
    event.preventDefault();
    pedal("right");
  } else if (event.code === "Space" || event.code === "ArrowUp" || event.code === "KeyW") {
    event.preventDefault();
    jump();
  }
});

window.Hugame?.on?.("pause", () => {
  hostPaused = true;
  if (playing) tell("Ride paused. Pip is balancing safely.");
});
window.Hugame?.on?.("resume", () => {
  hostPaused = false;
  previous = 0;
  if (playing) tell("Ride on! Alternate Left and Right to pedal.");
});
window.Hugame?.on?.("viewport", () => draw());

async function loadProfile() {
  if (window.Hugame?.progress) {
    try {
      const saved = await window.Hugame.progress.load();
      if (saved.data && saved.schemaVersion !== 1)
        throw new Error("This cycling record uses a newer format.");
      if (saved.data) profile = { ...profileDefaults, ...saved.data };
      saveStatus.textContent = `Cycling record loaded (${saved.storage}).`;
    } catch (error) {
      saveStatus.textContent = `Cycling record unavailable: ${error.message}`;
    }
  } else {
    saveStatus.textContent = "Standalone play keeps no cycling record.";
  }
  bestLabel.textContent = String(profile.bestDistance);
  startButton.disabled = false;
  tell("Press New game, then alternate Left and Right.");
  draw();
}

buildCourse();
draw();
void loadProfile();
requestAnimationFrame(tick);
