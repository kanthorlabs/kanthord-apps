import type { CleanupRule, FootprintCleanupRecord } from "@/api/types";
import { byteText, utcDateTime } from "@/lib/format";
import { FOOTPRINT_KIND_LABELS, RULE_LABELS, SERVER_HOST_LABEL } from "@/lib/footprint";
import type { StatFact } from "./stat-facts";

export function cleanupTitle(record: FootprintCleanupRecord): string {
  return `${FOOTPRINT_KIND_LABELS[record.kind]} · ${record.instance_name ?? SERVER_HOST_LABEL}`;
}

export function cleanupPath(cleanupId: string): string {
  return `/footprint/cleanups/${encodeURIComponent(cleanupId)}`;
}

export function ruleText(rule: CleanupRule | null): string {
  if (rule === null) return "Picked by hand";
  if (rule.name === "older_than") return `Older than ${rule.older_than_days} days`;
  return RULE_LABELS[rule.name];
}

export function outcomeText(record: FootprintCleanupRecord): string {
  const outcome = record.outcome;
  if (outcome === null) return `${record.keys.length} pending`;
  const removed =
    outcome.removed_bytes === null
      ? `${outcome.removed} removed`
      : `${outcome.removed} removed (${byteText(outcome.removed_bytes)})`;
  return `${removed} · ${outcome.absent} absent · ${outcome.refused.length} refused · ${outcome.pending} pending`;
}

export function cleanupFacts(record: FootprintCleanupRecord): readonly StatFact[] {
  return [
    { label: "Rule", value: ruleText(record.rule) },
    { label: "Keys", value: String(record.keys.length) },
    { label: "Requested by", value: record.requested_by.name || record.requested_by.account },
    { label: "Requested", value: utcDateTime(record.requested_at) },
    {
      label: "Finished",
      value: record.finished_at === null ? "—" : utcDateTime(record.finished_at),
    },
    { label: "Outcome", value: outcomeText(record) },
  ];
}
