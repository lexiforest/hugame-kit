import { createHash } from "node:crypto";
import { posix } from "node:path";
import * as yauzl from "yauzl";
import { crc32 } from "./crc32";
import {
  coverDimensions,
  validateArchivePath,
  validatePath,
  validateSignature,
} from "./files";
import {
  manifestSchema,
  PackageError,
  PACKAGE_LIMITS,
  packageError,
  type GameManifest,
  type PackageIssue,
} from "./manifest";

export type ValidatedPackage = {
  manifest: GameManifest;
  files: Map<string, Buffer>;
  coverPath: "cover.png" | "cover.webp";
  checksum: string;
  compressedBytes: number;
  extractedBytes: number;
};

export function checksum(data: Buffer): string {
  return createHash("sha256").update(data).digest("base64");
}

function isIgnoredArchiveMetadata(path: string): boolean {
  const parts = path.replace(/\/$/, "").split("/");
  const name = parts.at(-1);
  return (
    parts[0] === "__MACOSX" || name === ".DS_Store" || name === "Thumbs.db"
  );
}

/** Bounded in-memory extraction; never write paths from an archive to disk. */
export async function readArchive(
  archive: Buffer,
): Promise<Map<string, Buffer>> {
  if (archive.length > PACKAGE_LIMITS.archiveBytes)
    packageError(
      "game.zip",
      "archive_size",
      "Your ZIP must be 50 MiB or smaller.",
    );
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      archive,
      { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
      (error, zip) => {
        if (error || !zip) {
          reject(
            new PackageError([
              {
                file: "game.zip",
                code: "invalid_zip",
                message: "Choose a valid, unencrypted ZIP file.",
              },
            ]),
          );
          return;
        }
        const files = new Map<string, Buffer>();
        const names = new Set<string>();
        let extractedBytes = 0;
        let declaredBytes = 0;
        let entries = 0;
        let failed = false;
        const fail = (cause: unknown) => {
          if (failed) return;
          failed = true;
          zip.close();
          reject(
            cause instanceof PackageError
              ? cause
              : new PackageError([
                  {
                    file: "game.zip",
                    code: "invalid_zip",
                    message:
                      "This ZIP could not be read. Make a new ZIP and try again.",
                  },
                ]),
          );
        };
        zip.on("error", fail);
        zip.on("end", () => {
          if (!failed) resolve(files);
        });
        zip.on("entry", (entry: yauzl.Entry) => {
          try {
            if (++entries > PACKAGE_LIMITS.files)
              packageError(
                "game.zip",
                "file_count",
                "Your ZIP may contain at most 500 entries.",
              );
            const mode = (entry.externalFileAttributes >>> 16) & 0xf000;
            if (mode !== 0 && mode !== 0x8000 && mode !== 0x4000)
              packageError(
                entry.fileName,
                "special_file",
                "Links and special files are not allowed.",
              );
            if (entry.generalPurposeBitFlag & 1)
              packageError(
                entry.fileName,
                "encrypted",
                "Remove password protection from your ZIP.",
              );
            if (![0, 8].includes(entry.compressionMethod))
              packageError(
                entry.fileName,
                "compression",
                "Use standard ZIP compression.",
              );
            if (isIgnoredArchiveMetadata(entry.fileName)) {
              zip.readEntry();
              return;
            }
            const directory = entry.fileName.endsWith("/");
            const path = directory
              ? entry.fileName.slice(0, -1)
              : entry.fileName;
            validateArchivePath(path, directory);
            const folded = path.toLowerCase();
            if (names.has(folded))
              packageError(
                path,
                "duplicate_path",
                "Each file and folder must have a unique name, including letter case.",
              );
            names.add(folded);
            if (directory) {
              zip.readEntry();
              return;
            }
            declaredBytes += entry.uncompressedSize;
            if (
              entry.uncompressedSize > PACKAGE_LIMITS.fileBytes ||
              declaredBytes > PACKAGE_LIMITS.extractedBytes
            )
              packageError(
                path,
                "extracted_size",
                "Use files below 25 MiB and a total unzipped size below 100 MiB.",
              );
            zip.openReadStream(entry, (streamError, stream) => {
              if (streamError || !stream) {
                fail(streamError);
                return;
              }
              const chunks: Buffer[] = [];
              let bytes = 0;
              stream.on("error", fail);
              stream.on("data", (chunk: Buffer) => {
                bytes += chunk.length;
                extractedBytes += chunk.length;
                if (
                  bytes > PACKAGE_LIMITS.fileBytes ||
                  extractedBytes > PACKAGE_LIMITS.extractedBytes
                ) {
                  stream.destroy();
                  fail(
                    new PackageError([
                      {
                        file: path,
                        code: "extracted_size",
                        message: "This ZIP expands beyond the game size limit.",
                      },
                    ]),
                  );
                } else chunks.push(chunk);
              });
              stream.on("end", () => {
                if (failed) return;
                const data = Buffer.concat(chunks);
                if (data.length !== entry.uncompressedSize) {
                  fail(new Error("Size mismatch"));
                  return;
                }
                if (crc32(data) !== entry.crc32) {
                  fail(
                    new PackageError([
                      {
                        file: path,
                        code: "crc_mismatch",
                        message:
                          "This file was damaged. Make a new ZIP and try again.",
                      },
                    ]),
                  );
                  return;
                }
                files.set(path, data);
                zip.readEntry();
              });
            });
          } catch (cause) {
            fail(cause);
          }
        });
        zip.readEntry();
      },
    );
  });
}

/** Finder and other ZIP tools commonly wrap every file in the selected folder. */
function unwrapSingleRoot(files: Map<string, Buffer>): Map<string, Buffer> {
  if (files.has("hugame.json") || files.has("index.html")) return files;
  const paths = [...files.keys()];
  if (!paths.length || paths.some((path) => !path.includes("/"))) return files;
  const roots = new Set(paths.map((path) => path.slice(0, path.indexOf("/"))));
  if (roots.size !== 1) return files;
  const prefix = `${roots.values().next().value}/`;
  return new Map(
    paths.map((path) => [path.slice(prefix.length), files.get(path)!]),
  );
}

function checkReference(
  file: string,
  reference: string,
  files: Map<string, Buffer>,
  issues: PackageIssue[],
) {
  const value = reference.trim();
  if (!value || value.startsWith("#")) return;
  if (
    /^data:(image\/(png|webp|jpeg|gif)|audio\/(mpeg|wav|ogg));base64,/i.test(
      value,
    )
  )
    return;
  if (/^[a-z][a-z\d+.-]*:|^\/|\\|[\x00-\x1f]/i.test(value)) {
    issues.push({
      file,
      code: "external_reference",
      message:
        "Bundle every asset locally. External URLs and absolute paths are not allowed.",
    });
    return;
  }
  let decoded: string;
  try {
    decoded = decodeURIComponent(value.split(/[?#]/)[0]);
  } catch {
    issues.push({
      file,
      code: "invalid_reference",
      message: `Fix the asset path: ${value}.`,
    });
    return;
  }
  const target = posix.normalize(posix.join(posix.dirname(file), decoded));
  if (!files.has(target))
    issues.push({
      file,
      code: "missing_reference",
      message: `Add the local file ${target}, or fix its path.`,
    });
}

export function validateFiles(files: Map<string, Buffer>): {
  manifest: GameManifest;
  coverPath: "cover.png" | "cover.webp";
  extractedBytes: number;
} {
  if (files.size > PACKAGE_LIMITS.files)
    packageError("game.zip", "file_count", "Use at most 500 files.");
  for (const required of ["hugame.json", "index.html"]) {
    if (!files.has(required))
      packageError(
        required,
        "missing_file",
        `Add ${required} at the top level of your ZIP.`,
      );
  }
  const covers = (["cover.png", "cover.webp"] as const).filter((path) =>
    files.has(path),
  );
  if (covers.length !== 1)
    packageError(
      "cover.png",
      "cover_required",
      "Add exactly one cover.png or cover.webp at the top level.",
    );
  const coverPath = covers[0];
  const issues: PackageIssue[] = [];
  let extractedBytes = 0;
  const names = new Set<string>();
  for (const [path, data] of files) {
    validatePath(path);
    if (names.has(path.toLowerCase()))
      packageError(
        path,
        "duplicate_path",
        "Each file must have a unique name, including letter case.",
      );
    names.add(path.toLowerCase());
    extractedBytes += data.length;
    if (
      data.length > PACKAGE_LIMITS.fileBytes ||
      extractedBytes > PACKAGE_LIMITS.extractedBytes
    )
      packageError(
        path,
        "extracted_size",
        "Use files below 25 MiB and a total unzipped size below 100 MiB.",
      );
    validateSignature(path, data);
    if (!/\.(html|css|m?js)$/i.test(path)) continue;
    const text = data.toString("utf8");
    // This lint helps authors catch mistakes. CSP and the isolated origin enforce isolation.
    if (
      /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|serviceWorker|importScripts)\b|\beval\s*\(|\bnew\s+Function\b|createElement\s*\(\s*['"]script['"]|\bimport\s*\(/i.test(
        text,
      )
    ) {
      issues.push({
        file: path,
        code: "unsafe_code",
        message:
          "Remove network requests, workers, and dynamic code loading. Use bundled files and window.Hugame.",
      });
    }
    if (/\.html$/i.test(path)) {
      if (
        /<(?:base|iframe|object|embed|form)\b|<meta\b[^>]*http-equiv\s*=|\bsrcdoc\s*=|\bsrcset\s*=/i.test(
          text,
        )
      )
        issues.push({
          file: path,
          code: "unsafe_html",
          message:
            "Remove embedded pages, forms, base URLs, srcset, and HTTP meta settings.",
        });
      for (const match of text.matchAll(
        /\b(?:src|href|poster)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
      ))
        checkReference(path, match[1] ?? match[2] ?? match[3], files, issues);
    }
    for (const match of text.matchAll(
      /url\(\s*['"]?([^)'"\s]+)['"]?\s*\)|@import\s+['"]([^'"]+)['"]|\b(?:import|export)\s+(?:[^;\n]*?\s+from\s*)?['"]([^'"]+)['"]/gi,
    ))
      checkReference(path, match[1] ?? match[2] ?? match[3], files, issues);
  }
  const parsed = manifestSchema.safeParse(
    JSON.parse(files.get("hugame.json")!.toString("utf8")),
  );
  if (!parsed.success) {
    issues.push(
      ...parsed.error.issues.map((issue) => ({
        file: "hugame.json",
        code: "manifest",
        message: `${issue.path.join(".")}: ${issue.message}`,
      })),
    );
  }
  const cover = files.get(coverPath)!;
  if (cover.length > PACKAGE_LIMITS.coverBytes)
    issues.push({
      file: coverPath,
      code: "cover_size",
      message: "Make your cover smaller than 2 MiB.",
    });
  const [width, height] = coverDimensions(cover, coverPath);
  if (width < 640 || height < 400 || width * 10 !== height * 16)
    issues.push({
      file: coverPath,
      code: "cover_dimensions",
      message: "Use a 16:10 cover at least 640 × 400 pixels.",
    });
  if (issues.length) throw new PackageError(issues);
  return { manifest: parsed.data!, coverPath, extractedBytes };
}

export async function validatePackage(
  archive: Buffer,
  expectedChecksum?: string,
): Promise<ValidatedPackage> {
  const digest = checksum(archive);
  if (expectedChecksum && expectedChecksum !== digest)
    packageError(
      "game.zip",
      "checksum",
      "The upload changed during transfer. Upload it again.",
    );
  const files = unwrapSingleRoot(await readArchive(archive));
  return {
    ...validateFiles(files),
    files,
    checksum: digest,
    compressedBytes: archive.length,
  };
}
