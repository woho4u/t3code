/**
 * OpenCode Go subscription usage. OpenCode's CLI keeps provider auth in
 * `auth.json` under its data directory; the `opencode-go` entry carries the
 * API key for the Zen subscription, whose usage endpoint reports the
 * rolling (five-hour), weekly, and monthly windows for the account.
 *
 * The read is a plain authenticated fetch — unlike Codex there is no
 * streaming notification to merge, so the probe supplies the full snapshot
 * each time it runs and turn-time updates are unnecessary.
 *
 * @module provider/Layers/opencodeUsageLimits
 */
import type { ServerProviderUsageLimits, ServerProviderUsageWindow } from "@t3tools/contracts";
import * as DateTime from "effect/DateTime";
import * as Option from "effect/Option";

// @effect-diagnostics-next-line nodeBuiltinImport:off - the probe is a plain async helper, so it cannot use the FileSystem service.
import * as NodeFSP from "node:fs/promises";
// @effect-diagnostics-next-line nodeBuiltinImport:off - pure sync helpers, so they cannot use the Path service.
import os from "node:os";
// @effect-diagnostics-next-line nodeBuiltinImport:off - pure sync helpers, so they cannot use the Path service.
import path from "node:path";

import {
  clampPercent,
  makeUnavailableUsageLimits,
  makeUsageLimits,
} from "../providerUsageLimits.ts";

const ZEN_USAGE_URL = "https://opencode.ai/zen/go/v1/usage";
const USAGE_FETCH_TIMEOUT_MS = 10_000;

const ROLLING_MINS = 5 * 60;
const WEEK_MINS = 7 * 24 * 60;
const MONTH_MINS = 30 * 24 * 60;

interface OpenCodeZenWindow {
  readonly percent?: number | null;
  readonly resetsAt?: string | null;
  readonly status?: string | null;
}

/** Structural view of the `zen/go/v1/usage` response body. */
export interface OpenCodeZenUsageResponse {
  readonly usage?: {
    readonly rolling?: OpenCodeZenWindow | null;
    readonly weekly?: OpenCodeZenWindow | null;
    readonly monthly?: OpenCodeZenWindow | null;
  } | null;
}

/**
 * OpenCode resolves its data directory the same way across platforms:
 * `XDG_DATA_HOME` when set, otherwise `~/.local/share`.
 */
export function openCodeAuthPath(environment: NodeJS.ProcessEnv = process.env): string {
  const dataHome = environment.XDG_DATA_HOME?.trim() || path.join(os.homedir(), ".local", "share");
  return path.join(dataHome, "opencode", "auth.json");
}

/** The Zen subscription key, or undefined when the file is absent or has no such entry. */
export async function readOpenCodeGoKey(
  environment: NodeJS.ProcessEnv = process.env,
): Promise<string | undefined> {
  let raw: string;
  try {
    raw = await NodeFSP.readFile(openCodeAuthPath(environment), "utf8");
  } catch {
    return undefined;
  }
  let auth: unknown;
  try {
    auth = JSON.parse(raw);
  } catch {
    return undefined;
  }
  const entry = (auth as Record<string, unknown> | null)?.["opencode-go"];
  const key =
    typeof entry === "object" && entry !== null
      ? (entry as Record<string, unknown>)["key"]
      : undefined;
  return typeof key === "string" && key.trim().length > 0 ? key.trim() : undefined;
}

export async function fetchOpenCodeZenUsage(
  key: string,
  fetchImpl: typeof fetch = fetch,
): Promise<unknown> {
  const response = await fetchImpl(ZEN_USAGE_URL, {
    headers: { Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(USAGE_FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`the usage request failed with HTTP ${response.status}`);
  }
  return (await response.json()) as unknown;
}

function normalizeIso(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  const dt = DateTime.make(value);
  return Option.isSome(dt) ? DateTime.formatIso(dt.value) : undefined;
}

function zenWindowToContract(
  id: string,
  window: OpenCodeZenWindow | null | undefined,
  kind: ServerProviderUsageWindow["kind"],
  label: string,
  windowDurationMins: number,
): ServerProviderUsageWindow | undefined {
  if (!window || typeof window.percent !== "number" || !Number.isFinite(window.percent)) {
    return undefined;
  }
  const resetsAt = normalizeIso(window.resetsAt);
  return {
    id,
    kind,
    label,
    usedPercent: clampPercent(window.percent),
    windowDurationMins,
    ...(resetsAt ? { resetsAt } : {}),
  };
}

/**
 * Map the usage response onto the shared window contract. Windows whose
 * percent is missing or non-numeric are skipped; an empty result means the
 * account has nothing to report (treated as unsupported rather than
 * probeFailed, so a working read of an empty account is not an error).
 */
export function openCodeZenUsageToLimits(input: {
  readonly response: unknown;
  readonly checkedAt: string;
}): ServerProviderUsageLimits {
  const usage = (input.response as OpenCodeZenUsageResponse | null | undefined)?.usage;
  const windows = [
    zenWindowToContract("rolling", usage?.rolling, "session", "Session", ROLLING_MINS),
    zenWindowToContract("weekly", usage?.weekly, "weekly", "Weekly", WEEK_MINS),
    zenWindowToContract("monthly", usage?.monthly, "monthly", "Monthly", MONTH_MINS),
  ].filter((window): window is ServerProviderUsageWindow => window !== undefined);
  if (windows.length === 0) {
    return makeUnavailableUsageLimits({
      checkedAt: input.checkedAt,
      reason: "unsupported",
      message: "OpenCode reported no subscription usage windows.",
    });
  }
  return makeUsageLimits({ checkedAt: input.checkedAt, windows });
}

/**
 * Probe-side aggregate used by the OpenCode status check. A machine without
 * an `opencode-go` auth entry has no limits row at all (undefined), and a
 * failed read keeps the last good bars via `probeFailed`.
 */
export async function probeOpenCodeUsageLimits(input: {
  readonly checkedAt: string;
  readonly environment?: NodeJS.ProcessEnv;
  readonly fetchImpl?: typeof fetch;
}): Promise<ServerProviderUsageLimits | undefined> {
  const key = await readOpenCodeGoKey(input.environment);
  if (!key) return undefined;
  try {
    const response = await fetchOpenCodeZenUsage(key, input.fetchImpl);
    return openCodeZenUsageToLimits({ response, checkedAt: input.checkedAt });
  } catch (cause) {
    return makeUnavailableUsageLimits({
      checkedAt: input.checkedAt,
      reason: "probeFailed",
      message: `Could not read OpenCode usage: ${
        cause instanceof Error ? cause.message : "unknown error"
      }`,
    });
  }
}
