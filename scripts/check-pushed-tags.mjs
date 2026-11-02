import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Git supplies: local-ref local-object remote-ref remote-object.
// Use the destination tag name and the pushed object, not HEAD or the worktree.
let failed = false;
for (const line of readFileSync(0, "utf8").split(/\r?\n/)) {
  if (!line.trim()) continue;
  const [, object, remoteRef] = line.trim().split(/\s+/);
  if (!remoteRef?.startsWith("refs/tags/v") || /^0+$/.test(object)) continue;
  const tag = remoteRef.slice("refs/tags/".length);
  try {
    const manifest = JSON.parse(
      execFileSync(
        "git",
        ["show", `${object}^{commit}:packages/cli/package.json`],
        { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      ),
    );
    if (typeof manifest.version !== "string" || tag !== `v${manifest.version}`) {
      throw new Error(
        `tag ${tag} does not match packages/cli/package.json version ${manifest.version}`,
      );
    }
  } catch (error) {
    console.error(`Release push blocked: ${tag}: ${error.message}`);
    failed = true;
  }
}
if (failed) {
  console.error("Commit the CLI version bump, then create the matching tag on that commit.");
  process.exitCode = 1;
}
