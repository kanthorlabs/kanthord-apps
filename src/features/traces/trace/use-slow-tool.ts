import type { TraceSpan } from "@/api/types";
import { isTool, toolNameOf } from "@/lib/span-detail";
import { slowToolText } from "@/lib/trace-now";

import { useToolP90 } from "./use-tool-p90";

export function useSlowTool(
  projectId: string | null,
  running: TraceSpan | null,
  now: number,
): string | null {
  const tool = running !== null && isTool(running) ? running : null;
  const p90 = useToolP90(projectId, tool === null ? null : toolNameOf(tool));
  return tool === null || tool.start_time === null
    ? null
    : slowToolText(now - tool.start_time, p90);
}
