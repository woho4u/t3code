import { GaugeIcon } from "lucide-react";

import type { ServerProviderUsageLimits } from "@t3tools/contracts";
import { formatResetsIn, remainingPercent } from "@t3tools/shared/usageLimits";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

const KIND_LETTER: Record<ServerProviderUsageLimits["windows"][number]["kind"], string> = {
  session: "S",
  weekly: "W",
  monthly: "M",
  other: "•",
};

/**
 * The selected provider's subscription limits as one compact control in the
 * composer footer, left of the send button. Shows the remaining share of each
 * window; clicking opens the full usage-limits panel the /usage-limits
 * command uses, so both views read the same snapshot.
 */
export function ComposerUsageLimitsInline({
  limits,
  now,
  onOpen,
}: {
  readonly limits: ServerProviderUsageLimits;
  readonly now: number;
  readonly onOpen: () => void;
}) {
  const windows = limits.windows;
  if (windows.length === 0) return null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onPointerDown={(event) => event.preventDefault()}
            onClick={onOpen}
            data-chat-composer-usage-limits="true"
            aria-label="Show usage limits"
            className="flex shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground tabular-nums transition-colors hover:bg-background/60 hover:text-foreground"
          >
            <GaugeIcon className="size-3.5 shrink-0" />
            <span className="flex items-center gap-1.5">
              {windows.map((window) => (
                <span key={window.id} className="whitespace-nowrap">
                  {KIND_LETTER[window.kind]}
                  {remainingPercent(window)}%
                </span>
              ))}
            </span>
          </button>
        }
      />
      <TooltipPopup side="top" className="max-w-72 text-xs">
        <div className="flex flex-col gap-0.5">
          {windows.map((window) => {
            const resetsIn = formatResetsIn(window, now);
            return (
              <span key={window.id} className="text-muted-foreground">
                {window.label} {remainingPercent(window)}% left
                {resetsIn ? ` · ${resetsIn}` : ""}
              </span>
            );
          })}
        </div>
      </TooltipPopup>
    </Tooltip>
  );
}
