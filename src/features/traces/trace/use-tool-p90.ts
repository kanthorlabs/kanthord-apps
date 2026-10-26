import { readAnalyticsDuration } from "@/api/resources/tracking";
import { useResource } from "@/hooks/use-resource";

const WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

async function readToolP90(projectId: string, toolName: string): Promise<number | null> {
  const now = Date.now();
  const page = await readAnalyticsDuration({
    measure: "tool_latency",
    group_by: "tool_name",
    bucket: "none",
    project_id: projectId,
    from: now - WINDOW_MS,
    to: now,
  });
  return page.items.find((item) => item.key === toolName)?.p90 ?? null;
}

export function useToolP90(projectId: string | null, toolName: string | null): number | null {
  const p90 = useResource(
    async () => (projectId === null || toolName === null ? null : readToolP90(projectId, toolName)),
    [projectId, toolName],
  );
  return projectId === null || toolName === null ? null : p90.data;
}
