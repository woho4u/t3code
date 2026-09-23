// @effect-diagnostics nodeBuiltinImport:off
import * as NodeFSP from "node:fs/promises";
import * as NodeOS from "node:os";
import * as NodePath from "node:path";
import { describe, expect, it } from "vite-plus/test";

import {
  fetchOpenCodeZenUsage,
  openCodeAuthPath,
  openCodeZenUsageToLimits,
  probeOpenCodeUsageLimits,
  readOpenCodeGoKey,
} from "./opencodeUsageLimits.ts";

const checkedAt = "2026-07-18T10:00:00.000Z";

function zenResponse(overrides: {
  rolling?: Record<string, unknown> | null;
  weekly?: Record<string, unknown> | null;
  monthly?: Record<string, unknown> | null;
}) {
  return {
    usage: {
      rolling: { percent: 2, resetsAt: "2026-07-18T14:00:00.000Z", ...overrides.rolling },
      weekly: { percent: 11, resetsAt: "2026-07-20T00:00:00.000Z", ...overrides.weekly },
      monthly: { percent: 55, resetsAt: "2026-08-01T00:00:00.000Z", ...overrides.monthly },
    },
  };
}

async function withAuthHome(
  run: (environment: NodeJS.ProcessEnv) => Promise<void>,
  auth?: string,
): Promise<void> {
  const dir = await NodeFSP.mkdtemp(NodePath.join(NodeOS.tmpdir(), "opencode-auth-"));
  try {
    if (auth !== undefined) {
      await NodeFSP.mkdir(NodePath.join(dir, "opencode"), { recursive: true });
      await NodeFSP.writeFile(NodePath.join(dir, "opencode", "auth.json"), auth, "utf8");
    }
    await run({ XDG_DATA_HOME: dir });
  } finally {
    await NodeFSP.rm(dir, { recursive: true, force: true });
  }
}

describe("openCodeZenUsageToLimits", () => {
  it("maps rolling, weekly, and monthly onto the session, weekly, and monthly windows", () => {
    expect(openCodeZenUsageToLimits({ response: zenResponse({}), checkedAt })).toEqual({
      checkedAt,
      windows: [
        {
          id: "rolling",
          kind: "session",
          label: "Session",
          usedPercent: 2,
          windowDurationMins: 300,
          resetsAt: "2026-07-18T14:00:00.000Z",
        },
        {
          id: "weekly",
          kind: "weekly",
          label: "Weekly",
          usedPercent: 11,
          windowDurationMins: 10_080,
          resetsAt: "2026-07-20T00:00:00.000Z",
        },
        {
          id: "monthly",
          kind: "monthly",
          label: "Monthly",
          usedPercent: 55,
          windowDurationMins: 43_200,
          resetsAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    });
  });

  it("skips windows whose percent is missing or non-numeric", () => {
    const limits = openCodeZenUsageToLimits({
      response: zenResponse({ rolling: { percent: null }, weekly: { percent: "11" } }),
      checkedAt,
    });
    expect(limits.windows.map((window) => window.id)).toEqual(["monthly"]);
  });

  it("clamps out-of-range percents and drops invalid reset times", () => {
    const limits = openCodeZenUsageToLimits({
      response: zenResponse({
        rolling: { percent: 140, resetsAt: "not-a-date" },
        weekly: { percent: -5 },
      }),
      checkedAt,
    });
    expect(limits.windows[0]).toMatchObject({ id: "rolling", usedPercent: 100 });
    expect(limits.windows[0]).not.toHaveProperty("resetsAt");
    expect(limits.windows[1]).toMatchObject({ id: "weekly", usedPercent: 0 });
  });

  it("marks an account with no usable windows as unsupported", () => {
    const limits = openCodeZenUsageToLimits({ response: { usage: null }, checkedAt });
    expect(limits.windows).toEqual([]);
    expect(limits.unavailable).toEqual({
      reason: "unsupported",
      message: "OpenCode reported no subscription usage windows.",
    });
  });
});

describe("readOpenCodeGoKey", () => {
  it("reads the opencode-go key from auth.json", async () => {
    await withAuthHome(
      async (environment) => {
        expect(await readOpenCodeGoKey(environment)).toBe("zen-key");
      },
      JSON.stringify({ "opencode-go": { type: "api", key: "zen-key" } }),
    );
  });

  it("returns undefined when auth.json is missing or has no opencode-go entry", async () => {
    await withAuthHome(async (environment) => {
      expect(await readOpenCodeGoKey(environment)).toBeUndefined();
    });
    await withAuthHome(
      async (environment) => {
        expect(await readOpenCodeGoKey(environment)).toBeUndefined();
      },
      JSON.stringify({ anthropic: { type: "oauth", key: "other" } }),
    );
  });
});

describe("openCodeAuthPath", () => {
  it("honors XDG_DATA_HOME and defaults to ~/.local/share", () => {
    expect(openCodeAuthPath({ XDG_DATA_HOME: "/data" })).toBe(
      NodePath.join("/data", "opencode", "auth.json"),
    );
    expect(openCodeAuthPath({})).toBe(
      NodePath.join(NodeOS.homedir(), ".local", "share", "opencode", "auth.json"),
    );
  });
});

describe("probeOpenCodeUsageLimits", () => {
  it("returns undefined when there is no opencode-go auth entry", async () => {
    await withAuthHome(async (environment) => {
      expect(
        await probeOpenCodeUsageLimits({
          checkedAt,
          environment,
          fetchImpl: (() => {
            throw new Error("fetch must not be called");
          }) as unknown as typeof fetch,
        }),
      ).toBeUndefined();
    });
  });

  it("returns probeFailed limits when the usage read fails", async () => {
    await withAuthHome(
      async (environment) => {
        const limits = await probeOpenCodeUsageLimits({
          checkedAt,
          environment,
          fetchImpl: (async () => {
            throw new Error("network down");
          }) as unknown as typeof fetch,
        });
        expect(limits?.unavailable).toMatchObject({ reason: "probeFailed" });
        expect(limits?.unavailable?.message).toContain("network down");
      },
      JSON.stringify({ "opencode-go": { key: "zen-key" } }),
    );
  });

  it("returns mapped windows on a successful read", async () => {
    await withAuthHome(
      async (environment) => {
        const limits = await probeOpenCodeUsageLimits({
          checkedAt,
          environment,
          fetchImpl: (async () =>
            new Response(JSON.stringify(zenResponse({})), {
              status: 200,
            })) as unknown as typeof fetch,
        });
        expect(limits?.windows.map((window) => window.id)).toEqual([
          "rolling",
          "weekly",
          "monthly",
        ]);
      },
      JSON.stringify({ "opencode-go": { key: "zen-key" } }),
    );
  });
});

describe("fetchOpenCodeZenUsage", () => {
  it("throws a bounded message on HTTP failures and never sends the key in errors", async () => {
    const failure = await fetchOpenCodeZenUsage(
      "zen-key",
      (async () => new Response("no", { status: 401 })) as unknown as typeof fetch,
    ).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).not.toContain("zen-key");
    expect((failure as Error).message).toContain("401");
  });
});
