import { listAttempts, readClosure, readNode, listRevisions } from "@/api/resources/mission";
import { readEligibility } from "@/api/resources/scheduler";
import type { ApiError } from "@/api/errors";
import type {
  Attempt,
  DependencyClosure,
  EligibilityReport,
  MissionNode,
  NodeRevision,
} from "@/api/types";
import { useProjectId } from "@/features/projects/project-context";
import type { Resource } from "@/hooks/use-resource";
import { useResource } from "@/hooks/use-resource";

export interface NodeResources {
  readonly node: Resource<MissionNode>;
  readonly revisions: Resource<readonly NodeRevision[]>;
  readonly attempts: Resource<readonly Attempt[]>;
  readonly closure: Resource<DependencyClosure>;
  readonly eligibility: Resource<EligibilityReport>;
  readonly loading: boolean;
  readonly error: ApiError | null;
}

export function useNode(nodeId: string): NodeResources {
  const projectId = useProjectId();

  const node = useResource(() => readNode(projectId, nodeId), [projectId, nodeId]);
  const revisions = useResource(() => listRevisions(projectId, nodeId), [projectId, nodeId]);
  const attempts = useResource(() => listAttempts(projectId, nodeId), [projectId, nodeId]);
  const closure = useResource(() => readClosure(projectId, nodeId), [projectId, nodeId]);
  const eligibility = useResource(() => readEligibility(projectId, nodeId), [projectId, nodeId]);

  const loading =
    node.loading || revisions.loading || attempts.loading || closure.loading || eligibility.loading;

  const error =
    node.error ?? revisions.error ?? attempts.error ?? closure.error ?? eligibility.error;

  return { node, revisions, attempts, closure, eligibility, loading, error };
}
