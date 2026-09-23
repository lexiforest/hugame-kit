import {
  chmod,
  lstat,
  mkdir,
  readFile,
  rename,
  unlink,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

export type ProjectLink = {
  gameId?: string;
  versionId?: string;
  uploadId?: string;
  checksum?: string;
};
export type CliConfig = {
  version: 1;
  activeSite?: string;
  accounts: Record<string, { token: string; expiresAt: number }>;
  projects: Record<string, ProjectLink>;
};

export function configDirectory() {
  return process.env.HUGAME_CONFIG_DIR ?? join(homedir(), ".config", "hugame");
}

async function checkPath(path: string, directory = false) {
  try {
    const info = await lstat(path);
    if (
      info.isSymbolicLink() ||
      (directory ? !info.isDirectory() : !info.isFile())
    )
      throw new Error(
        "The Hugame configuration path must not be a link or special file.",
      );
    if (process.platform !== "win32" && (info.mode & 0o077) !== 0)
      throw new Error(
        "Hugame configuration permissions are too open. Set the directory to 700 and credentials.json to 600.",
      );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

export async function readConfig(): Promise<CliConfig> {
  const directory = configDirectory();
  await checkPath(directory, true);
  const file = join(directory, "credentials.json");
  await checkPath(file);
  try {
    const value = JSON.parse(await readFile(file, "utf8")) as CliConfig;
    if (value.version !== 1 || !value.accounts || !value.projects)
      throw new Error(
        "Unsupported Hugame configuration. Keep a backup and sign in again.",
      );
    return value;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT")
      return { version: 1, accounts: {}, projects: {} };
    if (error instanceof SyntaxError)
      throw new Error(
        "The Hugame credentials file is invalid JSON. Keep a private backup and sign in again.",
      );
    throw error;
  }
}

export async function saveConfig(value: CliConfig): Promise<void> {
  const directory = configDirectory();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await checkPath(directory, true);
  const file = join(directory, "credentials.json");
  await checkPath(file);
  const temporary = join(directory, `.credentials-${randomUUID()}.json`);
  try {
    await writeFile(temporary, JSON.stringify(value, null, 2) + "\n", {
      mode: 0o600,
      flag: "wx",
    });
    if (process.platform !== "win32") await chmod(temporary, 0o600);
    await rename(temporary, file);
  } finally {
    await unlink(temporary).catch(() => {});
  }
}

export function normalizeSite(value: string): string {
  const url = new URL(value);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== "/" && url.pathname !== "")
  )
    throw new Error("Use the site's origin, for example https://hugame.dev.");
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    )
  )
    throw new Error(
      "Use HTTPS for Hugame. HTTP is allowed only for localhost development.",
    );
  return url.origin;
}

export function selectedSite(config: CliConfig, option?: string): string {
  const value = option ?? (process.env.HUGAME_URL || config.activeSite);
  if (!value)
    throw new Error("First run hugame login --site https://hugame.dev.");
  return normalizeSite(value);
}
