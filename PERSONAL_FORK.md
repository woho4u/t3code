# Oliver's T3 Code fork

This branch is the source for the everyday Windows app. It deliberately keeps T3 Code's existing
Windows application identity, so installing a personal build replaces the stock app and continues
using the same T3 user data. Update metadata points to `woho4u/t3code`, never the upstream release
feed.

## Daily customization loop

1. Open this repository as a project in T3 Code.
2. Make and test a change in a new session.
3. Commit the change on `custom/oliver`.
4. Run `powershell -ExecutionPolicy Bypass -File .\scripts\personal-app.ps1 install`.
5. Complete the installer, then reopen T3 Code.

Use `personal-app.ps1 build` when you only want an installer, and `personal-app.ps1 dev` for an
isolated desktop development instance. Development state lives under `.t3/personal-desktop-dev` and
never touches the installed app's data.

The build helper currently reuses the stock app's bundled Rust resource monitor because this PC's
Visual Studio installation does not include the optional Spectre libraries. This does not affect web,
desktop, agent, terminal, or telemetry customizations. Install that Visual Studio component before
editing `native/resource-monitor`, then remove the reuse block from the helper.

## Pulling upstream changes

With a clean worktree, run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\personal-app.ps1 sync
```

This fetches `pingdotgg/t3code` through the `upstream` remote and performs a normal Git merge into
`custom/oliver`. Resolve conflicts like any other long-lived fork, run the focused checks for the
affected code, commit the merge if Git did not create the commit automatically, then rebuild.

## Current customization

The composer telemetry is on by default. Its always-visible row reports context use, latest-message
tokens, and the Codex five-hour and weekly quota remaining. Hover or click it for input, cache,
output, reasoning, reset timing, and full limit bars.
