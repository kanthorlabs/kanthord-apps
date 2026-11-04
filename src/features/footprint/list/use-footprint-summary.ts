import { useCallback, useState } from "react";
import { toast } from "sonner";

import {
  acknowledgeFootprintAlert,
  listFootprintAlertPage,
  listFootprintCleanupPage,
  readFootprintSummary,
  runFootprintMeasure,
} from "@/api/resources/footprint";
import type { FootprintAlert, FootprintCleanupRecord, FootprintStat } from "@/api/types";
import { type PolledResource, usePolledResource } from "@/hooks/use-polled-resource";
import { asApiError, type Resource, useResource } from "@/hooks/use-resource";
import { useFootprintAlerts } from "@/hooks/use-footprint-alerts";
import { FOOTPRINT_OPEN_ALERTS_LIMIT, FOOTPRINT_SUMMARY_POLL_MS } from "@/lib/footprint";
import { acknowledgeFailureText, acknowledgementHolds } from "../alert-facts";
import { sortedStats } from "../stat-facts";

export const RECENT_CLEANUPS = 20;

export interface FootprintSummaryState {
  readonly summary: PolledResource<{ readonly stats: readonly FootprintStat[] }>;
  readonly stats: readonly FootprintStat[];
  readonly cleanups: Resource<readonly FootprintCleanupRecord[]>;
  readonly alerts: Resource<readonly FootprintAlert[]>;
  readonly measuring: boolean;
  readonly acknowledging: string | null;
  readonly heldAlerts: ReadonlySet<string>;
  readonly measure: () => void;
  readonly acknowledge: (alertId: string) => void;
}

export function useFootprintSummary(): FootprintSummaryState {
  const summary = usePolledResource(readFootprintSummary, [], {
    intervalMs: FOOTPRINT_SUMMARY_POLL_MS,
  });
  const cleanups = useResource(
    () => listFootprintCleanupPage(null, null, RECENT_CLEANUPS).then((page) => page.items),
    [],
  );
  const alerts = useResource(
    () =>
      listFootprintAlertPage(true, null, FOOTPRINT_OPEN_ALERTS_LIMIT).then((page) => page.items),
    [],
  );
  const [measuring, setMeasuring] = useState(false);
  const [acknowledging, setAcknowledging] = useState<string | null>(null);
  const refreshSummary = summary.refresh;
  const reloadAlerts = alerts.reload;
  const refreshBadge = useFootprintAlerts().refresh;

  const measure = useCallback(() => {
    setMeasuring(true);
    runFootprintMeasure().then(
      () => {
        setMeasuring(false);
        toast.success("Measured the server kinds.");
        refreshSummary();
      },
      (cause: unknown) => {
        setMeasuring(false);
        toast.error("The measurement failed.", { description: asApiError(cause).message });
      },
    );
  }, [refreshSummary]);

  const acknowledge = useCallback(
    (alertId: string) => {
      setAcknowledging(alertId);
      acknowledgeFootprintAlert(alertId).then(
        () => {
          setAcknowledging(null);
          toast.success("Acknowledged the alert.");
          reloadAlerts();
          refreshSummary();
          refreshBadge();
        },
        (cause: unknown) => {
          setAcknowledging(null);
          toast.error("The acknowledgement failed.", {
            description: acknowledgeFailureText(asApiError(cause)),
          });
          reloadAlerts();
        },
      );
    },
    [reloadAlerts, refreshSummary, refreshBadge],
  );

  const stats = summary.data?.stats ?? [];
  return {
    summary,
    stats: sortedStats(stats),
    cleanups,
    alerts,
    measuring,
    acknowledging,
    heldAlerts: new Set(
      (alerts.data ?? [])
        .filter((alert) => acknowledgementHolds(alert, stats))
        .map((alert) => alert.alert_id),
    ),
    measure,
    acknowledge,
  };
}
