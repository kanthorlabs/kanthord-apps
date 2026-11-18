import type { WorkbenchNoticeProject, WorkbenchNoticeState } from "@/api/types";

const STATE_ORDER: readonly WorkbenchNoticeState[] = ["Completed", "Discarded"];

export function noticeStats(project: WorkbenchNoticeProject): string {
  return STATE_ORDER.map((state) => ({
    state,
    count: project.nodes.filter((node) => node.state === state).length,
  }))
    .filter(({ count }) => count > 0)
    .map(({ state, count }) => `${count} ${state}`)
    .join(", ");
}

export function noticeHeader(project: WorkbenchNoticeProject): string {
  return `${project.name} · ${noticeStats(project)}`;
}
