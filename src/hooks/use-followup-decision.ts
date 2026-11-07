import { useCallback, useState } from "react";
import { toast } from "sonner";

import { decideFollowup, listNodeLinkUpdates, readNodeRevision } from "@/api/resources/mission";
import type {
  MissionFollowupDecideBody,
  MissionFollowupProposal,
  MissionLinkUpdate,
  MissionNodeRecord,
  MissionRevision,
} from "@/api/types";
import { asApiError, type Resource, useResource } from "@/hooks/use-resource";

const NEWEST_UPDATES = 5;
const NO_UPDATES: readonly MissionLinkUpdate[] = [];

export interface ProposedRevision {
  readonly proposalId: string;
  readonly revision: MissionRevision;
}

export interface FollowupDecisionState {
  readonly open: boolean;
  readonly proposals: readonly MissionFollowupProposal[];
  readonly updates: Resource<readonly MissionLinkUpdate[]>;
  readonly revisions: Resource<readonly ProposedRevision[] | null>;
  readonly requirement: string;
  readonly criterion: string;
  readonly reason: string;
  readonly error: string | null;
  readonly deciding: boolean;
  readonly available: boolean;
  readonly setRequirement: (requirement: string) => void;
  readonly setCriterion: (criterion: string) => void;
  readonly setReason: (reason: string) => void;
  readonly request: () => void;
  readonly cancel: () => void;
  readonly approve: () => void;
  readonly reject: () => void;
}

const CONFLICT_MESSAGES: Readonly<Record<string, string>> = {
  "mission.version.conflict":
    "The mission changed after this read. The view now shows the current mission. Review the proposal and decide again.",
};

function optional(text: string): string | undefined {
  const trimmed = text.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

async function readNewestUpdates(nodeId: string): Promise<readonly MissionLinkUpdate[]> {
  return (await listNodeLinkUpdates(nodeId)).slice(0, NEWEST_UPDATES);
}

function readProposedRevisions(
  proposals: readonly MissionFollowupProposal[],
): Promise<readonly ProposedRevision[]> {
  return Promise.all(
    proposals.map(async (proposal) => ({
      proposalId: proposal.id,
      revision: await readNodeRevision(proposal.node_id, proposal.content.node_revision),
    })),
  );
}

export function useFollowupDecision(
  node: MissionNodeRecord,
  proposals: readonly MissionFollowupProposal[],
  missionVersion: number,
  reload: () => void,
): FollowupDecisionState {
  const [open, setOpen] = useState(false);
  const [requirement, setRequirement] = useState("");
  const [criterion, setCriterion] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deciding, setDeciding] = useState(false);
  const available = proposals.length > 0 && node.retired_at === null;
  const nodeId = node.id;
  const updates = useResource(
    () => (open ? readNewestUpdates(nodeId) : Promise.resolve(NO_UPDATES)),
    [nodeId, open],
  );

  const proposalKey = proposals
    .map((proposal) => `${proposal.id}:${proposal.node_id}:${proposal.content.node_revision}`)
    .join(",");
  const revisions = useResource(
    () => (open ? readProposedRevisions(proposals) : Promise.resolve(null)),
    [proposalKey, open],
  );

  const request = useCallback(() => {
    if (!available) return;
    setError(null);
    setRequirement("");
    setCriterion("");
    setReason("");
    setOpen(true);
  }, [available]);

  const cancel = useCallback(() => {
    if (deciding) return;
    setOpen(false);
    setError(null);
  }, [deciding]);

  const decide = useCallback(
    (body: MissionFollowupDecideBody, done: string) => {
      if (deciding || !open || !available) return;
      setDeciding(true);
      setError(null);
      decideFollowup(nodeId, body).then(
        () => {
          setDeciding(false);
          toast.success(`${done} ${node.content.name}.`);
          setOpen(false);
          reload();
        },
        (cause: unknown) => {
          setDeciding(false);
          const failure = asApiError(cause);
          const message = CONFLICT_MESSAGES[failure.detail] ?? failure.message;
          setError(message);
          toast.error(`Deciding the follow-up proposal of ${node.content.name} failed.`, {
            description: message,
          });
          reload();
        },
      );
    },
    [deciding, open, available, nodeId, node.content.name, reload],
  );

  const approve = useCallback(() => {
    const body: MissionFollowupDecideBody = {
      expected_mission_version: missionVersion,
      approve: true,
      ...(optional(requirement) === undefined ? {} : { requirement: optional(requirement) }),
      ...(optional(criterion) === undefined ? {} : { criterion: optional(criterion) }),
      ...(optional(reason) === undefined ? {} : { reason: optional(reason) }),
    };
    decide(body, "Created a follow-up node for");
  }, [decide, missionVersion, requirement, criterion, reason]);

  const reject = useCallback(() => {
    const body: MissionFollowupDecideBody = {
      expected_mission_version: missionVersion,
      approve: false,
      ...(optional(reason) === undefined ? {} : { reason: optional(reason) }),
    };
    decide(body, "Rejected the follow-up proposal of");
  }, [decide, missionVersion, reason]);

  return {
    open,
    proposals,
    updates,
    revisions,
    requirement,
    criterion,
    reason,
    error,
    deciding,
    available,
    setRequirement,
    setCriterion,
    setReason,
    request,
    cancel,
    approve,
    reject,
  };
}
