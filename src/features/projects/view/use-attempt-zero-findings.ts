import { listNodeFindings } from "@/api/resources/mission";
import type { MissionFinding } from "@/api/types";
import { useResource } from "@/hooks/use-resource";
import type { SettledRead } from "./settled-read";

const NO_ATTEMPT = 0;

export interface AttemptZeroFindings {
  readonly findings: SettledRead<readonly MissionFinding[]> | null;
  readonly reload: () => void;
}

export function useAttemptZeroFindings(nodeId: string, refreshKey: number): AttemptZeroFindings {
  const read = useResource(() => listNodeFindings(nodeId, NO_ATTEMPT), [nodeId, refreshKey]);
  if (read.error !== null)
    return { findings: { data: null, error: read.error }, reload: read.reload };
  if (read.data === null || read.data.length === 0) return { findings: null, reload: read.reload };
  return { findings: { data: read.data, error: null }, reload: read.reload };
}
