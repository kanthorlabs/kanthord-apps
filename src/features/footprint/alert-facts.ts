import type { ApiError } from "@/api/errors";
import type { FootprintAlert, FootprintStat } from "@/api/types";
import { byteText, utcDateTime } from "@/lib/format";
import { FOOTPRINT_KIND_LABELS, isCleanableKind, SERVER_HOST_LABEL } from "@/lib/footprint";
import { type StatFact, statHost, statPath } from "./stat-facts";

const PERCENT = 100;

const ACKNOWLEDGE_MESSAGES: Readonly<Record<string, string>> = {
  "footprint.alert.resolved": "The episode is resolved. The list now shows the open episodes.",
  "footprint.alert.acknowledged": "The acknowledgement of this episode still holds.",
};

export function acknowledgeFailureText(failure: ApiError): string {
  return ACKNOWLEDGE_MESSAGES[failure.detail] ?? failure.message;
}

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

export interface AlertNotice {
  readonly subject: string;
  readonly host: string;
  readonly claim: string;
  readonly growth: string | null;
  readonly path: string;
  readonly linkText: string;
}

function percentText(ratio: number): string {
  return `${Math.round(ratio * PERCENT)}%`;
}

function verbOf(noun: string, plural: string, singular: string): string {
  return noun.endsWith("s") ? plural : singular;
}

function floorRatioOf(alert: FootprintAlert): number | null {
  if (alert.threshold.measure === "days_to_floor") return alert.threshold.free_ratio;
  if (alert.threshold.measure === "free_ratio") return alert.threshold.value;
  return null;
}

function diskClaim(alert: FootprintAlert, subject: FootprintStat | null, floor: number): string {
  const free = subject?.free_bytes ?? null;
  const total = subject?.total_bytes ?? null;
  const ratio = free !== null && total !== null && total > 0 ? free / total : null;
  if (ratio !== null && ratio < floor) {
    return `has ${percentText(ratio)} free, below the ${percentText(floor)} floor.`;
  }
  const days =
    subject?.days_to_floor ?? (alert.threshold.measure === "days_to_floor" ? alert.value : null);
  if (days !== null) {
    return `reaches ${percentText(floor)} free in about ${Math.max(1, Math.round(days))} days.`;
  }
  return `had ${alertValueText(alert)} at the fire, below the ${percentText(floor)} floor.`;
}

function fastestGrowth(
  alert: FootprintAlert,
  stats: readonly FootprintStat[],
): FootprintStat | null {
  if (alert.instance_name === null) return null;
  let fastest: FootprintStat | null = null;
  for (const stat of stats) {
    if (stat.kind === "disk" || stat.instance_name !== alert.instance_name) continue;
    const bytes = stat.growth_per_day?.bytes ?? 0;
    if (bytes > 0 && bytes > (fastest?.growth_per_day?.bytes ?? 0)) fastest = stat;
  }
  return fastest;
}

function growthText(stat: FootprintStat): string {
  const label = FOOTPRINT_KIND_LABELS[stat.kind];
  const bytes = byteText(stat.growth_per_day?.bytes ?? 0);
  return `${label} ${verbOf(label, "grow", "grows")} about ${bytes} a day.`;
}

function linkTextOf(stat: { readonly kind: FootprintAlert["kind"] }): string {
  return isCleanableKind(stat.kind) ? "Review the candidates." : "Review the footprint.";
}

export function alertNotice(alert: FootprintAlert, stats: readonly FootprintStat[]): AlertNotice {
  const subject = subjectOf(alert, stats);
  const host = subject === null ? (alert.instance_name ?? SERVER_HOST_LABEL) : statHost(subject);
  const floor = floorRatioOf(alert);
  if (alert.kind === "disk" && floor !== null) {
    const growing = fastestGrowth(alert, stats);
    return {
      subject: "The disk of",
      host,
      claim: diskClaim(alert, subject, floor),
      growth: growing === null ? null : growthText(growing),
      path: growing === null ? alertKindPath(alert) : statPath(growing),
      linkText: linkTextOf(growing ?? alert),
    };
  }
  const noun =
    alert.kind === "log" && alert.item_key !== null
      ? `The log ${alert.item_key}`
      : FOOTPRINT_KIND_LABELS[alert.kind];
  const limit =
    alert.threshold.measure === "bytes"
      ? `the ${byteText(alert.threshold.value)} threshold`
      : "its threshold";
  return {
    subject: `${noun} on`,
    host,
    claim: `${verbOf(noun, "hold", "holds")} ${byteText(subject?.bytes ?? alert.value)}, above ${limit}.`,
    growth: null,
    path: alertKindPath(alert),
    linkText: linkTextOf(alert),
  };
}
