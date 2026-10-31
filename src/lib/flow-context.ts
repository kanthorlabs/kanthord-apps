import type { FlowRead, Project } from "@/api/types";

import { bucketLabel, dayLabel, hourLabel, timeLabel } from "./flow-format";
import { BUCKET_MS, type FlowScope } from "./flow-query";

const SEPARATOR = " · ";

function projectNameOf(projectId: string | null, projects: readonly Project[]): string {
  if (projectId === null) return "All projects";
  return projects.find((project) => project.id === projectId)?.name ?? projectId;
}

function currentPartOf(read: FlowRead): string {
  const { buckets, bucket, now, to } = read.window;
  const partial = now < to;
  const end = Math.min(now, to);
  const first = buckets[0] ?? read.window.from;
  const text = `${hourLabel(first)} – ${dayLabel(end)} ${timeLabel(end)} UTC`;
  if (!partial) return text;
  return `${text} (${bucket === "hour" ? "this hour" : "today"} partial)`;
}

function previousPartOf(read: FlowRead): string {
  const { previous_window: previous } = read;
  if (previous === null) return "no comparison: no aggregates";
  const { bucket } = read.window;
  const sameHour = read.cost.previous_same_hour !== null && read.usage.previous_same_hour !== null;
  const span = `${bucketLabel(previous.from, bucket)} – ${bucketLabel(previous.to - BUCKET_MS[bucket], bucket)}`;
  return `vs ${span}${sameHour ? " to the same hour" : ""}`;
}

export function contextLineOf(
  read: FlowRead,
  filters: FlowScope,
  projects: readonly Project[],
): string {
  return [
    projectNameOf(filters.projectId, projects),
    filters.workerName ?? "all workers",
    currentPartOf(read),
    previousPartOf(read),
    "counted by claim time",
  ].join(SEPARATOR);
}
