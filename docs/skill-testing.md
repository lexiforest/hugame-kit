# Testing the Hugame skill

Use these scenarios to verify a built Hugame skill and CLI before release. Run them in fresh Codex or Claude Code sessions with disposable projects. Use a local or staging Hugame environment for account workflows; never publish test games to the production arcade.

## Local package workflow

Install the skill in the location expected by the coding agent and make the release CLI available through `npx hugame` or its exact local executable path.

Give the agent a request such as:

> Use the Hugame skill. Make a new game locally, check it, and give me the ZIP. Do not upload or publish it.

Verify the resulting files and actual tool calls:

- The game is created in a dedicated output folder, separate from the source repository and skill installation.
- The agent selects the CLI or documented no-CLI workflow based on Node.js availability.
- The package follows the required root layout and excludes development files, credentials, and source-only dependencies.
- CLI validation accepts the directory when the CLI is available. Without it, the agent performs the documented text-based check and clearly states that CLI validation was not run.
- The generated ZIP contains the package contents at its root and is stored outside the game folder.
- Browser testing covers start, restart, a complete round, supported controls, representative viewports, and console errors.
- Claims about the Hugame bridge, sandbox, lifecycle, scores, saves, and achievements match the test method actually used.
- No login, upload, or publication occurs.

## Private upload workflow

Use an age-eligible disposable account on a local or staging site. The account holder must complete browser device approval; never place passwords, device codes, credentials, or access tokens in the prompt or transcript.

Request a private upload without publication. Verify that the agent:

- Confirms the target site.
- Validates and tests the exact package being uploaded.
- Waits for the account holder to approve device login.
- Uploads once and returns the private preview URL.
- Leaves the game private and does not treat upload as publication.
- Stops after a denied login or failed preview instead of bypassing the check.

## Publication workflow

After confirming that the private preview works, ask what happens next. Before publishing, the agent must show and obtain explicit confirmation for:

- The exact game title and version.
- The target site.
- Public or unlisted visibility.
- Whether source downloading is allowed.

Only then authorize publication on the disposable site. Verify the resulting play URL, visibility, and source-download setting.

## Replacement workflow

Modify the local game and request an update to the existing uploaded game. Verify that the agent:

- Validates and tests the replacement first.
- Identifies the existing game rather than creating a duplicate.
- Warns that upload replaces the current version immediately while preserving visibility and settings.
- Obtains confirmation before targeting the existing game ID.
- Keeps the same game ID and play URL after replacement.
- Verifies the updated live page when the game is already public or unlisted.

## Evidence

Record enough evidence to reproduce the result:

- Agent product and version.
- Skill and CLI artifact versions or hashes.
- The exact test request.
- Commands and exit statuses.
- Output paths and package validation results.
- Browser observations and tested viewports.
- The resulting visibility and source-download setting for site workflows.

Do not record credentials, private tokens, passwords, or signed asset URLs. Distinguish direct execution and browser observations from actions the agent merely described.
