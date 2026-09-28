import { cp, mkdir, readdir, realpath, writeFile } from "node:fs/promises";
import {
  resolve,
  dirname,
  basename,
  join,
  relative,
  isAbsolute,
  sep,
} from "node:path";
import { hostname } from "node:os";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import {
  packDirectory,
  readGameDirectory,
  validateFiles,
} from "../../format/src/index";
import { readConfig, saveConfig, selectedSite, type CliConfig } from "./config";
import { ApiFailure, Client, delay } from "./client";
import { startDevServer } from "./dev";

export type Options = {
  json?: boolean;
  noOpen?: boolean;
  game?: string;
  out?: string;
  yes?: boolean;
  name?: string;
  port?: string;
  visibility?: string;
  forkable?: string;
};
type Uploaded = {
  gameId: string;
  versionId: string;
  slug: string;
  previewUrl: string;
  versionNumber: number;
  state: string;
};
type OwnedGame = {
  id: string;
  slug: string;
  title: string;
  latestVersionId: string;
  versions: Array<{ id: string; versionNumber: number }>;
};

function authenticated(config: CliConfig, site: string) {
  const credentials = config.accounts[site];
  if (!credentials || credentials.expiresAt <= Date.now())
    throw new Error(
      "Your device login is missing or expired. Run hugame login again.",
    );
  return new Client(site, credentials.token);
}

function openBrowser(url: string) {
  const command =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "rundll32"
        : "xdg-open";
  const args =
    process.platform === "win32" ? ["url.dll,FileProtocolHandler", url] : [url];
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    shell: false,
  });
  child.on("error", () => {});
  child.unref();
}

export async function runCommand(
  command: string,
  argument: string | undefined,
  options: Options,
  emit: (value: unknown) => void,
) {
  if (command === "init") {
    const directory = resolve(argument ?? "my-game");
    await mkdir(directory, { recursive: true });
    if ((await readdir(directory)).length)
      throw new Error("Choose an empty folder for your starter game.");
    const assets = resolve(__dirname, "../assets/ping-pong");
    for (const entry of await readdir(assets)) {
      await cp(join(assets, entry), join(directory, entry), {
        recursive: true,
        force: false,
        errorOnExist: true,
      });
    }
    await readGameDirectory(directory);
    return {
      directory,
      message:
        "Your Ping Pong game is ready. Open index.html to play, then ask your agent to change it.",
    };
  }
  if (command === "validate" || command === "pack") {
    const directory = await realpath(resolve(argument ?? "."));
    const files = await readGameDirectory(directory);
    const result = validateFiles(files);
    if (command === "validate")
      return {
        valid: true,
        title: result.manifest.title,
        files: files.size,
        extractedBytes: result.extractedBytes,
        schemaVersion: 1,
      };
    const requestedOutput = resolve(
      options.out ??
        join(dirname(directory), `${directory.split(/[\\/]/).at(-1)}.zip`),
    );
    const output = join(
      await realpath(dirname(requestedOutput)),
      basename(requestedOutput),
    );
    const inside = relative(directory, output);
    if (
      inside === "" ||
      (inside !== ".." && !inside.startsWith(`..${sep}`) && !isAbsolute(inside))
    )
      throw new Error(
        "Save the ZIP outside the game folder so it is not included in the next upload.",
      );
    const archive = await packDirectory(directory);
    await writeFile(output, archive, { flag: "wx" });
    return {
      path: output,
      bytes: archive.length,
      message: "ZIP saved. Upload it on the website or use hugame upload.",
    };
  }
  if (command === "dev") {
    const directory = await realpath(resolve(argument ?? "."));
    const port = options.port === undefined ? 1758 : Number(options.port);
    if (!Number.isInteger(port) || port < 0 || port > 65535)
      throw new Error("Use a port number from 0 to 65535.");
    const server = await startDevServer(directory, port);
    emit({
      type: "dev_server",
      data: { url: server.url, directory },
      message: `Hugame dev is running at ${server.url}. Press Ctrl+C to stop.`,
    });
    if (!options.noOpen && !options.json) openBrowser(server.url);
    await server.waitForShutdown();
    return { stopped: true, url: server.url };
  }

  const config = await readConfig();
  const site = selectedSite(config);
  if (command === "login") {
    const client = new Client(site);
    const start = await client.request<{
      deviceCode: string;
      userCode: string;
      verificationUri: string;
      verificationUriComplete?: string;
      expiresIn: number;
      interval: number;
    }>("/api/device/code", {
      method: "POST",
      anonymous: true,
      retries: 0,
      body: {
        deviceLabel: options.name ?? `Hugame CLI on ${hostname()}`,
        scopes: ["games:read", "games:write", "games:publish"],
      },
    });
    const verification = new URL(start.verificationUriComplete ?? start.verificationUri);
    if (verification.origin !== site)
      throw new Error("The login page does not match your chosen Hugame site.");
    emit({
      type: "device_authorization",
      verificationUri: verification.href,
      userCode: start.userCode,
      message:
        "Sign in in your browser, enter this code, and approve this device. Leave this command running.",
    });
    if (!options.noOpen && !options.json) openBrowser(verification.href);
    const expires = Date.now() + Math.min(start.expiresIn, 600) * 1000;
    let interval = Math.max(5, Math.min(start.interval, 60));
    while (Date.now() < expires) {
      await delay(interval * 1000);
      try {
        const authorized = await client.request<{
          accessToken: string;
          expiresIn: number;
        }>("/api/device/token", {
          method: "POST",
          anonymous: true,
          retries: 0,
          body: { deviceCode: start.deviceCode },
        });
        if (
          !/^hg_[A-Za-z0-9_-]{43}$/.test(authorized.accessToken) ||
          !Number.isFinite(authorized.expiresIn)
        )
          throw new Error("Hugame returned an invalid device credential.");
        config.accounts[site] = {
          token: authorized.accessToken,
          expiresAt: Date.now() + authorized.expiresIn * 1000,
        };
        config.activeSite = site;
        await saveConfig(config);
        return {
          connected: true,
          site,
          message: "Device connected. You can upload games now.",
        };
      } catch (error) {
        if (
          error instanceof ApiFailure &&
          error.code === "authorization_pending"
        )
          continue;
        if (error instanceof ApiFailure && error.code === "slow_down") {
          interval = Math.min(interval + 5, 60);
          continue;
        }
        throw error;
      }
    }
    throw new Error("The login code expired. Run hugame login again.");
  }

  if (command === "logout") {
    let revoked = false;
    if (config.accounts[site]) {
      try {
        await authenticated(config, site).request("/api/device/revoke", {
          method: "POST",
          retries: 0,
        });
        revoked = true;
      } catch {
        /* Clear local credentials even if the server is unreachable. */
      }
    }
    delete config.accounts[site];
    if (config.activeSite === site) delete config.activeSite;
    await saveConfig(config);
    return {
      localCleared: true,
      revoked,
      message: revoked
        ? "Device disconnected."
        : "Local login removed. If needed, revoke this device from Account → Paired devices on the website.",
    };
  }

  const client = authenticated(config, site);
  if (command === "whoami") return client.request("/api/me");
  if (command === "games") return client.request("/api/me/games");
  if (command === "upload") {
    const directory = await realpath(resolve(argument ?? "."));
    const archive = await packDirectory(directory);
    const digest = createHash("sha256").update(archive).digest("base64");
    const projectKey = `${site}|${directory}`;
    const saved = config.projects[projectKey] ?? {};
    const gameId = options.game ?? saved.gameId;
    const replacing = Boolean(gameId);
    if (gameId && !/^[a-f0-9]{24}$/.test(gameId))
      throw new Error("Use the game ID shown by hugame games.");
    let uploadId =
      saved.checksum === digest && saved.gameId === gameId
        ? saved.uploadId
        : undefined;
    let result: Uploaded | undefined;
    if (uploadId) {
      try {
        result = await client.request<Uploaded>(
          `/api/uploads/${uploadId}/finalize`,
          {
            method: "POST",
          },
        );
      } catch (error) {
        if (
          !(error instanceof ApiFailure) ||
          ![404, 410].includes(error.status)
        )
          throw error;
        uploadId = undefined;
      }
    }
    if (!result) {
      const ticket = await client.request<{
        uploadId: string;
        uploadUrl: string;
        headers: Record<string, string>;
      }>("/api/uploads", {
        method: "POST",
        body: { gameId, size: archive.length, checksum: digest },
      });
      const destination = new URL(ticket.uploadUrl);
      if (
        destination.protocol !== "https:" &&
        !(
          destination.protocol === "http:" &&
          new URL(site).protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(destination.hostname)
        )
      )
        throw new Error("The upload destination must use HTTPS.");
      const response = await fetch(destination, {
        method: "PUT",
        headers: {
          "content-type": "application/zip",
          "x-amz-checksum-sha256": digest,
        },
        body: new Uint8Array(archive),
        redirect: "error",
        signal: AbortSignal.timeout(120000),
      });
      if (!response.ok)
        throw new Error("The ZIP upload failed. Run the upload command again.");
      config.projects[projectKey] = {
        gameId,
        uploadId: ticket.uploadId,
        checksum: digest,
      };
      await saveConfig(config);
      result = await client.request<Uploaded>(
        `/api/uploads/${ticket.uploadId}/finalize`,
        {
          method: "POST",
        },
      );
    }
    config.projects[projectKey] = {
      gameId: result.gameId,
      versionId: result.versionId,
    };
    await saveConfig(config);
    return {
      ...result,
      previewUrl: new URL(result.previewUrl, site).href,
      message: replacing
        ? "Version replaced. The game's visibility and settings are unchanged."
        : "Private draft uploaded. Open the preview, test your game, then publish only when you are ready.",
    };
  }
  if (command === "publish") {
    if (!argument || !/^[a-f0-9]{24}$/.test(argument))
      throw new Error(
        "Use hugame publish <game-id-or-version-id> --yes after checking the private preview.",
      );
    if (!options.yes)
      throw new Error(
        "Sharing makes your game playable by other people. After checking the preview, run this command with --yes to confirm.",
      );
    const visibility = options.visibility ?? "public";
    if (!(["public", "unlisted"] as string[]).includes(visibility))
      throw new Error("Use --visibility public or --visibility unlisted.");
    let forkable: boolean | undefined;
    if (options.forkable !== undefined) {
      if (!(["true", "false"] as string[]).includes(options.forkable))
        throw new Error("Use --forkable true or --forkable false.");
      forkable = options.forkable === "true";
    }
    const games = await client.request<OwnedGame[]>("/api/me/games");
    const game = games.find(
      (entry) =>
        entry.id === argument ||
        entry.versions.some((version) => version.id === argument),
    );
    if (!game) throw new Error("That game or version is not in your account.");
    const versionId = game.id === argument ? game.latestVersionId : argument;
    if (forkable !== undefined)
      await client.request(`/api/games/${game.id}/settings`, {
        method: "PATCH",
        body: { forkable },
      });
    const result = await client.request<{
      gameId: string;
      versionId: string;
      url: string;
      visibility: "public" | "unlisted";
    }>(`/api/games/${game.id}/publish`, {
      method: "POST",
      body: { versionId, visibility },
    });
    return {
      ...result,
      url: new URL(result.url, site).href,
      message:
        visibility === "public"
          ? "Your game is public and can appear in the arcade. Share this play link."
          : "Your game is unlisted. Anyone with this play link can open it.",
    };
  }
  throw new Error(`Unknown command: ${command}`);
}
