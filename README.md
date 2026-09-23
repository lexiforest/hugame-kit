# Hugame creator kit

Build a small web game on your computer, host and share it on [hugame.dev](https://hugame.dev).

This kit is all you need:

- `hugame`, the local validator, player, packer, and publishing client;
- the portable `hugame` agent skill for Codex, Claude Code, and other coding agents;
- Hugame Package v1 validation and runtime behavior;
- starter projects and complete example games.

Beginner instructions live at [hugame.dev/learn](https://hugame.dev/learn). The repository documentation is the technical reference for tool contributors and game authors who need exact behavior.

## Repository map

```text
packages/format/   Shared package validation and deterministic ZIP code
packages/runtime/  Runtime bridge and local player behavior
packages/cli/      Source for the hugame CLI package
skills/hugame/     Portable agent skill and Star Catcher starter
examples/          Complete example games
specs/             Package schema and links to the maintained references
```

## Build and test

Node.js 22 or later is required.

```sh
npm install
npm test
npm run build
```

Build output is written to `packages/cli/dist` and `release`. A local build does not mean the CLI or skill has been published. Release only reviewed artifacts from a tagged commit.

## Try the CLI from source

```sh
npm run build:cli
node packages/cli/dist/hugame.cjs init my-game
node packages/cli/dist/hugame.cjs dev my-game
```

Uploading creates or replaces the game's one private build. Sharing it as public or unlisted is a separate action that requires confirmation of the exact build, visibility, and forkable-source setting.

## License

The CLI, skill, starter, shared tool code, and repository documentation are available under the MIT License. Example-game asset notices remain with their respective examples.
