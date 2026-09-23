# T3 Code personal source workspace

This is the owner's working copy of the official T3 Code source
(`pingdotgg/t3code`), maintained as a personal fork build with local tweaks.
Any agent session opening this folder follows this file.

## Read order

1. `STATE.md` — current tweaks, last official sync, next action.
2. This file — operating rules only.

## Branch model (mechanically enforced by git hooks)

- `main` = mirror of official. **Never commit to it, never push it anywhere.**
- `personal` = `main` + owner tweaks. Every tweak is exactly one commit with a
  conventional message (`feat|fix|chore|docs|test|refactor|perf(scope): ...`,
  subject ≤ 72 chars). Work only on `personal`; if you find yourself on
  `main`, switch first.
- No force-pushes, ever.

## Remotes

- `origin` = `woho4u/t3code` (owner's fork; backup of `personal`; no releases;
  the installed desktop app watches it for updates).
- `upstream` = `pingdotgg/t3code` (official; the source of updates; **never
  pushed to**).

## Updating from official (the ritual)

1. `git fetch upstream`
2. On `personal`: `git rebase upstream/main`
3. Resolve conflicts. Tweaks are small, so conflicts only happen where upstream
   touched the same files. After resolving, verify:
   - `pnpm exec tsc --noEmit` in `apps/server` and `apps/web`
   - affected tests: `pnpm exec vp test run <paths>`
4. Push `personal` to `origin` (owner's backup).
5. Build the Windows installer (below), confirm with the owner, install.
6. Update `STATE.md` (new sync commit + date).

## Adding a tweak

1. Confirm the change with the owner in one sentence before coding.
2. One commit on `personal`.
3. Preview fast: `pnpm dev` (server `127.0.0.1:13773`, web `localhost:5733`;
   pairing via `node apps/server/src/bin.ts pair` — temporarily move
   `~/.t3/userdata/server-runtime.json` aside so pairing targets the dev server,
   restore it right after).
4. Verify (typecheck + affected tests) before the tweak counts as done.

## Building and installing

- `pnpm dist:desktop:win` produces the NSIS installer (last output path in
  `STATE.md`).
- Installing overwrites `AppData\Local\Programs\t3code`. Owner data lives in
  `~/.t3/userdata` (outside the app) and survives reinstalls.
- **Silent update ritual (default)**: after building, arm the updater detached:
  `Start-Process powershell -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File','<root>\Automation\t3code-apply-update\apply-update.ps1' -WindowStyle Hidden`
  (newest installer in `release\` used by default; pass `-InstallerPath` to
  pin one). The updater waits for T3 Code to exit, installs with `/S`, and
  relaunches the app. The owner's only action is closing T3 Code; agent
  sessions running inside the app end with it.
- A plain manual run of the installer still works whenever the owner prefers.

## Never

- Commit to or push `main`; force-push; push to `upstream`.
- Commit `node_modules/`, build output, `.t3` state, or secrets.
- Edit files under `~/.t3/userdata` (the daily app's state) except settings the
  owner explicitly asked to change.
