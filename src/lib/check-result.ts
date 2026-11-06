import type { MissionNodeCheckAnswer, MissionNodeCheckResult } from "@/api/types";

import { externalLinkOf } from "./external-link";

export const CHECKING_LABEL = "Checking";

function endedLabelOf(results: readonly MissionNodeCheckResult[]): string {
  const [only] = results;
  if (results.length !== 1 || only === undefined) return "Delivered";
  return only.requirement_key.endsWith(".merge_push") ? "Pushed" : "Merged";
}

export function linkLabelsOf({ link_updates: linkUpdates }: MissionNodeCheckAnswer): string[] {
  return linkUpdates.map(
    (link) =>
      `${externalLinkOf(link.external_link).text}: ${link.admitted} admitted, ${link.duplicate} duplicate, ${link.refused} refused`,
  );
}

export function checkLabelOf({
  results,
  failures,
  link_updates: linkUpdates,
}: MissionNodeCheckAnswer): string | null {
  if (results.length === 0 && failures.length === 0 && linkUpdates.length > 0) return null;
  if (results.length === 0 && failures.length > 0) return null;
  if (results.some((result) => result.resolution === "other-end")) return "Ended in another state";
  if (results.length > 0 && results.every((result) => result.resolution === "expected-end")) {
    return endedLabelOf(results);
  }
  return "Not delivered yet";
}
