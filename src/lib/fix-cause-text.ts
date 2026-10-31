import type { TakerSituation } from "./claim-takers";
import type { NoTakerItem } from "./fix-attention";

const SITUATION_TEXTS: Readonly<Record<TakerSituation, string>> = {
  no_instance: "lists no instance. Add an instance to the binding on the Bindings tab.",
  no_registration:
    "has no live registration of a listed instance. Open the worker page to check its instances.",
  external_harness: "has no live registration. Start its worker program.",
};

function tagsTextOf(tags: readonly string[]): string {
  if (tags.length === 0) return "";
  return ` with the tags ${tags.join(", ")}`;
}

export function jobsTextOf({ intent, jobCount, state, tags }: NoTakerItem): string {
  return `${intent} ${jobCount === 1 ? "job" : "jobs"} in state ${state}${tagsTextOf(tags)}`;
}

export function jobPronounOf(jobCount: number): string {
  return jobCount === 1 ? "it" : "them";
}

export function jobWaitVerbOf(jobCount: number): string {
  return jobCount === 1 ? "waits" : "wait";
}

export function situationTextOf(situation: TakerSituation): string {
  return SITUATION_TEXTS[situation];
}

export function exampleOf(item: { readonly count: number }): string {
  return item.count > 1 ? ", for example" : "";
}

export function issuesTextOf(issues: readonly string[]): string {
  return issues.length === 0 ? "" : ` (${issues.join(", ")})`;
}

export function pendingReasonTextOf(reason: string): string {
  return reason === "" ? "." : `: ${reason}`;
}
