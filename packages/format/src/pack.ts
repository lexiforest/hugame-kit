import { lstat, readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import { Readable } from "node:stream";
import { ZipFile } from "yazl";
import { PACKAGE_LIMITS, packageError } from "./manifest";
import { validatePath } from "./files";
import { validateFiles, validatePackage } from "./validate";

/** Package only a dedicated game output directory, never an entire project. */
export async function readGameDirectory(
  directory: string,
): Promise<Map<string, Buffer>> {
  const files = new Map<string, Buffer>();
  let total = 0;
  async function visit(current: string): Promise<void> {
    const entries = await readdir(current, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name, "en"));
    for (const entry of entries) {
      const fullPath = join(current, entry.name);
      const path = relative(directory, fullPath).split(sep).join("/");
      const info = await lstat(fullPath);
      if (info.isSymbolicLink())
        packageError(
          path,
          "special_file",
          "Remove links from the game folder.",
        );
      if (info.isDirectory()) {
        validatePath(`${path}/directory.json`);
        await visit(fullPath);
      } else if (info.isFile()) {
        validatePath(path);
        total += info.size;
        if (
          info.size > PACKAGE_LIMITS.fileBytes ||
          total > PACKAGE_LIMITS.extractedBytes
        )
          packageError(
            path,
            "extracted_size",
            "Use files below 25 MiB and a total unzipped size below 100 MiB.",
          );
        if (files.size >= PACKAGE_LIMITS.files)
          packageError(path, "file_count", "Use at most 500 files.");
        files.set(path, await readFile(fullPath));
      } else
        packageError(
          path,
          "special_file",
          "Only normal files and folders are allowed.",
        );
    }
  }
  await visit(directory);
  validateFiles(files);
  return files;
}

export async function packFiles(files: Map<string, Buffer>): Promise<Buffer> {
  validateFiles(files);
  const archive = await new Promise<Buffer>((resolve, reject) => {
    const zip = new ZipFile();
    const chunks: Buffer[] = [];
    let bytes = 0;
    zip.outputStream.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > PACKAGE_LIMITS.archiveBytes) {
        (zip.outputStream as Readable).destroy();
        reject(new Error("Your ZIP must be 50 MiB or smaller."));
      } else chunks.push(chunk);
    });
    zip.outputStream.on("error", reject);
    zip.outputStream.on("end", () => resolve(Buffer.concat(chunks)));
    for (const path of [...files.keys()].sort()) {
      zip.addBuffer(files.get(path)!, path, {
        mtime: new Date("2000-01-01T00:00:00Z"),
        mode: 0o100644,
        forceDosTimestamp: true,
      });
    }
    zip.end();
  });
  await validatePackage(archive);
  return archive;
}

export async function packDirectory(directory: string): Promise<Buffer> {
  return packFiles(await readGameDirectory(directory));
}
