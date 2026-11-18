import { useCallback, useState } from "react";

import { readMission, readMissionNode } from "@/api/resources/mission";
import { readProject } from "@/api/resources/projects";
import { approveScopeRequest, listInvites, rejectScopeRequest } from "@/api/resources/workbench";
import type { ScopeRequest } from "@/api/types";
import { asApiError, useResource } from "@/hooks/use-resource";
import { type GuestLine, guestLineOf } from "@/lib/guest-chat";
import {
  consequenceOf,
  type ConsequencePart,
  expectedAvailable,
  expectedOf,
  requestedLineOf,
  SAFER_PATH,
  UNAVAILABLE_REASON,
} from "@/lib/scope-request";
import { lockedProjectsOf, projectRefLabel } from "@/lib/share-invite";

const NODE_ID_PREFIX = "node_";
const PROJECT_ID_PREFIX = "project_";
const MISSION_KEY = "expected_mission_version";
const NAME_MISMATCH = "workbench.scope_request.name_mismatch";
const MISMATCH_LINE =
  "The typed name does not match the project name. The dialog read the project again.";
const FAILED_LINE = "The act failed.";

export interface ScopeRequestReview {
  readonly requestedLine: string;
  readonly confirmName: string | null;
  readonly typed: string;
  readonly matches: boolean;
  readonly settled: boolean;
  readonly readFailure: string | null;
  readonly available: boolean;
  readonly unavailableReason: string | null;
  readonly canApprove: boolean;
  readonly facts: readonly string[];
  readonly sharedNames: readonly string[];
  readonly consequence: readonly ConsequencePart[] | null;
  readonly saferPath: string;
  readonly pending: boolean;
  readonly failure: GuestLine | null;
  readonly setTyped: (value: string) => void;
  readonly approve: () => Promise<void>;
  readonly reject: () => Promise<void>;
}

export function useScopeRequestReview(
  sessionId: string,
  request: ScopeRequest,
  onDone: () => void,
): ScopeRequestReview {
  const [typed, setTypedValue] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<GuestLine | null>(null);
  const nodeIds = request.ids.filter((id) => id.startsWith(NODE_ID_PREFIX));
  const nodeKey = nodeIds.join();
  const holdsProject = request.ids.some((id) => id.startsWith(PROJECT_ID_PREFIX));
  const project = useResource(() => readProject(request.project_id), [request.project_id]);
  const { reload: reloadProject } = project;
  const needsMission = request.expected_keys.includes(MISSION_KEY);
  const mission = useResource(
    () => (needsMission ? readMission(request.project_id) : Promise.resolve(null)),
    [request.project_id, needsMission],
  );
  const nodes = useResource(
    () => Promise.all(nodeIds.map((nodeId) => readMissionNode(nodeId))),
    [nodeKey],
  );
  const invites = useResource(() => listInvites(sessionId), [sessionId]);
  const reads = [project, mission, nodes, invites];
  const settled = reads.every((read) => !read.loading);
  const readFailure = reads.find((read) => read.error !== null)?.error?.message ?? null;
  const ready = settled && readFailure === null;
  const confirmName = project.data?.name ?? null;
  const matches = confirmName !== null && confirmName !== "" && typed === confirmName;
  const available = expectedAvailable(request.expected_keys, nodeIds.length > 0);
  const missionVersion = mission.data?.version ?? null;
  const expected =
    ready && available && (!needsMission || missionVersion !== null)
      ? expectedOf(request.expected_keys, {
          missionVersion,
          node: nodes.data?.find((node) => node.id === request.target_id) ?? null,
        })
      : null;
  const canApprove =
    request.state === "open" && ready && available && matches && expected !== null && !pending;
  const facts = [
    ...(nodes.data ?? []).map(
      (node) => `Node ${node.content.name} · ${node.state} · attempt ${node.attempt}`,
    ),
    holdsProject && project.data !== null
      ? `Project ${project.data.name} · ${project.data.paused_at === null ? "running" : "paused"}`
      : null,
  ].filter((fact) => fact !== null);
  const sharedNames = invites.data
    ? (lockedProjectsOf(invites.data.project_ids, invites.data.items) ?? []).map(projectRefLabel)
    : [];

  const setTyped = useCallback((value: string) => {
    setTypedValue(value);
    setFailure(null);
  }, []);

  const approve = useCallback(async () => {
    if (!canApprove || expected === null) return;
    setPending(true);
    setFailure(null);
    try {
      const result = await approveScopeRequest(sessionId, request.id, {
        project_name: typed,
        expected,
      });
      if (result.outcome === "done") return onDone();
      setFailure({ code: result.error_code, message: FAILED_LINE });
    } catch (cause) {
      const error = asApiError(cause);
      if (error.detail === NAME_MISMATCH) {
        setFailure({ code: NAME_MISMATCH, message: MISMATCH_LINE });
        reloadProject();
      } else {
        setFailure(guestLineOf(error));
      }
    } finally {
      setPending(false);
    }
  }, [canApprove, expected, sessionId, request.id, typed, onDone, reloadProject]);

  const reject = useCallback(async () => {
    setPending(true);
    setFailure(null);
    try {
      await rejectScopeRequest(sessionId, request.id);
      onDone();
    } catch (cause) {
      setFailure(guestLineOf(asApiError(cause)));
    } finally {
      setPending(false);
    }
  }, [sessionId, request.id, onDone]);

  return {
    requestedLine: requestedLineOf(request),
    confirmName,
    typed,
    matches,
    settled,
    readFailure,
    available,
    unavailableReason: available ? null : UNAVAILABLE_REASON,
    canApprove,
    facts,
    sharedNames,
    consequence: confirmName === null ? null : consequenceOf(request, confirmName),
    saferPath: SAFER_PATH,
    pending,
    failure,
    setTyped,
    approve,
    reject,
  };
}
