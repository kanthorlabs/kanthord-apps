import { ChevronRightIcon } from "lucide-react";
import { type ReactNode, useId } from "react";

import { RevealPanel } from "@/components/reveal";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import type { WorkbenchGuardRecord } from "@/api/types";
import { guardRecordLineOf } from "@/lib/guard-line";
import { summaryOf, type ToolCallResult } from "@/lib/workbench-chat";
import { InlineError } from "./inline-error";
import { ToolDetail } from "./tool-detail";

interface ToolRowProps {
  readonly label: string;
  readonly name: string;
  readonly status: ReactNode;
  readonly detail: string;
  readonly error?: string;
  readonly guard?: WorkbenchGuardRecord | null;
  readonly result?: ToolCallResult | null;
}

export function ToolRow({
  label,
  name,
  status,
  detail,
  error,
  guard = null,
  result = null,
}: ToolRowProps) {
  const errorId = useId();
  const guardLine = guard === null ? null : guardRecordLineOf(guard, result);
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div
        className={
          error === undefined
            ? "min-w-0 rounded-md border"
            : "min-w-0 rounded-md border border-destructive"
        }
      >
        <Collapsible>
          <CollapsibleTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${label} ${name}`}
                aria-describedby={error === undefined ? undefined : errorId}
                className="w-full min-w-0 justify-start"
              />
            }
          >
            <ChevronRightIcon aria-hidden="true" data-icon="inline-start" />
            <span className="shrink-0 text-muted-foreground">{label}</span>
            <span className="min-w-0 truncate font-mono">{name}</span>
            {status}
            <span className="min-w-0 grow basis-0 truncate text-left font-mono text-xs text-muted-foreground">
              {summaryOf(detail)}
            </span>
          </CollapsibleTrigger>
          <RevealPanel>
            <p className="px-3 pb-1 font-mono text-xs break-all">{name}</p>
            <ToolDetail detail={detail} inviteId={guard?.grant?.invite_id} />
          </RevealPanel>
        </Collapsible>
      </div>
      {guardLine !== null && (
        <p className="min-w-0 px-3 text-xs break-words text-muted-foreground">{guardLine}</p>
      )}
      {error !== undefined && <InlineError id={errorId} code={null} message={error} />}
    </div>
  );
}
