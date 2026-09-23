import { posix } from "node:path";
import { packageError } from "./manifest";

export const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".wasm": "application/wasm",
};

export function validateArchivePath(path: string, directory = false): void {
  const parts = path.split("/");
  if (
    path.length > 240 ||
    /[\\%?#:\x00-\x1f\x7f]/.test(path) ||
    parts.some(
      (part) =>
        !part ||
        part.startsWith(".") ||
        part.endsWith(".") ||
        part.endsWith(" ") ||
        !/^[a-zA-Z0-9_ .-]+$/.test(part),
    )
  ) {
    packageError(
      path,
      "unsafe_path",
      "Use a short relative path without hidden files, special characters, or '..'.",
    );
  }
  if (!directory && !MIME_TYPES[posix.extname(path).toLowerCase()]) {
    packageError(
      path,
      "file_type",
      "This file type cannot be included in a game.",
    );
  }
}

export function validatePath(path: string): void {
  validateArchivePath(path);
  const parts = path.split("/");
  if (parts.length > 1 && !["assets", "scripts", "styles"].includes(parts[0])) {
    packageError(
      path,
      "layout",
      "Put extra files inside assets/, scripts/, or styles/.",
    );
  }
  if (
    parts.length === 1 &&
    !["index.html", "hugame.json", "cover.png", "cover.webp"].includes(path)
  ) {
    packageError(
      path,
      "layout",
      "Only index.html, hugame.json, and the cover belong at the top level.",
    );
  }
}

function starts(data: Buffer, bytes: number[]) {
  return data.subarray(0, bytes.length).equals(Buffer.from(bytes));
}

export function validateSignature(path: string, data: Buffer): void {
  const ext = posix.extname(path).toLowerCase();
  const ascii = (start: number, end: number) =>
    data.toString("ascii", start, end);
  let valid = true;
  switch (ext) {
    case ".png":
      valid =
        starts(data, [137, 80, 78, 71, 13, 10, 26, 10]) &&
        ascii(12, 16) === "IHDR";
      break;
    case ".webp":
      valid = ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
      break;
    case ".jpg":
    case ".jpeg":
      valid = starts(data, [255, 216, 255]);
      break;
    case ".gif":
      valid = ["GIF87a", "GIF89a"].includes(ascii(0, 6));
      break;
    case ".wav":
      valid = ascii(0, 4) === "RIFF" && ascii(8, 12) === "WAVE";
      break;
    case ".mp3":
      valid =
        ascii(0, 3) === "ID3" || (data[0] === 255 && (data[1] & 224) === 224);
      break;
    case ".ogg":
      valid = ascii(0, 4) === "OggS";
      break;
    case ".mp4":
      valid = ascii(4, 8) === "ftyp";
      break;
    case ".webm":
      valid = starts(data, [26, 69, 223, 163]);
      break;
    case ".woff":
      valid = ascii(0, 4) === "wOFF";
      break;
    case ".woff2":
      valid = ascii(0, 4) === "wOF2";
      break;
    case ".ttf":
      valid = starts(data, [0, 1, 0, 0]);
      break;
    case ".otf":
      valid = ascii(0, 4) === "OTTO";
      break;
    case ".wasm":
      valid = starts(data, [0, 97, 115, 109, 1, 0, 0, 0]);
      break;
    default:
      try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
        valid = !text.includes("\0");
        if (ext === ".json") JSON.parse(text);
        if (ext === ".html")
          valid &&= /<(?:!doctype\s+html|html|head|body)\b/i.test(text);
      } catch {
        valid = false;
      }
  }
  if (!valid)
    packageError(
      path,
      "file_signature",
      "The file contents do not match its file type.",
    );
}

export function coverDimensions(data: Buffer, path: string): [number, number] {
  if (path.endsWith(".png") && data.length >= 24)
    return [data.readUInt32BE(16), data.readUInt32BE(20)];
  const chunk = data.toString("ascii", 12, 16);
  if (chunk === "VP8X" && data.length >= 30)
    return [data.readUIntLE(24, 3) + 1, data.readUIntLE(27, 3) + 1];
  if (
    chunk === "VP8 " &&
    data.length >= 30 &&
    data.subarray(23, 26).equals(Buffer.from([157, 1, 42]))
  )
    return [data.readUInt16LE(26) & 16383, data.readUInt16LE(28) & 16383];
  if (chunk === "VP8L" && data.length >= 25 && data[20] === 47) {
    const bits = data.readUInt32LE(21);
    return [(bits & 16383) + 1, ((bits >>> 14) & 16383) + 1];
  }
  return packageError(
    path,
    "cover_image",
    "Use a valid PNG or WebP cover image.",
  );
}
