# State

## What this is

Personal T3 Code source for Oliver: official code + owner tweaks, built and
installed locally. Working branch is `personal`; `main` mirrors upstream. Full
rules: `AGENTS.md`.

## Current tweaks (personal branch, on top of upstream main `6e5e986f`, 2026-09-13)

1. `e49dacfc` feat(server): OpenCode Go usage limits from the Zen usage endpoint
   - `apps/server/src/provider/Layers/opencodeUsageLimits.ts`: reads the
     `opencode-go` key from opencode's `auth.json` (XDG_DATA_HOME-aware), fetches
     `zen/go/v1/usage`, maps rolling/weekly/monthly onto the shared window
     contract. Wired into `checkOpenCodeProviderStatus`. No key on the machine →
     no limits row; failed read → `probeFailed` (keeps last good bars).
   - Tests: `apps/server/src/provider/Layers/opencodeUsageLimits.test.ts` (11).
2. `77264140` feat(web): inline usage-limits chip in the composer footer
   - `apps/web/src/components/chat/ComposerUsageLimitsInline.tsx`; wired through
     a `activeProviderUsageLimits` prop from ChatView into ChatComposer, rendered
     left of the attach/send buttons (expanded footer only). Click opens the
     same usage-limits panel the `/usage-limits` command uses.
   - Works for any provider publishing windows (codex, opencode, claude).

## Last sync / build

- Official sync point: upstream `main` `6e5e986f` (2026-09-13) — the same commit
  the installed `0.0.41-personal.20260913.2046` app was built from.
- Installer builds: pending (first build this session; path recorded here when built).

## Unresolved

- None recorded.

## Next action

- Build the installer, owner installs over the current app.
