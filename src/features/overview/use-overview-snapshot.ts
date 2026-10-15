import { useRef } from "react";

import { usePolledResource, type PolledResource } from "@/hooks/use-polled-resource";

import { readOverviewSnapshot, type OverviewSnapshot } from "./read-overview-snapshot";

const SNAPSHOT_INTERVAL_MS = 15_000;

export function useOverviewSnapshot(hold: boolean): PolledResource<OverviewSnapshot> {
  const last = useRef<OverviewSnapshot | null>(null);
  return usePolledResource(
    async () => {
      const snapshot = await readOverviewSnapshot(last.current);
      last.current = snapshot;
      return snapshot;
    },
    [],
    { intervalMs: SNAPSHOT_INTERVAL_MS, hold },
  );
}
