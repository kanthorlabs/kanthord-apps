import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { checkNode } from "@/api/resources/mission";
import type {
  MissionExternalAction,
  MissionNodeCheckFailure,
  MissionRunnableNode,
} from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { CHECKING_LABEL, checkLabelOf } from "@/lib/check-result";
import { unresolvedRequestsOf } from "@/lib/external-requests";

export interface NodeCheckState {
  readonly available: boolean;
  readonly checking: boolean;
  readonly label: string | null;
  readonly check: () => void;
}

const CONFLICT_MESSAGES: Readonly<Record<string, string>> = {
  "mission.version.conflict":
    "The mission changed after this read. The view now shows the current mission. Check again.",
  "mission.node.no_unresolved_request":
    "No request of the node waits for an end state. The view now shows its current state.",
  "mission.node.retired": "The node is retired. The view now shows its current state.",
  "mission.node.terminal": "The node is terminal. The view now shows its current state.",
};

function isCheckable(
  node: MissionRunnableNode,
  actions: readonly MissionExternalAction[] | null,
): boolean {
  if (node.retired_at !== null) return false;
  if (node.state !== "External.Requested" && node.state !== "Paused") return false;
  return actions !== null && unresolvedRequestsOf(actions).length > 0;
}

function failureDescriptionOf(failure: MissionNodeCheckFailure): string {
  const { code, message } = failure.error.error;
  return `${message} (${code})`;
}

export function useNodeCheck(
  node: MissionRunnableNode,
  missionVersion: number,
  actions: readonly MissionExternalAction[] | null,
  markActed: () => void,
  reload: () => void,
): NodeCheckState {
  const [checking, setChecking] = useState(false);
  const latest = useRef<() => void>(() => undefined);
  const [label, setLabel] = useState<string | null>(null);
  const available = isCheckable(node, actions);

  const check = useCallback(
    function run() {
      if (checking || !isCheckable(node, actions)) return;
      setChecking(true);
      setLabel(CHECKING_LABEL);
      checkNode(node.id, { expected_mission_version: missionVersion }).then(
        (answer) => {
          setChecking(false);
          setLabel(checkLabelOf(answer));
          for (const failure of answer.failures) {
            toast.error(`A request of ${node.content.name} could not be checked.`, {
              description: failureDescriptionOf(failure),
              action: { label: "Retry", onClick: () => latest.current() },
            });
          }
          markActed();
          reload();
        },
        (cause: unknown) => {
          setChecking(false);
          setLabel(null);
          const failure = asApiError(cause);
          const conflict = CONFLICT_MESSAGES[failure.detail];
          if (conflict === undefined) {
            toast.error(`Checking ${node.content.name} failed.`, {
              description: failure.message,
              action: { label: "Retry", onClick: () => latest.current() },
            });
            return;
          }
          toast.error(conflict);
          reload();
        },
      );
    },
    [checking, node, actions, missionVersion, reload, markActed],
  );

  useEffect(() => {
    latest.current = check;
  });

  return { available, checking, label, check };
}
