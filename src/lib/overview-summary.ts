import type { MissionNodeRecord } from "@/api/types";

import { ATTENTION_GROUPS, type AttentionItem } from "./attention";

function counted(count: number, noun: string, plural: string): string {
  return `${count} ${count === 1 ? noun : plural}`;
}

export function attentionSummary(items: readonly AttentionItem[]): string {
  const parts = ATTENTION_GROUPS.flatMap((group) => {
    const count = items.filter((item) => item.group === group.id).length;
    return count === 0 ? [] : [counted(count, group.noun, group.plural)];
  });
  return parts.length === 0 ? "No item waits for you" : parts.join(" · ");
}

export function statusLineText(running: number, waiting: number): string {
  const executions = running === 1 ? "execution runs" : "executions run";
  const jobs = waiting === 1 ? "job waits" : "jobs wait";
  return `${running} ${executions} · ${waiting} ${jobs}`;
}

export function claimedNodeCount(nodes: readonly MissionNodeRecord[]): number {
  return nodes.filter(
    (node) =>
      node.kind !== "task" &&
      node.retired_at === null &&
      (node.state === "Executing" || node.state === "Evaluating"),
  ).length;
}
