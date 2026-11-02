import { readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const [version, ...extra] = process.argv.slice(2);
const number = "(?:0|[1-9][0-9]*)";
const prerelease = `(?:${number}|[0-9]*[A-Za-z-][0-9A-Za-z-]*)`;
const semver = new RegExp(
  `^${number}\\.${number}\\.${number}(?:-${prerelease}(?:\\.${prerelease})*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`,
);

async function main() {
  if (!version || extra.length || !semver.test(version)) {
    throw new Error("Usage: npm run version:bump -- <version> (for example 0.0.6)");
  }
  const readJson = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));
  const manifest = await readJson("package.json");
  if (JSON.stringify(manifest.workspaces) !== JSON.stringify(["packages/*"])) {
    throw new Error("Workspace layout changed; update the version bump script first.");
  }
  const directories = (await readdir(join(root, "packages"), { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => `packages/${entry.name}`)
    .sort();
  const lock = await readJson("package-lock.json");
  const updates = [];
  // Read and validate every manifest and lock entry before writing anything.
  for (const directory of ["", ...directories]) {
    const path = directory ? `${directory}/package.json` : "package.json";
    const pkg = directory ? await readJson(path) : manifest;
    if (!lock.packages?.[directory]) {
      throw new Error(`Missing lockfile entry for ${path}; regenerate the lockfile first.`);
    }
    pkg.version = version;
    lock.packages[directory].version = version;
    updates.push([path, pkg]);
  }
  lock.version = version;
  updates.push(["package-lock.json", lock]);
  for (const [path, data] of updates) {
    await writeFile(join(root, path), JSON.stringify(data, null, 2) + "\n");
  }
  console.log(`Set root and ${directories.length} workspace packages to ${version}; lockfile synchronized.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
