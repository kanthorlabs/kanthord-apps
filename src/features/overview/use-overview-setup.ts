import { useRef } from "react";

import { usePolledResource, type PolledResource } from "@/hooks/use-polled-resource";

import { readOverviewSetup, type OverviewSetup } from "./read-overview-setup";

const SETUP_INTERVAL_MS = 60_000;

export function useOverviewSetup(hold: boolean): PolledResource<OverviewSetup> {
  const last = useRef<OverviewSetup | null>(null);
  return usePolledResource(
    async () => {
      const setup = await readOverviewSetup(last.current);
      last.current = setup;
      return setup;
    },
    [],
    { intervalMs: SETUP_INTERVAL_MS, hold },
  );
}
