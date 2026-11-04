import { CheckIcon, RefreshCwIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { DisabledAction } from "@/components/disabled-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ALERT_STATE_LABELS, CLEANUP_STATE_LABELS } from "@/lib/footprint";
import type { Resource } from "@/hooks/use-resource";
import { alertFacts, alertKindPath, alertTitle } from "../alert-facts";
import { cleanupFacts, cleanupPath, cleanupTitle } from "../cleanup-facts";
import { StatItem } from "../components/stat-item";
import { statKey, statPath, statTitle } from "../stat-facts";
import { useFootprintSummary } from "./use-footprint-summary";

function statusOf<T>(resource: Resource<T>): "loading" | "ready" | "error" {
  if (resource.loading) return "loading";
  return resource.error === null ? "ready" : "error";
}

export function FootprintScreen() {
  const navigate = useNavigate();
  const footprint = useFootprintSummary();
  const { summary, cleanups, alerts } = footprint;
  const summaryStatus =
    summary.data !== null ? "ready" : summary.error !== null ? "error" : "loading";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-start gap-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold">Footprint</h2>
          <p className="text-sm text-muted-foreground">
            The disk use of each store that grows with time. KanthorD deletes nothing by itself. A
            cleanup runs only after a human confirms it.
          </p>
        </div>
        <Button variant="outline" disabled={footprint.measuring} onClick={footprint.measure}>
          <RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
          Measure now
        </Button>
      </div>

      <DataList
        label="Footprint statistics"
        items={footprint.stats}
        getKey={statKey}
        renderItem={(stat) => (
          <StatItem
            stat={stat}
            now={summary.now}
            select={{
              label: `Open ${statTitle(stat)}`,
              disabled: false,
              onSelect: () => navigate(statPath(stat)),
            }}
          />
        )}
        status={summaryStatus}
        error={summary.error?.message ?? null}
        pending={summary.loading}
        onRetry={summary.refresh}
        emptyText="No measurement yet. Run Measure now."
      />

      <section aria-labelledby="footprint-alerts" className="flex flex-col gap-3">
        <h3 id="footprint-alerts" className="font-semibold leading-none">
          Alerts
        </h3>
        <DataList
          label="Open alerts"
          items={alerts.data ?? []}
          getKey={(alert) => alert.alert_id}
          renderItem={(alert) => (
            <DataListItem
              title={alertTitle(alert)}
              status={
                <Badge variant={alert.state === "firing" ? "destructive" : "secondary"}>
                  {ALERT_STATE_LABELS[alert.state] ?? "Resolved"}
                </Badge>
              }
              fields={alertFacts(alert)}
              select={{
                label: `Open ${alertTitle(alert)}`,
                disabled: false,
                onSelect: () => navigate(alertKindPath(alert)),
              }}
              actions={
                !footprint.heldAlerts.has(alert.alert_id) ? (
                  <Button
                    variant="outline"
                    size="sm"
                    aria-label={`Acknowledge ${alertTitle(alert)}`}
                    disabled={footprint.acknowledging === alert.alert_id}
                    onClick={() => footprint.acknowledge(alert.alert_id)}
                  >
                    <CheckIcon aria-hidden="true" data-icon="inline-start" />
                    Acknowledge
                  </Button>
                ) : (
                  <DisabledAction
                    label="Acknowledge"
                    reason="The acknowledgement of this episode still holds."
                  />
                )
              }
            />
          )}
          status={statusOf(alerts)}
          error={alerts.error?.message ?? null}
          pending={alerts.loading}
          onRetry={alerts.reload}
          emptyText="No open alert."
        />
      </section>

      <section aria-labelledby="footprint-cleanups" className="flex flex-col gap-3">
        <h3 id="footprint-cleanups" className="font-semibold leading-none">
          Cleanups
        </h3>
        <DataList
          label="Recent cleanups"
          items={cleanups.data ?? []}
          getKey={(record) => record.cleanup_id}
          renderItem={(record) => (
            <DataListItem
              title={cleanupTitle(record)}
              status={<Badge variant="secondary">{CLEANUP_STATE_LABELS[record.state]}</Badge>}
              fields={cleanupFacts(record)}
              select={{
                label: `Open cleanup ${record.cleanup_id}`,
                disabled: false,
                onSelect: () => navigate(cleanupPath(record.cleanup_id)),
              }}
            />
          )}
          status={statusOf(cleanups)}
          error={cleanups.error?.message ?? null}
          pending={cleanups.loading}
          onRetry={cleanups.reload}
          emptyText="No cleanup yet."
        />
      </section>
    </div>
  );
}
