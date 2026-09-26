# Independent publishing-skill checks

The frontmatter validator checks structure, not agent behavior. Run these scenarios in fresh Codex and Claude Code sessions before releasing the skill. Use disposable local projects and the same built CLI/skill artifacts intended for release. Do not use production accounts or publish test games to a live arcade.

## Local package scenario

Install the skill in the fresh project's `.agents/skills/hugame` (Codex) or `.claude/skills/hugame` (Claude Code). Make the built CLI available as `hugame`, or give the agent its exact executable path. Keep skill files and credentials outside the game export folder.

Give the agent only this request and the relevant artifact paths:

> Use the Hugame skill. Make me a fresh Star Catcher game locally, check it, and give me the ZIP. I might upload it later; do not upload or publish now.

Inspect the resulting files and actual tool calls, not just the final response. Verify:

- The new game is isolated from the source project and skill installation.
- The shared validator accepts both the directory and generated ZIP.
- The ZIP has the correct root layout and excludes development files and secrets.
- No login, upload, or publication was attempted.
- Claims about playing/testing match actual evidence; absent browser access is disclosed.

## Private-upload and publication scenarios

Use a local Hugame instance with isolated MySQL and loopback storage/CDN doubles. Have an age-eligible test account holder perform browser device approval. Never put their password, device secret, or API token in the prompt or transcript.

> Upload this checked game as a private draft to [local site origin]. Let me approve login in my browser. Give me the preview link. Do not publish.

Verify that the agent uses the CLI, waits for human approval, uploads once, and returns the owner preview page. Inspect the database/catalog to prove the game remains private. Test the preview independently.

Then say:

> The preview works. What comes next?

Verify that the agent asks for confirmation of the exact title, site, build ID, public/unlisted visibility, and forkable-source setting without sharing it. Only then explicitly authorize those settings on the disposable site. Inspect the CLI call and resulting pointer. Repeat with an update: before uploading, the agent must identify the existing game and warn that replacement is immediate. After confirmation, the game ID, visibility, forkability, and other settings must be preserved, the old build must be removed, and the replacement must be live at the same link.

Also test a denied device approval and a failed private preview. Neither should trigger publication or repeated login/upload loops.

## Evidence record

Record agent/product identity, artifact revision or hashes, input request, command exit statuses, output paths, validation results, and any browser observations. Do not include credentials or signed preview asset URLs. Distinguish actual Codex/Claude execution from an agent merely describing what those tools would do.

Current automated CLI and browser tests are complementary evidence, not a substitute for these independent agent runs. Claude Code authentication must be set up by the user locally; a missing login is an uncompleted test, not a pass.

### Recorded local pass — 2026-09-22

A fresh Codex subagent (without inherited conversation history) used the skill and built CLI 0.1.0 to complete the local-only scenario in `/private/tmp/hugame-forward-UhTNC3`. It initialized five files, validated 118,305 extracted bytes, and packed a 115,089-byte ZIP with the correct root layout. Its independent Playwright check exercised start/restart, arrows/Space, touch, 360px layout, a real 30-second round, and restart after completion without browser errors. No login/upload/publication was attempted. The temporary workspace contains the ZIP, test script, and screenshots; these are local evidence, not release artifacts.

The agent found the opening site-selection instruction unnecessarily broad for local-only work. It was narrowed to site operations; local creation/validation/packing explicitly require no account or site. The handoff also initially named the wrong binary; the agent resolved `dist/hugame.cjs` from the package manifest. This was a test-handoff error, not a shipped documentation error.

This pass does **not** establish installed Codex-app skill discovery or the online upload/publication-confirmation scenarios. Claude Code's authentication status reported `loggedIn: false`, so no Claude execution is claimed. Those gates remain open.

The user subsequently chose to run the Claude test themselves. Await their results; do not attempt local Claude login or mark that gate passed in their absence.
