import type { UsageLimitsReport } from "@t3tools/contracts";
import { remainingPercent } from "@t3tools/shared/usageLimits";
import { Button } from "../ui/button";
import { type ContextWindowSnapshot, formatContextWindowTokens } from "~/lib/contextWindow";
import { Popover, PopoverPopup, PopoverTrigger } from "../ui/popover";
import { LimitWindows } from "../usage/UsageLimits";
import { formatContextWindowCompactionMessage } from "./ContextWindowMeter.logic";
import { Minimize2Icon } from "lucide-react";
import { composerFloatingLayerProps } from "./composerEventScope";

function formatPercentage(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  if (value < 10) {
    return `${value.toFixed(1).replace(/\.0$/, "")}%`;
  }
  return `${Math.round(value)}%`;
}

export function ContextWindowMeter(props: {
  usage: ContextWindowSnapshot;
  usageLimits?: UsageLimitsReport | null;
  modelDisplayName?: string | null;
  onCompact?: (() => void) | undefined;
  compactDisabled?: boolean | undefined;
  compactDisabledReason?: string | null | undefined;
}) {
  const {
    usage,
    usageLimits = null,
    modelDisplayName,
    onCompact,
    compactDisabled,
    compactDisabledReason,
  } = props;
  const usedPercentage = formatPercentage(usage.usedPercentage);
  const normalizedPercentage = Math.max(0, Math.min(100, usage.usedPercentage ?? 0));
  const radius = 9.75;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - normalizedPercentage / 100);
  const totalProcessedTokens = usage.totalProcessedTokens ?? null;
  const showTotalProcessed = totalProcessedTokens !== null && totalProcessedTokens > 0;
  const isOverloaded = normalizedPercentage > 90;
  const usageColor = isOverloaded
    ? "var(--color-error)"
    : "color-mix(in oklab, var(--color-muted-foreground) 72%, transparent)";
  const primaryLimits = usageLimits?.accounts[0]?.limits.windows ?? [];
  const visibleLimits = [
    primaryLimits.find((window) => window.kind === "session"),
    primaryLimits.find((window) => window.kind === "weekly"),
  ].filter((window) => window !== undefined);
  const latestTurnTokens =
    usage.lastUsedTokens ??
    (usage.lastInputTokens ?? 0) +
      (usage.lastOutputTokens ?? 0) +
      (usage.lastReasoningOutputTokens ?? 0);

  return (
    <Popover>
      <PopoverTrigger
        openOnHover
        delay={150}
        closeDelay={onCompact ? 150 : 0}
        render={
          <Button
            size="sm"
            variant="ghost-muted"
            className="h-7 gap-1.5 rounded-full px-1.5 font-normal hover:text-muted-foreground data-pressed:text-muted-foreground"
            aria-label={
              usage.maxTokens !== null && usedPercentage
                ? `Context window ${usedPercentage} used`
                : `Context window ${formatContextWindowTokens(usage.usedTokens)} tokens used`
            }
          >
            <span className="relative flex size-5 items-center justify-center">
              <svg
                viewBox="0 0 24 24"
                className="-rotate-90 absolute inset-0 size-full transform-gpu mx-0!"
                aria-hidden="true"
              >
                <circle
                  cx="12"
                  cy="12"
                  r={radius}
                  fill="none"
                  stroke="color-mix(in oklab, var(--color-muted-foreground) 24%, transparent)"
                  strokeWidth="3"
                />
                <circle
                  cx="12"
                  cy="12"
                  r={radius}
                  fill="none"
                  stroke={usageColor}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                  className="transition-[stroke-dashoffset,stroke] duration-500 ease-out motion-reduce:transition-none"
                />
              </svg>
            </span>
            <span className="text-[10px] tabular-nums">
              Ctx {usedPercentage ?? formatContextWindowTokens(usage.usedTokens)}
            </span>
            {latestTurnTokens > 0 ? (
              <span className="text-[10px] text-secondary-label tabular-nums">
                Msg {formatContextWindowTokens(latestTurnTokens)}
              </span>
            ) : null}
            {visibleLimits.map((window) => (
              <span key={`${window.kind}:${window.id}`} className="text-[10px] tabular-nums">
                {window.kind === "session" ? "5h" : "Wk"} {remainingPercent(window)}%
              </span>
            ))}
          </Button>
        }
      />
      <PopoverPopup
        {...composerFloatingLayerProps}
        tooltipStyle
        side="top"
        align="end"
        viewportClassName="p-0"
        className="w-80 max-w-none text-left whitespace-normal"
      >
        <div className="flex flex-col gap-2 p-[var(--floating-content-inset)]">
          <div className="flex items-center justify-between gap-3">
            <div className="font-medium text-muted-foreground text-xs">Context Window</div>
            {usage.maxTokens !== null && usedPercentage ? (
              <div className="text-secondary-label text-[11px] tabular-nums">
                <span>{usedPercentage}</span>
                <span className="mx-1">·</span>
                <span>
                  {formatContextWindowTokens(usage.usedTokens)}/
                  {formatContextWindowTokens(usage.maxTokens ?? null)}
                </span>
              </div>
            ) : (
              <div className="text-secondary-label text-[11px] tabular-nums">
                {formatContextWindowTokens(usage.usedTokens)}
              </div>
            )}
          </div>
          {usage.maxTokens !== null ? (
            <div
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted/60"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(normalizedPercentage)}
              aria-label="Context window usage"
            >
              <div
                className="h-full rounded-full transition-[width,background-color] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${normalizedPercentage}%`, backgroundColor: usageColor }}
              />
            </div>
          ) : null}
          {showTotalProcessed ? (
            <div className="flex items-center justify-between gap-3 text-[11px] leading-4">
              <span className="text-secondary-label">Total processed</span>
              <span className="font-medium tabular-nums text-secondary-label">
                {formatContextWindowTokens(totalProcessedTokens)}
              </span>
            </div>
          ) : null}
          {latestTurnTokens > 0 ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border/60 pt-2 text-[11px] leading-4">
              <span className="col-span-2 font-medium text-muted-foreground">Latest message</span>
              <span className="text-secondary-label">Total</span>
              <span className="text-right font-medium tabular-nums text-secondary-label">
                {formatContextWindowTokens(latestTurnTokens)}
              </span>
              <span className="text-secondary-label">Input / cached</span>
              <span className="text-right font-medium tabular-nums text-secondary-label">
                {formatContextWindowTokens(usage.lastInputTokens ?? null)}/
                {formatContextWindowTokens(usage.lastCachedInputTokens ?? null)}
              </span>
              <span className="text-secondary-label">Output / reasoning</span>
              <span className="text-right font-medium tabular-nums text-secondary-label">
                {formatContextWindowTokens(usage.lastOutputTokens ?? null)}/
                {formatContextWindowTokens(usage.lastReasoningOutputTokens ?? null)}
              </span>
            </div>
          ) : null}
          {usageLimits && (usageLimits.accounts.length > 0 || usageLimits.notices.length > 0) ? (
            <div className="flex flex-col gap-2 border-t border-border/60 pt-2">
              <span className="font-medium text-muted-foreground text-xs">Provider limits</span>
              {usageLimits.accounts.map((account) => (
                <div key={account.id} className="flex min-w-0 flex-col gap-1">
                  {usageLimits.accounts.length > 1 ? (
                    <span className="truncate text-[11px] text-secondary-label">
                      {account.displayName?.trim() || account.label}
                    </span>
                  ) : null}
                  <LimitWindows
                    compact
                    driver={account.driver}
                    windows={account.limits.windows}
                    now={Date.parse(usageLimits.createdAt)}
                  />
                </div>
              ))}
              {usageLimits.notices.map((notice) => (
                <span key={notice} className="text-[11px] text-secondary-label">
                  {notice}
                </span>
              ))}
            </div>
          ) : null}
          {usage.compactsAutomatically ? (
            <div className="mt-1 text-pretty text-secondary-label text-[11px] font-medium">
              {formatContextWindowCompactionMessage(modelDisplayName, usage.autoCompactThreshold)}
            </div>
          ) : null}
          {onCompact ? (
            <>
              <Button
                size="xs"
                variant="outline"
                className="mt-1 w-full justify-center"
                disabled={compactDisabled}
                onClick={onCompact}
              >
                <Minimize2Icon aria-hidden="true" />
                Compact context
              </Button>
              {compactDisabled && compactDisabledReason ? (
                <div className="text-pretty text-secondary-label text-[11px]">
                  {compactDisabledReason}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </PopoverPopup>
    </Popover>
  );
}

/** Holds the meter's footprint while a thread's activities are still loading. */
export function ContextWindowMeterPlaceholder() {
  return <span aria-hidden="true" className="size-7 shrink-0" />;
}
