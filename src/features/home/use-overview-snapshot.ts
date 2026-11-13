import { useCallback, useRef } from "react";

import { type PolledResource, usePolledResource } from "@/hooks/use-polled-resource";

import { type OverviewSnapshot, readOverviewSnapshot, retryFaults } from "./read-overview-snapshot";

const SNAPSHOT_INTERVAL_MS = 15_000;

export interface OverviewSnapshotResource extends PolledResource<OverviewSnapshot> {
  readonly retry: () => void;
}

export function useOverviewSnapshot(hold: boolean): OverviewSnapshotResource {
  const last = useRef<OverviewSnapshot | null>(null);
  const polled = usePolledResource(
    async () => {
      const snapshot = await readOverviewSnapshot(last.current, null);
      last.current = snapshot;
      return snapshot;
    },
    [],
    { intervalMs: SNAPSHOT_INTERVAL_MS, hold },
  );
  const { refresh, readWith } = polled;
  const retry = useCallback(() => {
    const base = last.current;
    if (base === null) {
      refresh();
      return;
    }
    readWith(async () => {
      const snapshot = await retryFaults(last.current ?? base);
      last.current = snapshot;
      return snapshot;
    });
  }, [readWith, refresh]);
  return { ...polled, retry };
}
