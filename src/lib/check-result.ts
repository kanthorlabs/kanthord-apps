import type { MissionNodeCheckAnswer, MissionNodeCheckResult } from "@/api/types";

export const CHECKING_LABEL = "Checking";

function endedLabelOf(results: readonly MissionNodeCheckResult[]): string {
  const [only] = results;
  if (results.length !== 1 || only === undefined) return "Delivered";
  return only.requirement_key.endsWith(".merge_push") ? "Pushed" : "Merged";
}

export function checkLabelOf({ results, failures }: MissionNodeCheckAnswer): string | null {
  if (results.length === 0 && failures.length > 0) return null;
  if (results.some((result) => result.resolution === "other-end")) return "Ended in another state";
  if (results.length > 0 && results.every((result) => result.resolution === "expected-end")) {
    return endedLabelOf(results);
  }
  return "Not delivered yet";
}
