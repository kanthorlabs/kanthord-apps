import { ChevronRightIcon } from "lucide-react";
import { useState } from "react";

import { removeQueuedWorkbenchMessage } from "@/api/resources/workbench";
import type { WorkbenchQueuedMessage } from "@/api/types";
import { RevealPanel } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { asApiError } from "@/hooks/use-resource";
import { summaryOf } from "@/lib/workbench-chat";
import type { SnapshotPatch } from "../use-session-events";
import { InlineError } from "./inline-error";

const NOT_FOUND_CODE = "workbench.session.queued_message_not_found";
const ALREADY_STARTED = "The message already started.";

interface RowError {
  readonly id: string;
  readonly code: string | null;
  readonly message: string;
}

interface QueuedMessagesProps {
  readonly sessionId: string;
  readonly queue: readonly WorkbenchQueuedMessage[];
  readonly patchSnapshot: (patch: SnapshotPatch) => void;
  readonly refill: (texts: readonly string[]) => void;
}

export function QueuedMessages({ sessionId, queue, patchSnapshot, refill }: QueuedMessagesProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<RowError | null>(null);

  async function remove(item: WorkbenchQueuedMessage, onRemoved: () => void) {
    setError(null);
    setBusy(true);
    try {
      await removeQueuedWorkbenchMessage(sessionId, item.id);
      patchSnapshot((current) => ({ queue: current.queue.filter((held) => held.id !== item.id) }));
      onRemoved();
    } catch (cause) {
      const failed = asApiError(cause);
      setError(
        failed.detail === NOT_FOUND_CODE
          ? { id: item.id, code: NOT_FOUND_CODE, message: ALREADY_STARTED }
          : { id: item.id, code: null, message: failed.message },
      );
    } finally {
      setBusy(false);
    }
  }

  const next = queue[0];
  if (next === undefined) return null;
  return (
    <Collapsible className="mb-2 min-w-0 rounded-md border">
      <CollapsibleTrigger
        render={<Button variant="ghost" size="sm" className="w-full min-w-0 justify-start" />}
      >
        <ChevronRightIcon aria-hidden="true" data-icon="inline-start" />
        <span className="shrink-0">{queue.length} queued</span>
        <span className="min-w-0 grow basis-0 truncate text-left text-xs text-muted-foreground">
          {summaryOf(next.text)}
        </span>
      </CollapsibleTrigger>
      <RevealPanel>
        <ul className="flex flex-col gap-1 px-3 pb-2">
          {queue.map((item) => (
            <li key={item.id} className="flex min-w-0 flex-col gap-1">
              <div className="flex min-w-0 items-start gap-2">
                <p className="min-w-0 grow text-sm break-words whitespace-pre-wrap">{item.text}</p>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void remove(item, () => refill([item.text]))}
                >
                  Edit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void remove(item, () => undefined)}
                >
                  Remove
                </Button>
              </div>
              {error?.id === item.id && <InlineError code={error.code} message={error.message} />}
            </li>
          ))}
        </ul>
      </RevealPanel>
    </Collapsible>
  );
}
