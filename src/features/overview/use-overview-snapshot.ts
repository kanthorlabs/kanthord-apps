import { useEffect, useRef } from "react";

import { type PolledResource, usePolledResource } from "@/hooks/use-polled-resource";

import { type OverviewSnapshot, readOverviewSnapshot } from "./read-overview-snapshot";

const SNAPSHOT_INTERVAL_MS = 15_000;

export function useOverviewSnapshot(
  hold: boolean,
  selectedProjectId: string | null,
): PolledResource<OverviewSnapshot> {
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
  const { refresh } = polled;
  useEffect(() => {
    const before = selected.current;
    selected.current = selectedProjectId;
    if (before !== null && selectedProjectId === null) refresh();
  }, [selectedProjectId, refresh]);
  return polled;
}
