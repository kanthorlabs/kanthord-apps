import { createContext, type ReactNode, use, useMemo } from "react";

import { listFootprintAlertPage, readFootprintSummary } from "@/api/resources/footprint";
import type { FootprintAlert, FootprintStat } from "@/api/types";
import { usePolledResource } from "@/hooks/use-polled-resource";
import { FOOTPRINT_OPEN_ALERTS_LIMIT, FOOTPRINT_SUMMARY_POLL_MS } from "@/lib/footprint";

export interface FootprintAlerts {
  readonly count: number;
  readonly stats: readonly FootprintStat[];
  readonly openAlerts: readonly FootprintAlert[];
  readonly refresh: () => void;
}

type FootprintAlertsRead = Omit<FootprintAlerts, "refresh">;

const NO_ALERTS: FootprintAlerts = {
  count: 0,
  stats: [],
  openAlerts: [],
  refresh: () => undefined,
};

const FootprintAlertsContext = createContext<FootprintAlerts>(NO_ALERTS);

async function readFootprintAlerts(): Promise<FootprintAlertsRead> {
  const summary = await readFootprintSummary();
  const count = summary.unacknowledged_alerts;
  if (count === 0) return { count, stats: summary.stats, openAlerts: [] };
  const page = await listFootprintAlertPage(true, null, FOOTPRINT_OPEN_ALERTS_LIMIT);
  return { count, stats: summary.stats, openAlerts: page.items };
}

export function FootprintAlertsProvider({ children }: { readonly children: ReactNode }) {
  const polled = usePolledResource(readFootprintAlerts, [], {
    intervalMs: FOOTPRINT_SUMMARY_POLL_MS,
  });
  const { data, refresh } = polled;
  const value = useMemo(
    (): FootprintAlerts => (data === null ? { ...NO_ALERTS, refresh } : { ...data, refresh }),
    [data, refresh],
  );
  return <FootprintAlertsContext value={value}>{children}</FootprintAlertsContext>;
}

export function useFootprintAlerts(): FootprintAlerts {
  return use(FootprintAlertsContext);
}
