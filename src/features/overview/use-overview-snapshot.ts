import { useCallback, useEffect, useRef } from "react";

import { type PolledResource, usePolledResource } from "@/hooks/use-polled-resource";

import { type OverviewSnapshot, readOverviewSnapshot, retryFaults } from "./read-overview-snapshot";

const SNAPSHOT_INTERVAL_MS = 15_000;

export interface OverviewSnapshotResource extends PolledResource<OverviewSnapshot> {
  readonly retry: () => void;
}

export function useOverviewSnapshot(
  hold: boolean,
  selectedProjectId: string | null,
): OverviewSnapshotResource {
  const last = useRef<OverviewSnapshot | null>(null);
  const selected = useRef(selectedProjectId);
  const polled = usePolledResource(
    async () => {
      const snapshot = await readOverviewSnapshot(last.current, selected.current);
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
      const snapshot = await retryFaults(base);
      last.current = snapshot;
      return snapshot;
    });
  }, [readWith, refresh]);
  useEffect(() => {
    const before = selected.current;
    selected.current = selectedProjectId;
    if (before !== null && selectedProjectId === null) refresh();
  }, [selectedProjectId, refresh]);
  return { ...polled, retry };
}
