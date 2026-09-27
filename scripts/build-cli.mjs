import { build } from "esbuild";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";

await mkdir("packages/cli/dist", { recursive: true });
const result = await build({
  entryPoints: ["packages/cli/src/index.ts"],
  outfile: "packages/cli/dist/hugame.cjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "cjs",
  banner: { js: "#!/usr/bin/env node" },
  sourcemap: false,
  metafile: true,
  legalComments: "eof",
});
// Derive notices from actual bundled inputs rather than a manually maintained dependency list.
const packages = new Map();
for (const input of Object.keys(result.metafile.inputs)) {
  if (!input.split(/[\\/]/).includes("node_modules")) continue;
  let directory = dirname(resolve(input));
  while (directory.includes(`${sep}node_modules${sep}`)) {
    try {
      const manifest = JSON.parse(
        await readFile(join(directory, "package.json"), "utf8"),
      );
      if (manifest.name && manifest.version) {
        packages.set(directory, manifest);
        break;
      }
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    directory = dirname(directory);
  }
}
const notices = [
  "Third-party code bundled in hugame. Each component retains its own license.\n",
];
for (const [directory, manifest] of [...packages].sort((a, b) =>
  a[1].name.localeCompare(b[1].name),
)) {
  const files = (await readdir(directory))
    .filter((file) => /^(license|licence|copying|notice)(\.|$)/i.test(file))
    .sort();
  if (!files.some((file) => /^(license|licence|copying)(\.|$)/i.test(file)))
    throw new Error(
      `Missing license text for bundled dependency ${manifest.name}; review before release.`,
    );
  notices.push(
    `\n=== ${manifest.name}@${manifest.version} (${manifest.license ?? "see text"}) ===\n`,
  );
  for (const file of files)
    notices.push(
      `\n${file}\n${await readFile(join(directory, file), "utf8")}\n`,
    );
}
await writeFile("packages/cli/dist/THIRD_PARTY_NOTICES.txt", notices.join(""));
await rm("packages/cli/assets/ping-pong", { recursive: true, force: true });
await cp("skills/hugame/assets/ping-pong", "packages/cli/assets/ping-pong", {
  recursive: true,
});
console.log("Built hugame with its validator and starter assets.");
