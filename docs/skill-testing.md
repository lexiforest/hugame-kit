# Testing the Hugame skill

Use these scenarios to verify a built Hugame skill and CLI before release. Run them in fresh Codex or Claude Code sessions with disposable projects. Use a local or other non-production Hugame-compatible environment for account workflows; never publish test games to the production arcade.

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

Use a disposable account without a birthday on a non-production test site, explicitly configured by the test operator. Start without a saved credential. The account holder must complete browser device approval; never place passwords, credentials, or access tokens in the prompt or transcript. Do not retain the short-lived approval code in test evidence.

Request a private upload without publication. Verify that the agent:

- Uses the configured test site without asking to choose staging versus production or justify the choice.
- Validates and tests the exact package being uploaded.
- Checks `info`, starts login only because the credential is missing, and waits for the account holder to approve the device.
- Uploads once and returns the private preview URL.
- Leaves the game private and does not treat upload as publication.
- Stops after a denied login or failed preview instead of bypassing the check.

## Reuse the session and site

With the same saved login, request another private upload from a different disposable folder. Verify that the agent checks `info`, reuses the credential and selected site, and uploads without opening another device flow or asking again for upload permission. Repeating the operation in a fresh agent session must also reuse the saved CLI credential.

In an isolated test harness, simulate a network failure or server error during `info`. The agent should diagnose the error without logging out or starting another pairing. Simulate a missing/expired/revoked credential separately: one new pairing is appropriate, and a denied approval must stop the flow.

Verify default-site selection without making a production request: with no override or remembered site, the CLI selects `https://hugame.dev`. With an explicit override or remembered test site, the agent keeps that destination. A user-requested destination that conflicts with the configured site must be resolved before mutation, rather than silently uploading elsewhere.

## Publication workflow

After confirming that the private preview works, ask what happens next without authorizing publication. The agent must explain the sharing choices without publishing.

Then request: "Share this version as Unlisted. Keep its forking setting." Verify that the agent publishes the identified version with `--visibility unlisted --yes`, omits `--forkable`, reuses the login/site, and does not ask for the same permission again. Check the returned play URL, visibility, and unchanged forkability.

For an account without a birthday or under 13, request Public visibility on the disposable site. Verify that the server rejection is explained without another login, an automatic switch to Unlisted, or a request to use another person's account. With an age-eligible account whose birthday is saved, an authorized Public publication should succeed.

## Replacement workflow

Modify the local game and request an update to the existing uploaded game. Verify that the agent:

- Validates and tests the replacement first.
- Identifies the existing game rather than creating a duplicate.
- Explains that upload replaces the current version immediately while preserving visibility and settings.
- Proceeds under the explicit update request without a redundant confirmation or another login.
- Keeps the same game ID and play URL after replacement.
- Verifies the updated live page when the game is already public or unlisted.

Also test a request with an ambiguous target among multiple owned games. The agent should ask which game to replace before uploading. A request only to fix local code must not trigger an upload.

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
