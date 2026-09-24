import { readEligibility } from "@/api/resources/scheduler";
import type { ApiError } from "@/api/errors";
import type { EligibilityReport } from "@/api/types";
import { useProjectId } from "@/features/projects/project-context";
import { useResource } from "@/hooks/use-resource";

type Check = EligibilityReport["checks"][number];

export interface EligibilityState {
  readonly loading: boolean;
  readonly error: ApiError | null;
  readonly reload: () => void;
  readonly failingFirst: readonly Check[];
  readonly hasChecks: boolean;
}

export function useEligibility(nodeId: string): EligibilityState {
  const projectId = useProjectId();
  const { data, loading, error, reload } = useResource(
    () => readEligibility(projectId, nodeId),
    [projectId, nodeId],
  );

  const checks: readonly Check[] = data?.checks ?? [];
  const failingFirst = [...checks].sort((a, b) => {
    if (a.holds === b.holds) return 0;
    return a.holds ? 1 : -1;
  });

  return { loading, error, reload, failingFirst, hasChecks: checks.length > 0 };
}
