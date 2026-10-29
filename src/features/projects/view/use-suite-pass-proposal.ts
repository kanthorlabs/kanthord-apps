import { useCallback, useState } from "react";
import { toast } from "sonner";

import { createMissionNode, readMission } from "@/api/resources/mission";
import { readSuitePassPlan } from "@/api/resources/projects";
import type { BindingEnvironment, RepositoryBindingConfig } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

export const NODE_FILENAME_CONFLICT = "mission.node.filename_conflict";

type BindingAction = RepositoryBindingConfig["strategy"]["action"];

export interface SuitePassProposalState {
  readonly proposed: boolean;
  readonly adding: boolean;
  readonly add: () => void;
}

function isSuitePassProposed(
  environment: BindingEnvironment | null,
  action: BindingAction,
): boolean {
  return (
    environment !== null &&
    environment.suite_pass === "absent" &&
    action?.name === "pull_request" &&
    (action.landing ?? "human") === "human"
  );
}

export function useSuitePassProposal(
  projectId: string,
  bindingId: string,
  bindingName: string,
  environment: BindingEnvironment | null,
  action: BindingAction,
): SuitePassProposalState {
  const [adding, setAdding] = useState(false);

  const add = useCallback(
    function attempt() {
      setAdding(true);
      readSuitePassPlan(projectId, bindingId)
        .then(async (plan) => {
          const mission = await readMission(projectId);
          return createMissionNode(mission.id, {
            ...plan,
            expected_mission_version: mission.version,
          });
        })
        .then(
          () => {
            setAdding(false);
            toast.success(`Setup node of ${bindingName} added.`);
          },
          (cause: unknown) => {
            setAdding(false);
            const failure = asApiError(cause);
            if (failure.status === 409 && failure.detail === NODE_FILENAME_CONFLICT) {
              toast.info(`Setup node of ${bindingName} exists.`);
              return;
            }
            toast.error(failure.message, { action: { label: "Retry", onClick: attempt } });
          },
        );
    },
    [projectId, bindingId, bindingName],
  );

  return { proposed: isSuitePassProposed(environment, action), adding, add };
}
