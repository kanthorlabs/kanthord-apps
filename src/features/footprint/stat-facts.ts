import type { FootprintStat, FootprintThreshold } from "@/api/types";
import { byteText, durationText } from "@/lib/format";
import {
  FOOTPRINT_KIND_LABELS,
  INSTANCE_STALE_TEXT,
  SERVER_HOST_LABEL,
  SERVER_STALE_TEXT,
} from "@/lib/footprint";
import { relativeAge } from "@/lib/relative-age";

const RUNTIME_STORE_DEVICE = "container_runtime";
const PERCENT = 100;

export interface StatFact {
  readonly label: string;
  readonly value: string;
}

export function statKey(stat: FootprintStat): string {
  return [stat.kind, stat.instance_name ?? "", stat.item_key ?? ""].join("|");
}

export function statHost(stat: FootprintStat): string {
  if (stat.kind === "disk" && stat.item_key === RUNTIME_STORE_DEVICE) {
    return "container runtime store";
  }
  return stat.instance_name ?? SERVER_HOST_LABEL;
}

export function statTitle(stat: FootprintStat): string {
  const parts = [FOOTPRINT_KIND_LABELS[stat.kind], statHost(stat)];
  if (stat.kind === "log" && stat.item_key !== null) parts.push(stat.item_key);
  return parts.join(" · ");
}

export function statPath(stat: FootprintStat): string {
  const path = `/footprint/${encodeURIComponent(stat.kind)}`;
  return stat.instance_name === null
    ? path
    : `${path}?${new URLSearchParams({ instance: stat.instance_name })}`;
}

function ratioText(ratio: number): string {
  return `${Math.round(ratio * PERCENT)}% free`;
}

function thresholdText(threshold: FootprintThreshold): string {
  if (threshold.measure === "bytes") return byteText(threshold.value);
  if (threshold.measure === "free_ratio") return `below ${ratioText(threshold.value)}`;
  return `${threshold.value} days to ${ratioText(threshold.free_ratio)}`;
}

function sizeText(bytes: number, estimated: boolean): string {
  return `${estimated ? "about " : ""}${byteText(bytes)}`;
}

function daysToFloorText(days: number | null): string {
  if (days === null) return "No growth";
  if (days === 0) return "Below the floor";
  return `about ${Math.round(days)} days`;
}

function oneDecimal(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

export function candidatesText(stat: FootprintStat): string | null {
  const candidates = stat.candidates;
  if (candidates === null) return null;
  return candidates.bytes === null
    ? String(candidates.count)
    : `${candidates.count} · ${sizeText(candidates.bytes, candidates.bytes_estimated)}`;
}

export function statFacts(stat: FootprintStat, now: number): readonly StatFact[] {
  const facts: StatFact[] = [];
  if (stat.kind === "disk") {
    if (stat.free_bytes !== null && stat.total_bytes !== null) {
      facts.push({
        label: "Free",
        value: `${byteText(stat.free_bytes)} of ${byteText(stat.total_bytes)}`,
      });
    }
    facts.push({ label: "Days to the floor", value: daysToFloorText(stat.days_to_floor) });
    if (stat.instance_names.length > 0) {
      facts.push({ label: "Instances", value: stat.instance_names.join(", ") });
    }
  } else {
    facts.push({ label: "Size", value: stat.bytes === null ? "—" : byteText(stat.bytes) });
    facts.push({ label: "Count", value: stat.count === null ? "—" : String(stat.count) });
  }
  if (stat.wal_bytes !== null) facts.push({ label: "WAL", value: byteText(stat.wal_bytes) });
  if (stat.kind !== "disk" && stat.free_bytes !== null) {
    facts.push({ label: "Free pages", value: byteText(stat.free_bytes) });
  }
  if (stat.oldest_at !== null) {
    facts.push({ label: "Oldest", value: relativeAge(stat.oldest_at, now) });
  }
  if (stat.growth_per_day !== null) {
    facts.push({
      label: "Growth per day",
      value: `${oneDecimal(stat.growth_per_day.count)} · ${byteText(stat.growth_per_day.bytes)}`,
    });
  }
  facts.push({
    label: "Threshold",
    value: stat.thresholds.length === 0 ? "None" : stat.thresholds.map(thresholdText).join(" or "),
  });
  const candidates = candidatesText(stat);
  if (candidates !== null) facts.push({ label: "Candidates", value: candidates });
  facts.push({
    label: "Measured",
    value: stat.measured_at === null ? "Not yet" : relativeAge(stat.measured_at, now),
  });
  return facts;
}

export function staleText(stat: FootprintStat, now: number): string | null {
  if (!stat.stale || stat.measured_at === null) return null;
  const reason = stat.instance_name === null ? SERVER_STALE_TEXT : INSTANCE_STALE_TEXT;
  return `Measured ${durationText(now - stat.measured_at)} ago. ${reason}`;
}

export function measureErrorText(stat: FootprintStat): string | null {
  if (stat.measure_error === null) return null;
  return `The last measurement failed: ${stat.measure_error.message} (${stat.measure_error.code}). The values show the last measurement.`;
}

function firing(stat: FootprintStat): number {
  return stat.alert.state === "firing" ? 0 : 1;
}

export function sortedStats(stats: readonly FootprintStat[]): readonly FootprintStat[] {
  return [...stats].sort(
    (left, right) => firing(left) - firing(right) || (right.bytes ?? -1) - (left.bytes ?? -1),
  );
}
