import { createHash, randomBytes } from "node:crypto";
import { watch, type FSWatcher } from "node:fs";
import { createServer, type ServerResponse } from "node:http";
import { extname } from "node:path";
import {
  buildSandboxRuntimeHtml,
  runtimeContentSecurityPolicy,
} from "../../runtime/src/index";
import {
  MIME_TYPES,
  readGameDirectory,
  validateFiles,
  type GameManifest,
} from "../../format/src/index";

const identity = { gameId: "local-game", versionId: "local-version" };

function send(
  response: ServerResponse,
  status: number,
  body: string | Buffer,
  contentType: string,
  head = false,
) {
  response.writeHead(status, {
    "content-type": contentType,
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
  });
  response.end(head ? undefined : body);
}

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The game package is invalid.";
}

function safeJson(value: unknown) {
  return JSON.stringify(value).replaceAll("<", "\\u003c");
}

function hostHtml(
  manifest: GameManifest,
  origin: string,
  version: number,
  projectId: string,
  gameBasePath: string,
) {
  const config = safeJson({
    manifest,
    origin,
    version,
    projectId,
    ...identity,
  });
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${manifest.title.replaceAll("&", "&amp;").replaceAll("<", "&lt;")} · Hugame dev</title>
  <style>
    :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, sans-serif; background: #07111f; color: #e8f0fb; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; background: radial-gradient(circle at 80% 0%, #173256, #07111f 42%); }
    button, select { color: inherit; background: #13253d; border: 1px solid #36506f; border-radius: 8px; padding: 8px 10px; font: inherit; }
    button { cursor: pointer; }
    button:hover { border-color: #7fb5ff; }
    h1, h2, p { margin-top: 0; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    h2 { font-size: 13px; color: #9db5d1; text-transform: uppercase; letter-spacing: .08em; margin: 20px 0 8px; }
    .app { display: grid; grid-template-columns: 320px minmax(0, 1fr); min-height: 100vh; }
    .panel { padding: 20px; border-right: 1px solid #29405d; background: #0b1728e8; overflow: auto; }
    .muted { color: #9db5d1; font-size: 13px; line-height: 1.45; }
    .controls { display: flex; flex-wrap: wrap; gap: 8px; }
    .controls select { width: 100%; }
    .status { min-height: 40px; padding: 10px; border-radius: 8px; background: #11243b; white-space: pre-wrap; font-size: 13px; }
    .status.error { background: #3c1820; color: #ffc9cf; }
    .state { max-height: 180px; overflow: auto; padding: 10px; background: #050c16; border-radius: 8px; font: 12px/1.45 ui-monospace, monospace; white-space: pre-wrap; overflow-wrap: anywhere; }
    .events { margin: 0; padding: 0; list-style: none; max-height: 260px; overflow: auto; font: 12px/1.45 ui-monospace, monospace; }
    .events li { padding: 6px 0; border-bottom: 1px solid #1d3048; overflow-wrap: anywhere; }
    .events time { color: #7f9cbd; margin-right: 6px; }
    .workspace { padding: 20px; min-width: 0; overflow: auto; display: flex; align-items: flex-start; justify-content: center; }
    .stage { position: relative; flex: none; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid #36506f; border-radius: 16px; background: #02060b; box-shadow: 0 18px 70px #0008; }
    iframe { flex: none; border: 0; background: #fff; transform-origin: center; }
    .badge { display: inline-block; margin-bottom: 14px; padding: 4px 8px; border-radius: 999px; background: #164835; color: #9ff4c4; font-size: 12px; font-weight: 700; }
    @media (max-width: 760px) { .app { grid-template-columns: 1fr; } .panel { border-right: 0; border-bottom: 1px solid #29405d; } .workspace { justify-content: flex-start; } }
  </style>
</head>
<body>
  <main class="app">
    <aside class="panel">
      <span class="badge">Local runtime</span>
      <h1>${manifest.title.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</h1>
      <p class="muted">The iframe uses Hugame's production bridge and sandbox. Open browser developer tools to debug game code.</p>
      <h2>Viewport</h2>
      <div class="controls">
        <select id="viewport" aria-label="Viewport">
          <option value="920,575">Desktop · 920 × 575</option>
          <option value="390,700">Phone portrait · 390 × 700</option>
          <option value="844,390">Phone landscape · 844 × 390</option>
        </select>
        <button id="reload" type="button">Reload</button>
      </div>
      <h2>Lifecycle</h2>
      <div class="controls">
        <button id="pause" type="button">Pause</button>
        <button id="resume" type="button">Resume</button>
        <button id="mute" type="button">Mute</button>
      </div>
      <h2>Validation</h2>
      <div id="status" class="status" role="status">Package valid. Watching for changes…</div>
      <h2>Local player state</h2>
      <div class="controls"><button id="reset" type="button">Reset progress and achievements</button></div>
      <pre id="state" class="state"></pre>
      <h2>Runtime events</h2>
      <ol id="events" class="events" aria-live="polite"></ol>
    </aside>
    <section class="workspace">
      <div id="stage" class="stage">
        <iframe id="game" title=${JSON.stringify(manifest.title)} src="${gameBasePath}index.html?v=${version}" sandbox="allow-scripts"></iframe>
      </div>
    </section>
  </main>
  <script>
  (function () {
    "use strict";
    var config = ${config};
    var frame = document.getElementById("game");
    var stage = document.getElementById("stage");
    var status = document.getElementById("status");
    var events = document.getElementById("events");
    var stateView = document.getElementById("state");
    var viewport = document.getElementById("viewport");
    var storageKey = "hugame:dev:v1:" + config.projectId;
    var paused = false;
    var muted = false;
    var reported = null;

    function blankState() {
      return { progress: { data: null, schemaVersion: 1, revision: 0 }, achievements: {} };
    }
    function loadState() {
      try {
        var value = JSON.parse(localStorage.getItem(storageKey) || "null");
        if (value && value.progress && value.achievements) return value;
      } catch (_) {}
      return blankState();
    }
    var playerState = loadState();
    function saveState() {
      try { localStorage.setItem(storageKey, JSON.stringify(playerState)); } catch (_) {}
      stateView.textContent = JSON.stringify(playerState, null, 2);
    }
    function log(name, detail) {
      var item = document.createElement("li");
      var time = document.createElement("time");
      time.textContent = new Date().toLocaleTimeString();
      item.appendChild(time);
      item.appendChild(document.createTextNode(name + (detail === undefined ? "" : " " + JSON.stringify(detail))));
      events.prepend(item);
      while (events.children.length > 100) events.lastElementChild.remove();
    }
    function failure(code, message) {
      var error = new Error(message);
      error.code = code;
      throw error;
    }
    function hasCapability(name) {
      return config.manifest.capabilities.includes(name);
    }
    function applyAction(action) {
      if (!action || typeof action.action !== "string") failure("invalid_request", "Invalid runtime request.");
      if (action.action.indexOf("progress.") === 0 && !hasCapability("progress"))
        failure("capability_disabled", "Enable progress in hugame.json.");
      if (action.action.indexOf("achievements.") === 0 && !hasCapability("achievements"))
        failure("capability_disabled", "Enable achievements in hugame.json.");
      if (action.action === "progress.load")
        return Object.assign({}, playerState.progress, { storage: "device" });
      if (action.action === "progress.save") {
        if (!action.data || typeof action.data !== "object" || Array.isArray(action.data))
          failure("invalid_save", "Save data must be a JSON object.");
        var serialized = JSON.stringify(action.data);
        if (new TextEncoder().encode(serialized).length > 32 * 1024)
          failure("save_too_large", "Save data must be at most 32 KiB.");
        if (!Number.isInteger(action.revision) || action.revision !== playerState.progress.revision)
          failure("save_conflict", "A newer save exists. Load it before saving again.");
        if (!Number.isInteger(action.schemaVersion) || action.schemaVersion < 1 || action.schemaVersion > 65535)
          failure("invalid_save", "Use a schema version from 1 to 65535.");
        playerState.progress = { data: JSON.parse(serialized), schemaVersion: action.schemaVersion, revision: playerState.progress.revision + 1 };
        saveState();
        return Object.assign({}, playerState.progress, { storage: "device" });
      }
      var definitions = config.manifest.achievements || [];
      if (action.action === "achievements.list")
        return { storage: "device", achievements: definitions.map(function (definition) {
          return Object.assign({}, definition, playerState.achievements[definition.id] || { value: 0, unlockedAt: null });
        }) };
      if (action.action !== "achievements.unlock" && action.action !== "achievements.setProgress")
        failure("invalid_request", "Unknown runtime request.");
      var definition = definitions.find(function (entry) { return entry.id === action.id; });
      if (!definition) failure("unknown_achievement", "This achievement is not declared in hugame.json.");
      var previous = playerState.achievements[action.id] || { value: 0, unlockedAt: null };
      var requested = action.action === "achievements.unlock" ? definition.target : action.value;
      if (!Number.isInteger(requested) || requested < 0 || requested > 1000000000)
        failure("invalid_request", "Achievement progress must be a supported integer.");
      var value = Math.max(previous.value, Math.min(definition.target, requested));
      var unlockedAt = previous.unlockedAt || (value >= definition.target ? new Date().toISOString() : null);
      playerState.achievements[action.id] = { value: value, unlockedAt: unlockedAt };
      saveState();
      return Object.assign({}, definition, { value: value, unlockedAt: unlockedAt, newlyUnlocked: !previous.unlockedAt && Boolean(unlockedAt), storage: "device" });
    }
    function hostMessage(extra) {
      frame.contentWindow.postMessage(Object.assign({
        source: "hugame-host", bridgeVersion: 1, gameId: config.gameId, versionId: config.versionId
      }, extra), "*");
    }
    function event(name, detail) {
      hostMessage({ type: "EVENT", event: name, detail: detail });
      log("EVENT " + name, detail);
    }
    function dimensions() {
      var selected = viewport.value.split(",").map(Number);
      var display = config.manifest.display;
      var responsive = display.mode === "responsive";
      var base = responsive
        ? { width: selected[0], height: selected[1] }
        : { width: display.width, height: display.height };
      return {
        bounds: { width: selected[0], height: selected[1] },
        content: {
          width: responsive ? base.width : Math.max(base.width, reported ? reported.width : 0),
          height: responsive ? base.height : Math.max(base.height, reported ? reported.height : 0)
        }
      };
    }
    function layout() {
      var size = dimensions();
      var scale = Math.min(1, size.bounds.width / size.content.width, size.bounds.height / size.content.height);
      stage.style.width = size.bounds.width + "px";
      stage.style.height = size.bounds.height + "px";
      frame.style.width = size.content.width + "px";
      frame.style.height = size.content.height + "px";
      frame.style.transform = "scale(" + scale + ")";
      return { width: size.content.width, height: size.content.height, scale: scale, expanded: false };
    }
    function sync() {
      event(paused ? "pause" : "resume", {});
      event("mute", { muted: muted });
      event("viewport", layout());
    }
    window.addEventListener("message", function (incoming) {
      var message = incoming.data;
      if (incoming.source !== frame.contentWindow || !message || message.source !== "hugame-runtime" ||
          message.bridgeVersion !== 1 || message.gameId !== config.gameId || message.versionId !== config.versionId) return;
      if (message.type === "READY") {
        log("READY", { width: message.width, height: message.height, sdkVersion: message.sdkVersion });
        sync();
      } else if (message.type === "CONTENT_SIZE") {
        if (config.manifest.display.mode === "fixed") {
          reported = { width: message.width, height: message.height };
          event("viewport", layout());
        }
      } else if (message.type === "WHEEL") {
        if ([message.deltaX, message.deltaY].every(function (delta) {
          return typeof delta === "number" && Number.isFinite(delta) && Math.abs(delta) <= 10000;
        }) && Number.isInteger(message.deltaMode) && message.deltaMode >= 0 && message.deltaMode <= 2) {
          var multiplier = message.deltaMode === 1 ? 16 : message.deltaMode === 2 ? window.innerHeight : 1;
          var bounded = function (value) { return Math.max(-2000, Math.min(2000, value * multiplier)); };
          window.scrollBy({ left: bounded(message.deltaX), top: bounded(message.deltaY), behavior: "auto" });
        }
      } else if (message.type === "SCORE" || message.type === "GAME_OVER") {
        log(message.type, { score: message.value });
        if (!hasCapability("scores")) log("WARNING", { message: "Enable scores in hugame.json before reporting scores." });
      } else if (message.type === "REQUEST") {
        try {
          var result = applyAction(message.request);
          log("REQUEST " + message.request.action, result);
          hostMessage({ type: "RESPONSE", requestId: message.requestId, result: result });
        } catch (error) {
          var detail = { code: error.code || "invalid_request", message: error.message || "Runtime request failed." };
          log("REQUEST FAILED", detail);
          hostMessage({ type: "RESPONSE", requestId: message.requestId, error: detail });
        }
      } else if (message.type === "EXIT_EXPANDED") log("EXIT_EXPANDED");
    });
    document.getElementById("pause").addEventListener("click", function () { paused = true; event("pause", {}); });
    document.getElementById("resume").addEventListener("click", function () { paused = false; event("resume", {}); });
    document.getElementById("mute").addEventListener("click", function (click) {
      muted = !muted;
      click.currentTarget.textContent = muted ? "Unmute" : "Mute";
      event("mute", { muted: muted });
    });
    document.getElementById("reload").addEventListener("click", function () { location.reload(); });
    document.getElementById("reset").addEventListener("click", function () {
      playerState = blankState();
      try { localStorage.removeItem(storageKey); } catch (_) {}
      saveState();
      log("LOCAL STATE RESET");
      location.reload();
    });
    viewport.addEventListener("change", function () { reported = null; event("viewport", layout()); });
    window.addEventListener("resize", layout);
    frame.addEventListener("load", function () { log("IFRAME LOADED"); });
    saveState();
    layout();
    setInterval(function () {
      fetch("/__hugame/status", { cache: "no-store" }).then(function (response) { return response.json(); }).then(function (next) {
        status.textContent = next.error || "Package valid. Watching for changes…";
        status.classList.toggle("error", Boolean(next.error));
        if (!next.error && next.version !== config.version) location.reload();
      }).catch(function () {
        status.textContent = "Local preview server is unavailable.";
        status.classList.add("error");
      });
    }, 600);
  })();
  </script>
</body>
</html>`;
}

export type DevServer = {
  url: string;
  close: () => Promise<void>;
  waitForShutdown: () => Promise<void>;
};

export async function startDevServer(
  directory: string,
  requestedPort: number,
): Promise<DevServer> {
  let files = await readGameDirectory(directory);
  let manifest = validateFiles(files).manifest;
  let version = 1;
  let validationError = "";
  let refreshTimer: ReturnType<typeof setTimeout> | undefined;
  let watcher: FSWatcher | undefined;
  let origin = "";
  const projectId = createHash("sha256")
    .update(directory)
    .digest("hex")
    .slice(0, 20);
  const gameBasePath = `/game/${randomBytes(18).toString("base64url")}/`;
  const server = createServer((request, response) => {
    void (async () => {
      const head = request.method === "HEAD";
      if (request.method !== "GET" && !head) {
        response.setHeader("allow", "GET, HEAD");
        send(
          response,
          405,
          "Method not allowed.",
          "text/plain; charset=utf-8",
          head,
        );
        return;
      }
      const url = new URL(request.url ?? "/", origin);
      if (url.pathname === "/") {
        response.setHeader(
          "content-security-policy",
          "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; frame-src 'self'; base-uri 'none'; form-action 'none'",
        );
        send(
          response,
          200,
          hostHtml(manifest, origin, version, projectId, gameBasePath),
          "text/html; charset=utf-8",
          head,
        );
        return;
      }
      if (url.pathname === "/__hugame/status") {
        send(
          response,
          200,
          JSON.stringify({ version, error: validationError || null }),
          "application/json",
          head,
        );
        return;
      }
      if (!url.pathname.startsWith(gameBasePath)) {
        send(response, 404, "Not found.", "text/plain; charset=utf-8", head);
        return;
      }
      let path: string;
      try {
        path = decodeURIComponent(url.pathname.slice(gameBasePath.length));
      } catch {
        send(response, 400, "Invalid path.", "text/plain; charset=utf-8", head);
        return;
      }
      const source = files.get(path);
      if (!source) {
        send(response, 404, "Not found.", "text/plain; charset=utf-8", head);
        return;
      }
      const extension = extname(path).toLowerCase();
      let body = source;
      if (extension === ".html")
        body = Buffer.from(
          buildSandboxRuntimeHtml(
            source.toString("utf8"),
            identity,
            `${origin}${gameBasePath}`,
            origin,
          ),
        );
      response.setHeader("access-control-allow-origin", "*");
      response.setHeader("referrer-policy", "no-referrer");
      response.setHeader(
        "permissions-policy",
        "camera=(), microphone=(), geolocation=(), payment=()",
      );
      if (extension === ".html")
        response.setHeader(
          "content-security-policy",
          runtimeContentSecurityPolicy(`${origin}${gameBasePath}`, origin),
        );
      send(
        response,
        200,
        body,
        MIME_TYPES[extension] ?? "application/octet-stream",
        head,
      );
    })().catch((error) => {
      if (!response.headersSent)
        send(response, 500, errorMessage(error), "text/plain; charset=utf-8");
      else response.end();
    });
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(requestedPort, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Could not start the dev server.");
  origin = `http://127.0.0.1:${address.port}`;

  const refresh = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(() => {
      void (async () => {
        try {
          const nextFiles = await readGameDirectory(directory);
          const nextManifest = validateFiles(nextFiles).manifest;
          files = nextFiles;
          manifest = nextManifest;
          validationError = "";
          version++;
        } catch (error) {
          validationError = errorMessage(error);
        }
      })();
    }, 120);
  };
  try {
    watcher = watch(directory, { recursive: true }, refresh);
    watcher.on("error", (error) => {
      validationError = `File watcher failed: ${error.message}`;
    });
  } catch (error) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    throw error;
  }

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    clearTimeout(refreshTimer);
    watcher?.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  };
  const waitForShutdown = () =>
    new Promise<void>((resolve, reject) => {
      const stop = () => void close().then(resolve, reject);
      process.once("SIGINT", stop);
      process.once("SIGTERM", stop);
    });
  return { url: origin, close, waitForShutdown };
}
