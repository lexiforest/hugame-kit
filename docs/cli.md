# Local publishing CLI

The Hugame CLI, shared publishing skill, and Star Catcher starter are MIT-licensed. Their distributions include the license notice; preserve it when redistributing or adapting them. Bundled third-party code retains its own license terms. This decision does not relicense unrelated application code.

The CLI build derives `dist/THIRD_PARTY_NOTICES.txt` from esbuild's actual bundled inputs and includes the dependency license texts. It fails if a bundled package lacks a license file. The npm artifact includes this file, the CLI's `LICENSE`, and the starter's `assets/license.html`; review them again whenever dependencies change.

The source package is `packages/cli` in the public `hugame-kit` repository, targeting Node.js 22+ and Hugame Package v1. Version 0.1.0 is built locally; this document does not claim it is published on npm yet. Use the website ZIP uploader until a release is available, or build from this checkout:

```sh
npm ci
npm run build:cli
node packages/cli/dist/hugame.cjs --help
```

`npm run build:downloads` validates and packs Star Catcher and builds the portable skill ZIP under `release/`. Run it again after changing the skill or starter.

For a local installable artifact, run `npm pack ./packages/cli --pack-destination /path/to/release-folder` after building. Install the resulting tarball with npm into your chosen tools environment. The package includes its validator and starter assets; it has no runtime npm dependencies to fetch.

## Workflow

These examples use the production site at `https://hugame.dev`. Use `https://staging.hugame.dev` only when deliberately testing against staging.

```sh
hugame init my-game
hugame dev my-game
hugame validate my-game
hugame pack my-game --out my-game.zip
hugame login --site https://hugame.dev
hugame upload my-game
hugame games
```

`hugame dev` validates the package, starts a loopback-only player at `http://127.0.0.1:4173`, and opens it in the browser. The player injects the same runtime bridge and sandbox policy used by Hugame, watches the folder, and reloads after valid changes. Its side panel logs lifecycle, score, game-over, progress, and achievement activity; it also emulates persistent player state and provides viewport, pause/resume, mute, reload, and reset controls. Use `--port NUMBER` to choose another port, `--port 0` to choose a free port, or `--no-open` to leave the browser closed. Press Ctrl+C to stop it.

The account holder approves the displayed code in their browser while login waits. The CLI opens a code-prefilled page; sign-in and profile completion return to that same request. Their Hugame profile must include a birth month and year, and uploading is limited to ages 13+. Under-13 creators must have an age-eligible adult handle the upload and publication using the adult's account. A login token is never displayed.

Local creation, development, validation, and `pack` do not require an account. Without a paired CLI, use `hugame pack` to create a ZIP and upload it through the website. `hugame upload` packages the folder in memory, so paired users do not need to run `pack` first.

Upload returns a private preview link and version ID. Play the preview before sharing. After explicit confirmation of the exact build, visibility, and forkable-source setting:

```sh
hugame publish VERSION_ID --visibility public --forkable false --yes
```

Use `--visibility unlisted` when anyone with the link may play but the game must stay out of discovery. Set `--forkable true` only when other people may download the source ZIP. Omitting `--forkable` preserves the current setting.

`upload` does not publish. A successful upload links the local folder to the game for future updates. Each game retains one version, so an update replaces the old build and makes the replacement private. Use `--game GAME_ID` to target an existing game explicitly, especially after moving the folder or changing machines. `publish GAME_ID --yes` selects the retained version; agents should prefer the returned version ID to make the human confirmation unambiguous.

## Machine output and credentials

- `--json` emits JSON objects, one per line. Commands end with `{ "type": "complete", "data": ... }`, or `{ "type": "error", "error": { "message": ... } }` and a nonzero exit status. Login first emits a `device_authorization` object with the browser URL and short user code, never the device secret or access token.
- `--no-open` prevents automatic browser launch during human-mode login or `dev`. JSON mode never opens a browser automatically. `--port` applies only to `dev`.
- `--site` overrides `HUGAME_URL`, then the remembered site. HTTPS is required except for loopback development.
- Credentials live in `.config/hugame/credentials.json` under the user's home directory, or under `HUGAME_CONFIG_DIR`. On POSIX the directory must be mode 0700 and file 0600. Keep this outside repositories and game packages. Windows users should keep it in their private user profile with appropriate account ACLs.
- `whoami` shows account data, not credentials. `logout` attempts server-side revocation and always removes the local login. If revocation fails, use the website's paired-device page to revoke it.
- Retried API mutations reuse the same idempotency key within the command. Successful object upload is remembered before finalization, allowing a subsequent unchanged upload command to resume a failed finalization without sending the ZIP again.

## Verification

`npm run test:cli` builds the binary and runs its full contract scenario against ephemeral loopback API/storage doubles. It does not verify production S3 signatures, CDN behavior, or npm publication. No real account credentials are used.
