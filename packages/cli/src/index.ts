import { parseArgs } from "node:util";
import { runCommand } from "./commands";

const VERSION = "0.0.2";

const help = `Hugame CLI ${VERSION} — local games, shared adventures

  hugame init [folder]                  Make a Ping Pong starter
  hugame dev [folder] [--port 1758]     Debug with the local Hugame runtime
  hugame validate [folder]              Check a Hugame package
  hugame pack [folder] [--out file.zip]  Save a reproducible ZIP
  hugame login                          Connect through your browser
  hugame upload [folder] [--game ID]     Upload a game or replace its version
  hugame publish <game-or-version> --yes [--visibility public|unlisted]
                                       Share after checking the preview
  hugame info                           Show your account, games, and versions
  hugame logout                         Revoke and remove this device login

Options: --no-open (login/dev), --port NUMBER (dev), --name LABEL (login),
         --visibility public|unlisted, --forkable true|false (publish).
Environment: HUGAME_URL selects the site origin. A successful login remembers it.
Every output line is JSON; login first emits a device-authorization event.
Package schema: Hugame v1. Requires Node.js 22 or later.
`;

function emit(value: unknown) {
  process.stdout.write(JSON.stringify(value) + "\n");
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean" },
      "no-open": { type: "boolean" },
      game: { type: "string" },
      out: { type: "string" },
      yes: { type: "boolean" },
      name: { type: "string" },
      port: { type: "string" },
      visibility: { type: "string" },
      forkable: { type: "string" },
    },
  });
  if (values.version) {
    emit({ type: "complete", data: { version: VERSION, schemaVersion: 1 } });
    return;
  }
  if (values.help || !positionals[0]) {
    emit({ type: "complete", data: { help } });
    return;
  }
  if (positionals.length > 2)
    throw new Error("Too many arguments. Run hugame --help.");
  if (
    ![
      "init",
      "dev",
      "validate",
      "pack",
      "login",
      "upload",
      "publish",
      "info",
      "logout",
    ].includes(positionals[0])
  )
    throw new Error("Unknown command. Run hugame --help.");
  const result = await runCommand(
    positionals[0],
    positionals[1],
    { ...values, noOpen: values["no-open"] },
    emit,
  );
  emit({ type: "complete", data: result });
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "The command failed.";
  emit({ type: "error", error: { message } });
  process.exitCode = 1;
});
