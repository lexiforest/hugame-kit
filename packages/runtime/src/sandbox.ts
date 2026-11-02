import { runtimeActionSchema, type RuntimeAction } from "./runtime-action";

export type RuntimeIdentity = { gameId: string; versionId: string };
export type RuntimeMessage = RuntimeIdentity & {
  source: "hugame-runtime";
  bridgeVersion: 1;
  type:
    | "READY"
    | "CONTENT_SIZE"
    | "SCORE"
    | "GAME_OVER"
    | "REQUEST"
    | "EXIT_EXPANDED"
    | "WHEEL";
  requestId?: string;
  request?: RuntimeAction;
  sdkVersion?: number;
  value?: number;
  width?: number;
  height?: number;
  deltaX?: number;
  deltaY?: number;
  deltaMode?: number;
};

export function runtimeContentSecurityPolicy(
  assetBase: string,
  appOrigin: string,
): string {
  const base = new URL(assetBase);
  if (!["http:", "https:"].includes(base.protocol))
    throw new Error("Invalid asset origin");
  const origin = new URL(appOrigin).origin;
  return [
    "default-src 'none'",
    `script-src 'unsafe-inline' ${base.href}`,
    `style-src 'unsafe-inline' ${base.href}`,
    `img-src data: ${base.href}`,
    `media-src data: ${base.href}`,
    `font-src data: ${base.href}`,
    "connect-src 'none'",
    "worker-src 'none'",
    "object-src 'none'",
    "frame-src 'none'",
    "form-action 'none'",
    "base-uri 'none'",
    `frame-ancestors ${origin}`,
    "sandbox allow-scripts",
  ].join("; ");
}

function htmlAttribute(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;");
}

export function buildSandboxRuntimeHtml(
  gameHtml: string,
  identity: RuntimeIdentity,
  assetBase: string,
  appOrigin: string,
): string {
  const settings = JSON.stringify({
    ...identity,
    parentOrigin: new URL(appOrigin).origin,
  }).replaceAll("<", "\\u003c");
  const csp = runtimeContentSecurityPolicy(assetBase, appOrigin)
    .split("; ")
    .filter(
      (directive) =>
        !directive.startsWith("frame-ancestors") &&
        !directive.startsWith("sandbox"),
    )
    .join("; ");
  const bridge = `<meta http-equiv="Content-Security-Policy" content="${htmlAttribute(csp)}"><meta name="referrer" content="no-referrer"><style>html{width:100%;height:100%;overflow:hidden!important;overscroll-behavior:none!important}body{overflow:visible!important;overscroll-behavior:none!important}</style><script>
(function () {
  "use strict";
  var settings = ${settings};
  var lastScore = 0;
  var nextId = 0;
  var requestPrefix = Math.random().toString(36).slice(2) + "-" + Date.now().toString(36) + "-";
  var pending = new Map();
  var listeners = new Map();
  var revision = 0;
  var saveQueue = Promise.resolve();
  var sizeFrame = 0;
  var emulatedTouches = new Map();
  function contentSize() {
    var root = document.documentElement;
    var body = document.body;
    return {
      width: Math.min(16384, Math.max(1, root && root.scrollWidth || 0, body && body.scrollWidth || 0, body && body.offsetWidth || 0, window.innerWidth)),
      height: Math.min(16384, Math.max(1, root && root.scrollHeight || 0, body && body.scrollHeight || 0, body && body.offsetHeight || 0, window.innerHeight))
    };
  }
  function reportContentSize() {
    sizeFrame = 0;
    send("CONTENT_SIZE", contentSize());
  }
  function scheduleContentSize() {
    if (sizeFrame) cancelAnimationFrame(sizeFrame);
    sizeFrame = requestAnimationFrame(reportContentSize);
  }
  function request(action) {
    try {
      if (new TextEncoder().encode(JSON.stringify(action)).length > 40 * 1024) return Promise.reject(Object.assign(new Error("The runtime request is too large."), {code: "save_too_large"}));
    } catch (error) { return Promise.reject(Object.assign(new Error("Use JSON data in runtime requests."), {code: "invalid_request"})); }
    if (pending.size >= 16) return Promise.reject(Object.assign(new Error("Too many pending requests."), {code: "rate_limit"}));
    return new Promise(function(resolve, reject) {
      var id = requestPrefix + String(++nextId);
      var timer = setTimeout(function() { pending.delete(id); reject(Object.assign(new Error("Hugame did not respond. Reload progress before retrying a save."), {code: "timeout"})); }, 20000);
      pending.set(id, {resolve: resolve, reject: reject, timer: timer});
      send("REQUEST", {requestId: id, request: action});
    });
  }
  function touchPoint(entry) {
    var options = {
      identifier: entry.identifier,
      target: entry.target,
      clientX: entry.x,
      clientY: entry.y,
      screenX: entry.x,
      screenY: entry.y,
      pageX: entry.x + window.scrollX,
      pageY: entry.y + window.scrollY,
      radiusX: 1,
      radiusY: 1,
      rotationAngle: 0,
      force: 0.5
    };
    try { return new Touch(options); } catch (_) { return options; }
  }
  function touchEvent(type, touches, targetTouches, changedTouches) {
    var options = {bubbles: true, cancelable: true, composed: true, touches: touches, targetTouches: targetTouches, changedTouches: changedTouches};
    try { return new TouchEvent(type, options); } catch (_) {
      var event = new Event(type, options);
      Object.defineProperties(event, {
        touches: {value: touches},
        targetTouches: {value: targetTouches},
        changedTouches: {value: changedTouches}
      });
      return event;
    }
  }
  function dispatchEmulatedTouch(message) {
    var type = message.event;
    if (!["touchstart", "touchmove", "touchend", "touchcancel"].includes(type) || !Number.isInteger(message.identifier) || message.identifier < 0 || message.identifier > 2147483646 || ![message.x, message.y].every(function(value) { return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 16384; })) return;
    var entry = emulatedTouches.get(message.identifier);
    if (type === "touchstart") {
      if (entry) return;
      entry = {identifier: message.identifier, target: document.elementFromPoint(message.x, message.y) || document.body, x: message.x, y: message.y, startX: message.x, startY: message.y, moved: false, suppressClick: false, isPrimary: emulatedTouches.size === 0};
      emulatedTouches.set(message.identifier, entry);
    } else {
      if (!entry) return;
      entry.x = message.x;
      entry.y = message.y;
      if (Math.hypot(entry.x - entry.startX, entry.y - entry.startY) > 8) entry.moved = true;
    }
    var changed = touchPoint(entry);
    var ending = type === "touchend" || type === "touchcancel";
    if (ending) emulatedTouches.delete(entry.identifier);
    var active = Array.from(emulatedTouches.values()).map(touchPoint);
    var targetActive = Array.from(emulatedTouches.values()).filter(function(item) { return item.target === entry.target; }).map(touchPoint);
    var pointerType = {touchstart: "pointerdown", touchmove: "pointermove", touchend: "pointerup", touchcancel: "pointercancel"}[type];
    if (typeof PointerEvent === "function") {
      var pointer = new PointerEvent(pointerType, {bubbles: true, cancelable: true, composed: true, pointerId: entry.identifier + 1, pointerType: "touch", isPrimary: entry.isPrimary, clientX: entry.x, clientY: entry.y, screenX: entry.x, screenY: entry.y, width: 2, height: 2, pressure: ending ? 0 : 0.5, button: 0, buttons: ending ? 0 : 1});
      if (!entry.target.dispatchEvent(pointer)) entry.suppressClick = true;
    }
    if (!entry.target.dispatchEvent(touchEvent(type, active, targetActive, [changed]))) entry.suppressClick = true;
    if (type === "touchend" && !entry.moved && !entry.suppressClick) {
      var releasedOver = document.elementFromPoint(entry.x, entry.y);
      if (releasedOver === entry.target || entry.target.contains(releasedOver)) {
        if (typeof PointerEvent === "function") entry.target.dispatchEvent(new PointerEvent("click", {bubbles: true, cancelable: true, composed: true, pointerId: entry.identifier + 1, pointerType: "touch", isPrimary: entry.isPrimary, clientX: entry.x, clientY: entry.y, screenX: entry.x, screenY: entry.y, width: 2, height: 2, pressure: 0, button: 0, buttons: 0, detail: 1}));
        else entry.target.click();
      }
    }
  }
  window.addEventListener("message", function(event) {
    var m = event.data;
    if (event.source !== window.parent || event.origin !== settings.parentOrigin || !m || m.source !== "hugame-host" || m.bridgeVersion !== 1 || m.gameId !== settings.gameId || m.versionId !== settings.versionId) return;
    if (m.type === "RESPONSE") {
      var entry = pending.get(m.requestId);
      if (!entry) return;
      pending.delete(m.requestId); clearTimeout(entry.timer);
      if (m.error) entry.reject(Object.assign(new Error(m.error.message), {code: m.error.code}));
      else entry.resolve(m.result);
    } else if (m.type === "EVENT" && ["pause", "resume", "viewport", "mute"].includes(m.event)) {
      (listeners.get(m.event) || []).slice().forEach(function(fn) { try { fn(m.detail); } catch (error) { console.error(error); } });
    } else if (m.type === "TOUCH") {
      dispatchEmulatedTouch(m);
    }
  });
  function send(type, extra) {
    if (window.parent === window) return;
    var message = Object.assign({source: "hugame-runtime", bridgeVersion: 1, gameId: settings.gameId, versionId: settings.versionId, type: type}, extra || {});
    window.parent.postMessage(message, settings.parentOrigin);
  }
  function size(details) {
    return {width: Math.max(1, Math.min(16384, Number(details && details.width) || window.innerWidth)), height: Math.max(1, Math.min(16384, Number(details && details.height) || window.innerHeight))};
  }
  function score(value) {
    if (!Number.isSafeInteger(value) || Math.abs(value) > 1000000000) return;
    lastScore = value;
    send("SCORE", {value: value});
  }
  Object.defineProperty(window, "Hugame", {value: Object.freeze({
    ready: function(details) { send("READY", Object.assign(size(details), {sdkVersion: 2})); },
    score: score,
    gameOver: function(value) { if (value && typeof value === "object") value = value.score; if (value === undefined) value = lastScore; if (Number.isSafeInteger(value) && Math.abs(value) <= 1000000000) send("GAME_OVER", {value: value}); },
    on: function(event, listener) {
      if (!["pause", "resume", "viewport", "mute"].includes(event) || typeof listener !== "function") throw new Error("Unknown Hugame event.");
      var list = listeners.get(event) || []; list.push(listener); listeners.set(event, list);
      return function() { var i = list.indexOf(listener); if (i >= 0) list.splice(i, 1); };
    },
    progress: Object.freeze({
      load: function() {
        var result = saveQueue.then(function() { return request({action: "progress.load"}); }).then(function(save) { revision = save.revision; return save; });
        saveQueue = result.catch(function() {}); return result;
      },
      save: function(data, options) {
        var copy;
        try { copy = JSON.parse(JSON.stringify(data)); } catch (e) { return Promise.reject(e); }
        var result = saveQueue.then(function() { return request({action: "progress.save", data: copy, schemaVersion: options && options.schemaVersion || 1, revision: revision}); }).then(function(save) { revision = save.revision; return save; });
        saveQueue = result.catch(function() {}); return result;
      }
    }),
    achievements: Object.freeze({
      list: function() { return request({action: "achievements.list"}); },
      unlock: function(id) { return request({action: "achievements.unlock", id: id}); },
      setProgress: function(id, value) { return request({action: "achievements.setProgress", id: id, value: value}); }
    })
  }), writable: false, configurable: false});
  window.addEventListener("DOMContentLoaded", function() {
    if (window.ResizeObserver) new ResizeObserver(scheduleContentSize).observe(document.body);
    if (window.MutationObserver) new MutationObserver(scheduleContentSize).observe(document.body, {childList: true, subtree: true, characterData: true});
    reportContentSize();
    window.Hugame.ready();
  });
  window.addEventListener("keydown", function(event) { if (event.key === "Escape") send("EXIT_EXPANDED"); });
  window.addEventListener("wheel", function(event) {
    if (event.ctrlKey) return;
    var detail = {deltaX: event.deltaX, deltaY: event.deltaY, deltaMode: event.deltaMode};
    setTimeout(function() {
      if (!event.defaultPrevented) send("WHEEL", detail);
    }, 0);
  }, {passive: true});
  window.addEventListener("resize", scheduleContentSize);
})();
</script>`;
  // Place policy and bridge before any creator-controlled markup or scripts.
  return (
    "<!doctype html>\n" + bridge + gameHtml.replace(/^\s*<!doctype[^>]*>/i, "")
  );
}

export function parseRuntimeMessage(
  value: unknown,
  identity: RuntimeIdentity,
): RuntimeMessage | null {
  if (!value || typeof value !== "object") return null;
  const message = value as Record<string, unknown>;
  if (
    message.source !== "hugame-runtime" ||
    message.bridgeVersion !== 1 ||
    message.gameId !== identity.gameId ||
    message.versionId !== identity.versionId
  )
    return null;
  if (message.type === "EXIT_EXPANDED")
    return {
      ...identity,
      source: "hugame-runtime",
      bridgeVersion: 1,
      type: "EXIT_EXPANDED",
    };
  if (message.type === "REQUEST") {
    if (
      typeof message.requestId !== "string" ||
      message.requestId.length > 80 ||
      !/^(?:[a-z0-9]+-[a-z0-9]+-)?[0-9]{1,12}$/.test(message.requestId)
    )
      return null;
    try {
      if (
        new TextEncoder().encode(JSON.stringify(message.request)).length >
        40 * 1024
      )
        return null;
      const request = runtimeActionSchema.safeParse(message.request);
      if (!request.success) return null;
      return {
        ...identity,
        source: "hugame-runtime",
        bridgeVersion: 1,
        type: "REQUEST",
        requestId: message.requestId,
        request: request.data,
      };
    } catch {
      return null;
    }
  }
  if (message.type === "SCORE" || message.type === "GAME_OVER") {
    if (
      !Number.isSafeInteger(message.value) ||
      Math.abs(message.value as number) > 1_000_000_000
    )
      return null;
    return {
      ...identity,
      source: "hugame-runtime",
      bridgeVersion: 1,
      type: message.type,
      value: message.value as number,
    };
  }
  if (message.type === "WHEEL") {
    if (
      ![message.deltaX, message.deltaY].every(
        (delta) =>
          typeof delta === "number" &&
          Number.isFinite(delta) &&
          Math.abs(delta) <= 10000,
      ) ||
      !Number.isInteger(message.deltaMode) ||
      (message.deltaMode as number) < 0 ||
      (message.deltaMode as number) > 2
    )
      return null;
    return {
      ...identity,
      source: "hugame-runtime",
      bridgeVersion: 1,
      type: "WHEEL",
      deltaX: message.deltaX as number,
      deltaY: message.deltaY as number,
      deltaMode: message.deltaMode as number,
    };
  }
  if (message.type === "READY" || message.type === "CONTENT_SIZE") {
    if (
      ![message.width, message.height].every(
        (dimension) =>
          typeof dimension === "number" &&
          Number.isFinite(dimension) &&
          dimension >= 1 &&
          dimension <= 16384,
      )
    )
      return null;
    return {
      ...identity,
      source: "hugame-runtime",
      bridgeVersion: 1,
      type: message.type,
      width: message.width as number,
      height: message.height as number,
      ...(message.sdkVersion === 2 ? { sdkVersion: 2 } : {}),
    };
  }
  return null;
}
