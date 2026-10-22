import { listMissionNodes, readMission } from "@/api/resources/mission";
import type { MissionNodeRecord, NodeState, Project } from "@/api/types";
import { asApiError, useResource } from "@/hooks/use-resource";
import { tallyStates } from "@/lib/state-tally";

const ATTENTION_STATES: readonly NodeState[] = ["Blocked", "Paused", "External.Failed"];
const RUNNING_STATES: readonly NodeState[] = ["Executing", "Evaluating"];

export type ProjectState =
  | { readonly status: "loading" }
  | { readonly status: "failed"; readonly message: string }
  | {
      readonly status: "ready";
      readonly total: number;
      readonly completed: number;
      readonly running: number;
      readonly attention: number;
    };

const LOADING: ProjectState = { status: "loading" };

function stateOf(nodes: readonly MissionNodeRecord[]): ProjectState {
  const tallies = tallyStates(nodes);
  const count = (states: readonly NodeState[]) =>
    tallies
      .filter((tally) => states.includes(tally.state))
      .reduce((total, tally) => total + tally.count, 0);
  return {
    status: "ready",
    total: tallies.reduce((total, tally) => total + tally.count, 0),
    completed: count(["Completed"]),
    running: count(RUNNING_STATES),
    attention: count(ATTENTION_STATES),
  };
}

async function readProjectState(projectId: string): Promise<ProjectState> {
  try {
    const mission = await readMission(projectId);
    return stateOf(await listMissionNodes(mission.id));
  } catch (cause: unknown) {
    return { status: "failed", message: asApiError(cause).message };
  }
}

async function readProjectStates(
  projectIds: readonly string[],
): Promise<ReadonlyMap<string, ProjectState>> {
  const states = await Promise.all(projectIds.map(readProjectState));
  return new Map(projectIds.map((projectId, index) => [projectId, states[index] ?? LOADING]));
}

export function progressTextOf(state: ProjectState): string {
  if (state.status === "loading") return "Reading";
  if (state.status === "failed") return `Could not be read: ${state.message}`;
  if (state.total === 0) return "No nodes";
  return `${state.completed} of ${state.total} nodes completed`;
}

export function useProjectStates(
  projects: readonly Project[],
): (projectId: string) => ProjectState {
  const projectIds = projects.map((project) => project.id);
  const { data } = useResource(() => readProjectStates(projectIds), projectIds);
  return (projectId) => data?.get(projectId) ?? LOADING;
}
