import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { ZipFile } from "yazl";
import { packDirectory } from "../packages/format/src/index";

const skillFolder = "skills/hugame";
const releaseFolder = "release";

async function zipSkill(): Promise<Buffer> {
  const zip = new ZipFile();
  async function addFiles(directory: string): Promise<void> {
    const entries = (await readdir(directory, { withFileTypes: true })).sort(
      (left, right) => left.name.localeCompare(right.name),
    );
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) await addFiles(path);
      else
        zip.addBuffer(
          await readFile(path),
          `hugame/${relative(skillFolder, path).split("\\").join("/")}`,
          {
            mtime: new Date("2000-01-01T00:00:00Z"),
            forceDosTimestamp: true,
            mode: 0o100644,
          },
        );
    }
  }
  const result = new Promise<Buffer>((resolve, reject) => {
    const parts: Buffer[] = [];
    zip.outputStream.on("data", (part) => parts.push(part));
    zip.outputStream.on("error", reject);
    zip.outputStream.on("end", () => resolve(Buffer.concat(parts)));
  });
  await addFiles(skillFolder);
  zip.end();
  return result;
}

await mkdir(releaseFolder, { recursive: true });
await writeFile(
  join(releaseFolder, "ping-pong.zip"),
  await packDirectory(join(skillFolder, "assets/ping-pong")),
);
await writeFile(join(releaseFolder, "hugame.zip"), await zipSkill());
console.log("Built release/ping-pong.zip and release/hugame.zip.");
