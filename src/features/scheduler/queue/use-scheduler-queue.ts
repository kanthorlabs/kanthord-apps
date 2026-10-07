import { useMemo } from "react";

import { listQueueJobs } from "@/api/resources/scheduler";
import type { ApiError } from "@/api/errors";
import type { SchedulerJob } from "@/api/types";
import { useProjectId } from "@/features/projects/project-context";
import { useMissionNodes } from "@/hooks/use-mission-nodes";
import { useResource } from "@/hooks/use-resource";

export interface QueueEntryView {
  readonly job: SchedulerJob;
  readonly nodeName: string;
}

export interface QueueState {
  readonly projectId: string;
  readonly loading: boolean;
  readonly error: ApiError | null;
  readonly reload: () => void;
  readonly entries: readonly QueueEntryView[];
}

export function useSchedulerQueue(): QueueState {
  const projectId = useProjectId();
  const jobs = useResource(() => listQueueJobs(projectId), [projectId]);
  const nodes = useMissionNodes(projectId);

  const entries = useMemo(() => {
    const names = new Map((nodes.data ?? []).map((node) => [node.id, node.content.name]));
    return (jobs.data ?? []).map((job) => ({
      job,
      nodeName: names.get(job.node_id) ?? job.node_id,
    }));
  }, [jobs.data, nodes.data]);

  const reload = () => {
    jobs.reload();
    nodes.reload();
  };

  return {
    projectId,
    loading: jobs.loading || nodes.loading,
    error: jobs.error ?? nodes.error,
    reload,
    entries,
  };
}
