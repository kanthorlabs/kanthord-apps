import type { FootprintAlert, FootprintStat } from "@/api/types";
import { byteText, utcDateTime } from "@/lib/format";
import { FOOTPRINT_KIND_LABELS, SERVER_HOST_LABEL } from "@/lib/footprint";
import type { StatFact } from "./stat-facts";

const PERCENT = 100;

export function alertTitle(alert: FootprintAlert): string {
  const parts = [FOOTPRINT_KIND_LABELS[alert.kind], alert.instance_name ?? SERVER_HOST_LABEL];
  if (alert.kind === "log" && alert.item_key !== null) parts.push(alert.item_key);
  return parts.join(" · ");
}

export function alertValueText(alert: FootprintAlert): string {
  if (alert.threshold.measure === "bytes") return byteText(alert.value);
  if (alert.threshold.measure === "free_ratio") {
    return `${Math.round(alert.value * PERCENT)}% free`;
  }
  return `about ${Math.round(alert.value)} days to the floor`;
}

export function alertFacts(alert: FootprintAlert): readonly StatFact[] {
  return [
    { label: "Value at the fire", value: alertValueText(alert) },
    { label: "Fired", value: utcDateTime(alert.fired_at) },
    {
      label: "Acknowledged",
      value:
        alert.acknowledged_at === null
          ? "No"
          : `${utcDateTime(alert.acknowledged_at)} by ${alert.acknowledged_by?.name ?? "—"}`,
    },
  ];
}

function subjectOf(alert: FootprintAlert, stats: readonly FootprintStat[]): FootprintStat | null {
  return (
    stats.find(
      (stat) =>
        stat.kind === alert.kind &&
        stat.instance_name === alert.instance_name &&
        stat.item_key === alert.item_key,
    ) ?? null
  );
}

export function acknowledgementHolds(
  alert: FootprintAlert,
  stats: readonly FootprintStat[],
): boolean {
  if (alert.acknowledged_until === null) return false;
  const subject = subjectOf(alert, stats);
  if (alert.kind === "disk") return (subject?.free_bytes ?? 0) >= alert.acknowledged_until;
  return (subject?.bytes ?? alert.value) < alert.acknowledged_until;
}

export function alertKindPath(alert: FootprintAlert): string {
  const path = `/footprint/${encodeURIComponent(alert.kind)}`;
  return alert.instance_name === null
    ? path
    : `${path}?${new URLSearchParams({ instance: alert.instance_name })}`;
}
