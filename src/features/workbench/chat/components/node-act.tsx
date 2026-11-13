import type { MissionNodeRecord } from "@/api/types";
import { NodeDiscardDialog } from "@/components/node-discard-dialog";
import { NodeOverrideDialog } from "@/components/node-override-dialog";
import { NodePauseDialog } from "@/components/node-pause-dialog";
import { NodeResumeDialog } from "@/components/node-resume-dialog";
import { NodeUnblockDialog } from "@/components/node-unblock-dialog";
import { useNodeRecord } from "@/features/projects/view/use-node-record";
import { nodeChangeLineOf, readFailureLineOf } from "@/lib/workbench-action";
import { useActLine } from "../use-act-line";
import { useDialogClosed } from "../use-dialog-closed";
import { useNodeAct } from "../use-node-act";
import { useNodeProject } from "../use-node-project";
import type { ActionActProps } from "./action-act-props";
import { StatusLine } from "./status-line";

interface NodeActRunProps extends ActionActProps {
  readonly node: MissionNodeRecord;
  readonly projectId: string;
}

function NodeActRun({
  offer,
  onSettled,
  onLine,
  onDialogClosed,
  node,
  projectId,
}: NodeActRunProps) {
  const { phase, failure, controls, check } = useNodeAct(
    offer.operation_id,
    node,
    projectId,
    onSettled,
  );
  const name = node.content.name;
  useActLine(failure === null ? null : readFailureLineOf(offer, failure.message), onLine);
  useDialogClosed(
    controls.pause.open ||
      controls.unblock.open ||
      controls.resume.open ||
      controls.override.open ||
      controls.discard.open,
    onDialogClosed,
  );
  return (
    <>
      {phase === "reading" && <StatusLine text={`Reading ${offer.target_id}.`} />}
      {phase === "unavailable" && (
        <StatusLine text={`Not available: ${offer.target_id} is ${node.state}.`} />
      )}
      {check.label !== null && <StatusLine text={check.label} />}
      <NodePauseDialog name={name} pause={controls.pause} />
      <NodeUnblockDialog name={name} unblock={controls.unblock} />
      <NodeResumeDialog name={name} resume={controls.resume} />
      <NodeOverrideDialog name={name} override={controls.override} />
      <NodeDiscardDialog name={name} discard={controls.discard} />
    </>
  );
}

export function NodeAct({ offer, onSettled, onLine, onDialogClosed }: ActionActProps) {
  const record = useNodeRecord(offer.target_id);
  const node = record.data;
  const project = useNodeProject(node?.mission_id ?? null);
  const failure = record.error ?? project.error;
  const changed = node === null ? null : nodeChangeLineOf(offer, node);
  const line = failure === null ? changed : readFailureLineOf(offer, failure.message);
  useActLine(line, onLine);
  if (line !== null) return null;
  if (node === null || project.data === null)
    return <StatusLine text={`Reading ${offer.target_id}.`} />;
  return (
    <NodeActRun
      offer={offer}
      onSettled={onSettled}
      onLine={onLine}
      onDialogClosed={onDialogClosed}
      node={node}
      projectId={project.data}
    />
  );
}
