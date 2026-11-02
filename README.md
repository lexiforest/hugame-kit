# Hugame Kit

Build a small web game on your computer, host and share it on [hugame.dev](https://hugame.dev).

This kit includes:

- `hugame`, the omni CLI for developing and publishing games to hugame.dev.
- The `hugame` skill for Codex, Claude Code, and other coding agents.
- Hugame package v1 spec.
- Starter projects and complete example games.

Beginner instructions live at [hugame.dev/learn](https://hugame.dev/learn). The repository documentation is the technical reference for tool contributors and game authors who need exact behavior.

## Repository map

```text
packages/      Source for the hugame CLI package
skills/        Agent skills and Ping Pong starter
specs/         Package schema and links to the maintained references
examples/      Complete example games
```

## using the CLI

A new upload starts as a private build. Uploading to an existing game replaces its version in place while preserving visibility and settings, so live updates must be tested before upload. Sharing a private game as public or unlisted is a separate confirmed action.

## Development

### Build and test

Node.js 22 or later is required.

```sh
npm install
npm test
npm run build
```

Build output is written to `packages/cli/dist` and `release`. A local build does not mean the CLI or skill has been published. Release only reviewed artifacts from a tagged commit.

### Release tag checks

Set the root and all workspace package versions together before a release:

```sh
npm run version:bump -- 0.0.6
```

This also synchronizes `package-lock.json`. It does not create a commit or tag.
The game package schema version is independent and stays unchanged.

Run `npm run hooks:install` once per clone to enable the repository's Git hooks.
This sets the clone's `core.hooksPath` to `.githooks`; if you already use custom
hooks, integrate `.githooks/pre-push` with them instead.
The pre-push hook checks each pushed `v*` tag against
`packages/cli/package.json` in the tagged commit, including annotated tags.
Commit the version bump before tagging. A pre-commit hook cannot check a tag
that will be created later. GitHub Actions also enforces this check for pushes
that bypass local hooks.

### Try the CLI from source

```sh
npm run build:cli
node packages/cli/dist/hugame.cjs init my-game
node packages/cli/dist/hugame.cjs dev my-game
```

Account commands use `https://hugame.dev` by default. Advanced users can set
`HUGAME_URL` to a custom Hugame-compatible origin; a successful login remembers
that site for later commands, and setting the variable again overrides it.
Custom origins must use HTTPS, except that HTTP is allowed for localhost
development.

```sh
HUGAME_URL=http://localhost:3000 node packages/cli/dist/hugame.cjs login
```
