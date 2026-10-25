import type { TimelineItem } from "@/api/types";
import { DataListItem } from "@/components/data-list-item";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { utcDateTime } from "@/lib/format";
import { spanLabel } from "@/lib/span-labels";
import { reasonTextIdOf } from "@/lib/timeline-rows";

import { useActReason } from "../use-act-reason";
import { OpenTraceButton } from "./open-trace-button";

interface ActRowProps {
  readonly item: TimelineItem;
}

export function ActRow({ item }: ActRowProps) {
  const textId = reasonTextIdOf(item);
  const reason = useActReason(item.trace_id, textId);
  const executionTraceId = item.links[0]?.trace_id ?? null;
  const at = item.start_time ?? item.created_at;
  return (
    <DataListItem
      title={spanLabel(item)}
      description="by a human"
      fields={[{ label: "Time", value: utcDateTime(at) }]}
      notice={
        <Reveal open={reason.shown}>
          <p className="text-sm break-words whitespace-pre-wrap">
            {reason.loading && "Loading the reason."}
            {reason.error?.message}
            {reason.text}
          </p>
        </Reveal>
      }
      actions={
        <>
          {textId !== null && (
            <Button
              variant="outline"
              size="sm"
              aria-expanded={reason.shown}
              onClick={reason.toggle}
            >
              {reason.shown ? "Hide reason" : "Show reason"}
            </Button>
          )}
          {executionTraceId !== null && <OpenTraceButton traceId={executionTraceId} />}
        </>
      }
    />
  );
}
