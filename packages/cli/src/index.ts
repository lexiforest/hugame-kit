import { parseArgs } from "node:util";
import { runCommand } from "./commands";

const VERSION = "0.0.1";

const help = `Hugame CLI ${VERSION} — local games, shared adventures

  hugame init [folder]                  Make a Star Catcher starter
  hugame dev [folder] [--port 4173]     Debug with the local Hugame runtime
  hugame validate [folder]              Check a Hugame package
  hugame pack [folder] [--out file.zip]  Save a reproducible ZIP
  hugame login --site https://hugame.dev Connect through your browser
  hugame upload [folder] [--game ID]     Upload a private draft
  hugame publish <game-or-version> --yes [--visibility public|unlisted]
                                       Share after checking the preview
  hugame games                          List your games and versions
  hugame whoami                         Show your account (never the token)
  hugame logout                         Revoke and remove this device login

Options: --site URL, --json, --no-open (login/dev), --port NUMBER (dev), --name LABEL (login),
         --visibility public|unlisted, --forkable true|false (publish).
JSON mode emits one JSON object per line; login first emits a pairing instruction.
Package schema: Hugame v1. Requires Node.js 22 or later.
`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean" },
      json: { type: "boolean" },
      site: { type: "string" },
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
  const emit = (value: unknown) => {
    if (values.json) process.stdout.write(JSON.stringify(value) + "\n");
    else if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (record.message) console.log(record.message);
      for (const [key, item] of Object.entries(record))
        if (key !== "message")
          console.log(
            `${key}: ${typeof item === "object" ? JSON.stringify(item, null, 2) : item}`,
          );
    } else console.log(value);
  };
  if (values.version) {
    emit({ version: VERSION, schemaVersion: 1 });
    return;
  }
  if (values.help || !positionals[0]) {
    process.stdout.write(help);
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
      "games",
      "whoami",
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
  emit(values.json ? { type: "complete", data: result } : result);
}

main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : "The command failed.";
  if (process.argv.includes("--json"))
    process.stdout.write(
      JSON.stringify({ type: "error", error: { message } }) + "\n",
    );
  else process.stderr.write(message + "\n");
  process.exitCode = 1;
});
