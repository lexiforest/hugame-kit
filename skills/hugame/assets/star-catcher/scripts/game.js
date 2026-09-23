(() => {
  "use strict";
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const start = document.getElementById("start");
  const status = document.getElementById("status");
  const keys = new Set();
  const cursor = { x: 320, y: 180 };
  const target = { x: 320, y: 170 };
  const sky = Array.from({ length: 35 }, (_, index) => ({
    x: (index * 113 + 41) % 640,
    y: (index * 73 + 29) % 360,
    radius: (index % 3) + 1,
  }));
  let score = 0;
  let end = 0;
  let running = false;
  let previous = performance.now();
  let pausedAt = null;
  let totalStars = 0;
  let completedRounds = 0;
  let canSave = false;
  const saveStatus = document.getElementById("save-status");
  new ResizeObserver(([entry]) => {
    const scale = Math.min(entry.contentRect.width / 640, entry.contentRect.height / 360);
    canvas.style.width = `${640 * scale}px`;
    canvas.style.height = `${360 * scale}px`;
  }).observe(document.querySelector(".board"));
  if (window.Hugame?.progress) {
    start.disabled = true;
    window.Hugame.progress
      .load()
      .then((save) => {
        if (save.data && save.schemaVersion !== 1)
          throw new Error("This save uses a newer format.");
        totalStars = save.data?.totalStars || 0;
        completedRounds = save.data?.completedRounds || 0;
        canSave = true;
        saveStatus.textContent = `${totalStars} stars collected in ${completedRounds} completed rounds.`;
      })
      .catch((error) => {
        saveStatus.textContent = `Progress unavailable: ${error.message}`;
      })
      .finally(() => {
        start.disabled = false;
      });
  }
  window.Hugame?.on?.("pause", () => {
    if (pausedAt === null) pausedAt = performance.now();
    keys.clear();
  });
  window.Hugame?.on?.("resume", () => {
    if (pausedAt !== null && running) end += performance.now() - pausedAt;
    pausedAt = null;
  });

  function star(x, y, radius, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = -Math.PI / 2 + (i * Math.PI) / 5;
      const distance = i % 2 ? radius * 0.45 : radius;
      const px = x + Math.cos(angle) * distance;
      const py = y + Math.sin(angle) * distance;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }

  function catchStar(x, y) {
    if (pausedAt !== null || !running || Math.hypot(x - target.x, y - target.y) > 44) return;
    score++;
    target.x = 55 + Math.random() * 530;
    target.y = 90 + Math.random() * 215;
    status.textContent = `${score} ${score === 1 ? "star" : "stars"}! Keep going!`;
    window.Hugame?.score(score);
    if (score === 1)
      window.Hugame?.achievements?.unlock("first-star").catch((error) => {
        saveStatus.textContent = error.message;
      });
  }

  start.addEventListener("click", () => {
    if (pausedAt !== null) return;
    score = 0;
    running = true;
    end = performance.now() + 30000;
    target.x = 320;
    target.y = 170;
    cursor.x = 320;
    cursor.y = 170;
    status.textContent = "Let's catch some stars!";
    start.textContent = "Start again";
    canvas.focus();
    window.Hugame?.score(0);
  });
  canvas.addEventListener("pointerdown", (event) => {
    const bounds = canvas.getBoundingClientRect();
    catchStar(
      ((event.clientX - bounds.left) * 640) / bounds.width,
      ((event.clientY - bounds.top) * 360) / bounds.height,
    );
  });
  canvas.addEventListener("keydown", (event) => {
    if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key))
      event.preventDefault();
    keys.add(event.key);
    if (event.key === " " && !event.repeat) catchStar(cursor.x, cursor.y);
  });
  canvas.addEventListener("keyup", (event) => keys.delete(event.key));
  canvas.addEventListener("blur", () => keys.clear());

  function draw(now) {
    if (pausedAt !== null) {
      previous = now;
      requestAnimationFrame(draw);
      return;
    }
    const step = Math.min((now - previous) / 1000, 0.05) * 260;
    previous = now;
    if (keys.has("ArrowLeft")) cursor.x -= step;
    if (keys.has("ArrowRight")) cursor.x += step;
    if (keys.has("ArrowUp")) cursor.y -= step;
    if (keys.has("ArrowDown")) cursor.y += step;
    cursor.x = Math.max(10, Math.min(630, cursor.x));
    cursor.y = Math.max(70, Math.min(350, cursor.y));
    const gradient = ctx.createLinearGradient(0, 0, 640, 360);
    gradient.addColorStop(0, "#171e48");
    gradient.addColorStop(1, "#433475");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 640, 360);
    for (const dot of sky) {
      ctx.fillStyle = "#cbd0ff";
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, dot.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    star(target.x, target.y, 32 + Math.sin(now / 250) * 3, "#ffe39b");
    ctx.strokeStyle = "#8af1df";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cursor.x, cursor.y, 43, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 24px system-ui";
    ctx.fillText(`Stars: ${score}`, 22, 38);
    ctx.textAlign = "right";
    ctx.fillText(`Time: ${end ? Math.max(0, Math.ceil((end - now) / 1000)) : 30}`, 618, 38);
    ctx.textAlign = "left";
    if (running && now >= end) {
      running = false;
      keys.clear();
      status.textContent = `You caught ${score} ${score === 1 ? "star" : "stars"}! Press Start again to beat your score.`;
      window.Hugame?.gameOver(score);
      totalStars += score;
      completedRounds++;
      if (canSave) {
        window.Hugame.progress
          .save({ totalStars, completedRounds, checkpoint: "between-rounds" }, { schemaVersion: 1 })
          .then((save) => {
            saveStatus.textContent = `Progress saved (${save.storage}). ${totalStars} stars collected.`;
            return window.Hugame.achievements.setProgress("hundred-stars", totalStars);
          })
          .catch((error) => {
            canSave = false;
            saveStatus.textContent = `Progress not saved: ${error.message} Restart to reload your save.`;
          });
      }
    }
    requestAnimationFrame(draw);
  }
  requestAnimationFrame(draw);
})();
