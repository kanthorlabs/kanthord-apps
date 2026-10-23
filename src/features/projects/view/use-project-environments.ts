import { useState } from "react";

import { listProjectEnvironments } from "@/api/resources/projects";
import type { EnvironmentState } from "@/api/types";
import { usePolledResource } from "@/hooks/use-polled-resource";
import { ENVIRONMENT_IDLE_POLL_MS, environmentPollMs } from "@/lib/environment-bar";

export interface ProjectEnvironments {
  readonly states: readonly EnvironmentState[] | null;
  readonly now: number;
  readonly refresh: () => void;
}

export function useProjectEnvironments(projectId: string): ProjectEnvironments {
  const [intervalMs, setIntervalMs] = useState(ENVIRONMENT_IDLE_POLL_MS);
  const { data, now, refresh } = usePolledResource(
    () => listProjectEnvironments(projectId),
    [projectId],
    { intervalMs },
  );
  const answeredMs = environmentPollMs(data);

  if (answeredMs !== intervalMs) setIntervalMs(answeredMs);

  return { states: data, now, refresh };
}
