import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, stat, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";

const binary = resolve("packages/cli/dist/hugame.cjs");
// All credentials and endpoints below belong to an ephemeral loopback test double.
const token = `hg_${"t".repeat(43)}`;
const gameId = "a".repeat(24);
const versionId = "b".repeat(24);

test("CLI distribution retains Hugame and bundled dependency license notices", async () => {
  const manifest = JSON.parse(
    await readFile("packages/cli/package.json", "utf8"),
  );
  assert.equal(manifest.license, "MIT");
  assert.match(
    await readFile("packages/cli/LICENSE", "utf8"),
    /Permission is hereby granted/,
  );
  const notices = await readFile(
    "packages/cli/dist/THIRD_PARTY_NOTICES.txt",
    "utf8",
  );
  for (const name of ["buffer-crc32", "pend", "yauzl", "yazl", "zod"]) {
    const dependency = JSON.parse(
      await readFile(`node_modules/${name}/package.json`, "utf8"),
    );
    assert.ok(notices.includes(`=== ${name}@${dependency.version} (`));
    assert.ok(
      notices.includes(
        (await readFile(`node_modules/${name}/LICENSE`, "utf8")).trim(),
      ),
    );
  }
  assert.match(
    await readFile(
      "packages/cli/assets/ping-pong/assets/license.html",
      "utf8",
    ),
    /MIT License/,
  );
});

function run(args, directory) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [binary, ...args], {
      env: {
        ...process.env,
        HUGAME_CONFIG_DIR: join(directory, "config"),
        HUGAME_URL: "",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "",
      stderr = "";
    child.stdout.on("data", (part) => {
      stdout += part;
    });
    child.stderr.on("data", (part) => {
      stderr += part;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      assert.ok(
        !stdout.includes(token) && !stderr.includes(token),
        "credential leaked to output",
      );
      resolve({
        code,
        stdout,
        stderr,
        messages: stdout
          .trim()
          .split("\n")
          .filter(Boolean)
          .map((line) => JSON.parse(line)),
      });
    });
  });
}

test("CLI dev server injects the production bridge and reloads valid changes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hugame-cli-dev-test-"));
  const game = join(directory, "game");
  let child;
  try {
    assert.equal((await run(["init", game, "--json"], directory)).code, 0);
    const starterManifest = JSON.parse(
      await readFile(join(game, "hugame.json"), "utf8"),
    );
    assert.equal(starterManifest.license, "MIT");
    assert.match(starterManifest.homepage, /^https:\/\//);
    child = spawn(
      process.execPath,
      [binary, "dev", game, "--port", "0", "--no-open", "--json"],
      {
        env: {
          ...process.env,
          HUGAME_CONFIG_DIR: join(directory, "config"),
          HUGAME_URL: "",
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const ready = await new Promise((resolve, reject) => {
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(
        () => reject(new Error(`Dev server did not start. ${stderr}`)),
        5000,
      );
      child.stderr.on("data", (part) => {
        stderr += part;
      });
      child.stdout.on("data", (part) => {
        stdout += part;
        const newline = stdout.indexOf("\n");
        if (newline < 0) return;
        const message = JSON.parse(stdout.slice(0, newline));
        if (message.type !== "dev_server") return;
        clearTimeout(timer);
        resolve(message.data);
      });
      child.once("error", reject);
      child.once("exit", (code) => {
        if (code && code !== 0)
          reject(new Error(`Dev server exited with ${code}. ${stderr}`));
      });
    });
    assert.match(ready.url, /^http:\/\/127\.0\.0\.1:\d+$/);
    const parent = await (await fetch(ready.url)).text();
    assert.match(parent, /Local runtime/);
    assert.match(parent, /Reset progress and achievements/);
    const runtimePath = parent.match(/<iframe[^>]+src="([^"?]+)/)?.[1];
    assert.match(runtimePath, /^\/game\/[A-Za-z0-9_-]+\/index\.html$/);
    const runtime = await (await fetch(`${ready.url}${runtimePath}`)).text();
    assert.ok(
      runtime.indexOf('Object.defineProperty(window, "Hugame"') <
        runtime.indexOf("Pocket Pong"),
    );
    assert.doesNotMatch(runtime, /resize:\s*function/);
    assert.equal((await fetch(`${ready.url}/../package.json`)).status, 404);
    assert.equal((await fetch(`${ready.url}/game/index.html`)).status, 404);
    const first = await (await fetch(`${ready.url}/__hugame/status`)).json();
    assert.deepEqual(first, { version: 1, error: null });

    const manifestPath = join(game, "hugame.json");
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    manifest.description = "Reloaded local game.";
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    let current = first;
    for (
      let attempt = 0;
      attempt < 30 && current.version === first.version;
      attempt++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      current = await (await fetch(`${ready.url}/__hugame/status`)).json();
    }
    assert.equal(current.error, null);
    assert.ok(current.version > first.version);
    assert.match(await (await fetch(ready.url)).text(), /Reloaded local game/);
  } finally {
    if (child?.exitCode === null) {
      const closed = new Promise((resolve) => child.once("close", resolve));
      child.kill("SIGTERM");
      await closed;
    }
    await rm(directory, { recursive: true, force: true });
  }
});

test("CLI contracts: scaffold, deterministic ZIP, device login, private upload, explicit publish, revoke", async () => {
  const directory = await mkdtemp(join(tmpdir(), "hugame-cli-test-"));
  const requests = [];
  let uploaded;
  let site;
  let finalizeCount = 0;
  let failFinalization = false;
  const server = createServer(async (request, response) => {
    const parts = [];
    for await (const part of request) parts.push(part);
    const raw = Buffer.concat(parts);
    const body =
      request.headers["content-type"] === "application/json"
        ? JSON.parse(raw)
        : undefined;
    requests.push({
      path: request.url,
      method: request.method,
      headers: request.headers,
      body,
    });
    const send = (data, status = 200) => {
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(status >= 400 ? { error: data } : { data }));
    };
    if (request.url === "/api/device/code")
      return send({
        deviceCode: "test-device-secret",
        userCode: "ABCD-EFGH",
        verificationUri: `${site}/device`,
        verificationUriComplete: `${site}/device?code=ABCD-EFGH`,
        expiresIn: 600,
        interval: 5,
      });
    if (request.url === "/api/device/token")
      return send({ accessToken: token, expiresIn: 3600 });
    if (request.url === "/object") {
      uploaded = raw;
      response.writeHead(200);
      response.end();
      return;
    }
    if (request.headers.authorization !== `Bearer ${token}`)
      return send({ code: "unauthorized", message: "Sign in." }, 401);
    if (request.url === "/api/uploads")
      return send({
        uploadId: versionId,
        uploadUrl: `${site}/object`,
        headers: {
          "content-type": "application/zip",
          "x-amz-checksum-sha256": body.checksum,
        },
      });
    if (request.url === `/api/uploads/${versionId}/finalize`) {
      finalizeCount++;
      if (failFinalization)
        return send(
          { code: "storage_unavailable", message: "Try later." },
          503,
        );
      return send({
        gameId,
        versionId,
        slug: "pong",
        versionNumber: 1,
        previewUrl: `/preview/${gameId}/${versionId}`,
        state: "draft",
      });
    }
    if (request.url === "/api/me/games")
      return send([
        {
          id: gameId,
          title: "Pocket Pong",
          slug: "pong",
          latestVersionId: versionId,
          versions: [{ id: versionId, versionNumber: 1 }],
        },
      ]);
    if (request.url === `/api/games/${gameId}/publish`)
      return send({ gameId, versionId, url: "/g/pong", visibility: body.visibility });
    if (request.url === `/api/games/${gameId}/settings`)
      return send({ gameId, forkable: body.forkable });
    if (request.url === "/api/me") return send({ name: "Test Creator" });
    if (request.url === "/api/device/revoke") return send({ revoked: true });
    return send({ code: "not_found", message: "Not found." }, 404);
  });
  try {
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    site = `http://127.0.0.1:${server.address().port}`;
    const game = join(directory, "game");
    assert.equal((await run(["init", game, "--json"], directory)).code, 0);
    const manifestPath = join(game, "hugame.json");
    const initializedManifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const missingDisplay = { ...initializedManifest };
    delete missingDisplay.display;
    await writeFile(manifestPath, JSON.stringify(missingDisplay, null, 2) + "\n");
    assert.equal((await run(["validate", game, "--json"], directory)).code, 1);
    await writeFile(manifestPath, JSON.stringify(initializedManifest, null, 2) + "\n");
    assert.equal(
      (await run(["init", game, "--json"], directory)).code,
      1,
      "must not overwrite an existing project",
    );
    const validation = await run(["validate", game, "--json"], directory);
    assert.equal(validation.messages[0].data.valid, true);
    for (const name of ["one.zip", "two.zip"])
      assert.equal(
        (
          await run(
            ["pack", game, "--out", join(directory, name), "--json"],
            directory,
          )
        ).code,
        0,
      );
    assert.deepEqual(
      await readFile(join(directory, "one.zip")),
      await readFile(join(directory, "two.zip")),
    );
    assert.equal(
      (
        await run(
          ["pack", game, "--out", join(game, "bad.zip"), "--json"],
          directory,
        )
      ).code,
      1,
    );
    const login = await run(["login", "--site", site, "--json"], directory);
    assert.equal(login.code, 0);
    assert.equal(login.messages[0].type, "device_authorization");
    assert.equal(login.messages[0].verificationUri, `${site}/device?code=ABCD-EFGH`);
    assert.equal(login.messages[1].data.connected, true);
    assert.ok(!login.stdout.includes("test-device-secret"));
    const credentialPath = join(directory, "config", "credentials.json");
    if (process.platform !== "win32")
      assert.equal((await stat(credentialPath)).mode & 0o777, 0o600);
    const upload = await run(["upload", game, "--json"], directory);
    assert.equal(upload.code, 0);
    assert.equal(upload.messages[0].data.state, "draft");
    assert.equal(
      upload.messages[0].data.previewUrl,
      `${site}/preview/${gameId}/${versionId}`,
    );
    assert.equal(
      requests.filter((request) => request.path.endsWith("/publish")).length,
      0,
    );
    const put = requests.find((request) => request.path === "/object");
    assert.equal(
      put.headers.authorization,
      undefined,
      "bearer credential must never reach object storage",
    );
    assert.equal(
      put.headers["x-amz-checksum-sha256"],
      createHash("sha256").update(uploaded).digest("base64"),
    );
    assert.equal(
      (await run(["publish", versionId, "--json"], directory)).code,
      1,
    );
    assert.equal(
      requests.filter((request) => request.path.endsWith("/publish")).length,
      0,
    );
    const published = await run(
      [
        "publish",
        versionId,
        "--yes",
        "--visibility",
        "unlisted",
        "--forkable",
        "true",
        "--json",
      ],
      directory,
    );
    assert.equal(published.messages[0].data.url, `${site}/g/pong`);
    const publishRequest = requests.find((request) => request.path.endsWith("/publish"));
    assert.equal(publishRequest.body.versionId, versionId);
    assert.equal(publishRequest.body.visibility, "unlisted");
    assert.equal(
      requests.find((request) => request.path.endsWith("/settings")).body.forkable,
      true,
    );

    // A failed finalization is remembered and retried without another presign or PUT.
    failFinalization = true;
    assert.equal((await run(["upload", game, "--json"], directory)).code, 1);
    const puts = requests.filter(
      (request) => request.path === "/object",
    ).length;
    const retries = requests
      .filter((request) => request.path.endsWith("/finalize"))
      .slice(-3);
    assert.equal(
      new Set(retries.map((request) => request.headers["idempotency-key"]))
        .size,
      1,
    );
    failFinalization = false;
    const replacement = await run(["upload", game, "--json"], directory);
    assert.equal(replacement.code, 0);
    assert.match(replacement.messages[0].data.message, /visibility and settings are unchanged/);
    assert.equal(
      requests.filter((request) => request.path === "/object").length,
      puts,
    );
    assert.ok(finalizeCount >= 5);
    assert.equal(
      requests.filter((request) => request.path === "/api/uploads").at(-1).body
        .gameId,
      gameId,
    );
    assert.equal((await run(["whoami", "--json"], directory)).code, 0);
    assert.equal(
      (await run(["logout", "--json"], directory)).messages[0].data.revoked,
      true,
    );
    assert.equal(
      JSON.parse(await readFile(credentialPath, "utf8")).accounts[site],
      undefined,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(directory, { recursive: true, force: true });
  }
});
