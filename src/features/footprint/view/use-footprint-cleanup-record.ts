import { useCallback, useState } from "react";
import { toast } from "sonner";

import { cancelFootprintCleanup, readFootprintCleanup } from "@/api/resources/footprint";
import type { CleanupState, FootprintCleanupRecord } from "@/api/types";
import { type PolledResource, usePolledResource } from "@/hooks/use-polled-resource";
import { asApiError } from "@/hooks/use-resource";

export const CLEANUP_RECORD_POLL_MS = 15_000;
const LIVE_STATES: readonly CleanupState[] = ["queued", "running"];

const CANCEL_MESSAGES: Readonly<Record<string, string>> = {
  "footprint.cleanup.not_queued": "The cleanup is no longer queued. The record shows its state.",
};

export interface CleanupRecordState {
  readonly record: PolledResource<FootprintCleanupRecord>;
  readonly live: boolean;
  readonly cancelling: boolean;
  readonly cancel: () => void;
}

export function useFootprintCleanupRecord(cleanupId: string): CleanupRecordState {
  const [cancelling, setCancelling] = useState(false);
  const [held, setHeld] = useState(false);
  const record = usePolledResource(
    () =>
      readFootprintCleanup(cleanupId).then((value) => {
        setHeld(!LIVE_STATES.includes(value.state));
        return value;
      }),
    [cleanupId],
    { intervalMs: CLEANUP_RECORD_POLL_MS, hold: held },
  );
  const refresh = record.refresh;

  const cancel = useCallback(() => {
    setCancelling(true);
    cancelFootprintCleanup(cleanupId).then(
      () => {
        setCancelling(false);
        toast.success("Cancelled the cleanup.");
        refresh();
      },
      (cause: unknown) => {
        setCancelling(false);
        const failure = asApiError(cause);
        toast.error("The cancel failed.", {
          description: CANCEL_MESSAGES[failure.detail] ?? failure.message,
        });
        refresh();
      },
    );
  }, [cleanupId, refresh]);

  return {
    record,
    live: record.data !== null && LIVE_STATES.includes(record.data.state),
    cancelling,
    cancel,
  };
}
