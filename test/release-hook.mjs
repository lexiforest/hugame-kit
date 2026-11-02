import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const checker = resolve("scripts/check-pushed-tags.mjs");

test("release tags match their pushed commit and destination name", () => {
  const directory = mkdtempSync(join(tmpdir(), "hugame-release-hook-"));
  const git = (...args) => execFileSync("git", args, {
    cwd: directory,
    encoding: "utf8",
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  const zero = "0".repeat(40);
  const check = (input) => spawnSync(process.execPath, [checker], {
    cwd: directory, encoding: "utf8", input,
  });
  const push = (object, tag) => `refs/tags/local ${object} refs/tags/${tag} ${zero}\n`;
  try {
    git("init");
    git("config", "user.name", "Hook Test");
    git("config", "user.email", "hook@example.invalid");
    mkdirSync(join(directory, "packages/cli"), { recursive: true });
    const manifest = join(directory, "packages/cli/package.json");
    writeFileSync(manifest, JSON.stringify({ version: "1.2.3" }));
    git("add", ".");
    git("-c", "commit.gpgsign=false", "commit", "-m", "fixture");
    const commit = git("rev-parse", "HEAD");
    git("-c", "tag.gpgsign=false", "tag", "-a", "v1.2.3", "-m", "release");
    const annotated = git("rev-parse", "refs/tags/v1.2.3");
    // Neither later commits nor uncommitted version edits affect an older tag.
    writeFileSync(manifest, JSON.stringify({ version: "2.0.0" }));
    git("add", ".");
    git("-c", "commit.gpgsign=false", "commit", "-m", "next version");
    writeFileSync(manifest, JSON.stringify({ version: "3.0.0" }));
    assert.equal(check(push(commit, "v1.2.3")).status, 0);
    assert.equal(check(push(annotated, "v1.2.3")).status, 0);
    const mismatch = check(push(commit, "v1.2.4"));
    assert.equal(mismatch.status, 1);
    assert.match(mismatch.stderr, /does not match.*1\.2\.3/);
    assert.equal(check(push(commit, "v1.2.3") + push(annotated, "v2.0.0")).status, 1);
    assert.equal(check(`refs/heads/main ${commit} refs/heads/main ${zero}\n`).status, 0);
    assert.equal(check(push(commit, "preview")).status, 0);
    assert.equal(check(push(zero, "v1.2.3")).status, 0);
    assert.equal(check(push("f".repeat(40), "v1.2.3")).status, 1);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
