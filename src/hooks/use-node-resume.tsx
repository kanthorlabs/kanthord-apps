import { useCallback, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { resumeNode } from "@/api/resources/mission";
import type { MissionExternalAction, MissionNodeRecord, MissionRunnableNode } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { asApiError } from "@/hooks/use-resource";
import type { PauseCause } from "@/lib/execution-stop";
import {
  choosesTarget,
  defaultTargetOf,
  resumeEndOf,
  resumeNotesOf,
  waitingNeedsOf,
  type ResumeContext,
  type ResumeEnd,
  type ResumeNote,
  type ResumeTarget,
  type WaitingNeed,
} from "@/lib/resume-target";

export interface NodeResumeState {
  readonly available: boolean;
  readonly open: boolean;
  readonly reason: string;
  readonly missing: string | null;
  readonly target: ResumeTarget;
  readonly choice: boolean;
  readonly waitingNeeds: ReactNode;
  readonly error: string | null;
  readonly resuming: boolean;
  readonly consequence: ReactNode;
  readonly notes: readonly ReactNode[];
  readonly saferPath: ReactNode;
  readonly request: () => void;
  readonly setReason: (reason: string) => void;
  readonly setTarget: (target: ResumeTarget) => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

const CONFLICT_MESSAGES: Readonly<Record<string, string>> = {
  "mission.node.state_conflict":
    "The state or the attempt of the node changed after this read. The view now shows its current state. Review it and resume again.",
  "mission.node.control_refused":
    "The node is no longer Paused. The view now shows its current state.",
  "mission.node.not_ready":
    "The node is not ready for its evaluation. The view now shows its current state. Resume to Available instead.",
  "mission.version.conflict":
    "The mission changed after this read. The view now shows the current mission. Review the node and resume again.",
  "mission.node.retired": "The node is retired. The view now shows its current state.",
  "mission.node.terminal": "The node is terminal. The view now shows its current state.",
};

function isResumable(node: MissionRunnableNode, actions: readonly MissionExternalAction[] | null) {
  return node.retired_at === null && node.state === "Paused" && actions !== null;
}

function needText(need: WaitingNeed): ReactNode {
  if (need.kind === "objectives") return "every objective of the initiative to be terminal";
  if (need.kind === "requests") return "every request of the open attempt to reach its end state";
  return (
    <>
      <RecordName>{need.name}</RecordName> to be Completed
    </>
  );
}

function needsOf(needs: readonly WaitingNeed[]): ReactNode {
  return needs.map((need, index) => (
    <span key={`${need.kind}-${index}`}>
      {index > 0 && ", "}
      {needText(need)}
    </span>
  ));
}

function consequenceOf(node: MissionRunnableNode, end: ResumeEnd): ReactNode {
  const name = <RecordName>{node.content.name}</RecordName>;
  if (end.kind === "external-failed") {
    return <>Resume moves {name} to External.Failed, and its attempt then closes.</>;
  }
  if (end.kind === "external-success") return <>Resume moves {name} to External.Success.</>;
  if (end.kind === "external-requested") {
    return (
      <>
        Resume returns {name} to External.Requested,{" "}
        {end.open
          ? "because its request is still open."
          : "because a required action has not reached its expected end."}
      </>
    );
  }
  if (end.kind === "pending") {
    return (
      <>
        Resume returns {name} to Pending, because <RecordName>{end.dependency}</RecordName> is not
        Completed.
      </>
    );
  }
  if (end.kind === "waiting") return <>Resume returns {name} to Waiting for its evaluation.</>;
  return <>Resume returns {name} to Available.</>;
}

function noteOf(node: MissionRunnableNode, note: ResumeNote): ReactNode {
  if (note === "failure-count") {
    return "A resume resets no failure count, so it grants one more try.";
  }
  return (
    <>
      A resume resets no stall count. The next execution that ends at its budget pauses{" "}
      <RecordName>{node.content.name}</RecordName> again. To accept the work done, resume to
      Waiting.
    </>
  );
}

export function useNodeResume(
  node: MissionRunnableNode,
  missionVersion: number,
  nodes: readonly MissionNodeRecord[],
  actions: readonly MissionExternalAction[] | null,
  cause: PauseCause | null,
  reload: () => void,
): NodeResumeState {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [chosen, setChosen] = useState<ResumeTarget | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);
  const available = isResumable(node, actions);
  const trimmed = reason.trim();
  const context: ResumeContext = { node, nodes, actions: actions ?? [], cause };
  const needs = waitingNeedsOf(context);
  const wanted = chosen ?? defaultTargetOf(context);
  const target: ResumeTarget = wanted === "Waiting" && needs.length > 0 ? "Available" : wanted;
  const end = resumeEndOf(context, target);

  const request = useCallback(() => {
    if (!isResumable(node, actions)) return;
    setError(null);
    setReason("");
    setChosen(null);
    setOpen(true);
  }, [node, actions]);

  const cancel = useCallback(() => {
    if (resuming) return;
    setOpen(false);
    setError(null);
  }, [resuming]);

  const confirm = () => {
    if (resuming || !open || trimmed.length === 0) return;
    if (!isResumable(node, actions)) {
      setOpen(false);
      return;
    }
    setResuming(true);
    setError(null);
    resumeNode(node.id, {
      reason: trimmed,
      expected_mission_version: missionVersion,
      expected_state: node.state,
      expected_attempt: node.attempt,
      target,
    }).then(
      () => {
        setResuming(false);
        toast.success(`Resumed ${node.content.name}.`, {
          description: "The node left Paused. The view shows its new state.",
        });
        setOpen(false);
        reload();
      },
      (cause: unknown) => {
        setResuming(false);
        const failure = asApiError(cause);
        const message = CONFLICT_MESSAGES[failure.detail] ?? failure.message;
        setError(message);
        toast.error(`Resuming ${node.content.name} failed.`, { description: message });
        reload();
      },
    );
  };

  return {
    available,
    open,
    reason,
    missing: trimmed.length === 0 ? "Fill Reason to resume." : null,
    target,
    choice: choosesTarget(end),
    waitingNeeds: needs.length === 0 ? null : needsOf(needs),
    error,
    resuming,
    consequence: consequenceOf(node, end),
    notes: resumeNotesOf(context, target).map((note) => noteOf(node, note)),
    saferPath: <>To keep it held, cancel.</>,
    request,
    setReason,
    setTarget: setChosen,
    cancel,
    confirm,
  };
}
