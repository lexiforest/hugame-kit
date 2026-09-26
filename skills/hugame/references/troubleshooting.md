# Fixing upload problems

Keep the full error's file path and code when diagnosing. Change the game package, not the platform's validation or security policy.

| Problem                             | Next action                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Missing index.html or manifest      | Export the game, then upload the folder whose root contains both files.                                                  |
| Missing or invalid cover            | Use one PNG or WebP cover, 16:10 and at least 640×400, no more than 2 MiB. Renaming a JPEG does not convert it.          |
| External URL or network API         | Download permitted assets at build time and bundle them; remove runtime requests.                                        |
| Missing local asset                 | Match the filename's exact case and use a relative path from the referencing file.                                       |
| Unsupported or hidden file          | Keep build configs, .git, node_modules, secrets, and source-only files outside the export folder.                        |
| ZIP too large                       | Compress images/audio and remove unused assets; do not split a game into remote downloads.                               |
| Login pending                       | Leave the CLI running while the account holder approves the displayed code in the browser.                               |
| Expired or denied login             | Stop. Let the account holder decide whether to start a new login.                                                        |
| Wrong account or missing scope      | Check `npx hugame whoami`; reconnect through the browser with the intended account. Never borrow another person's token. |
| Upload interrupted                  | Retry the unchanged folder once. If it still fails, inspect the error and owned games before creating another upload.    |
| Works locally, fails in preview     | Inspect browser errors for blocked network calls, storage access, absolute paths, and missing bundled files.             |
| Replacement is not on the play page | Confirm the existing game ID was used, then reload the play page. A successful replacement keeps the same play link.   |

Use the web uploader as a fallback when the CLI is not installed. It follows the same rule: a new game starts private, while an existing game's version is replaced in place. Never describe a new draft as published or verified unless that action actually succeeded. See [CLI commands and no-CLI workflows](commands.md) for command-specific alternatives.
