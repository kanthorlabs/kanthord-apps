import type { MissionNodeRecord, Project, WorkbenchActionOffer } from "@/api/types";
import { NodeDiscardDialog } from "@/components/node-discard-dialog";
import { NodeOverrideDialog } from "@/components/node-override-dialog";
import { NodePauseDialog } from "@/components/node-pause-dialog";
import { NodeResumeDialog } from "@/components/node-resume-dialog";
import { NodeUnblockDialog } from "@/components/node-unblock-dialog";
import { ProjectPauseDialog } from "@/components/project-pause-dialog";
import { useNodeRecord } from "@/features/projects/view/use-node-record";
import { useProjectDetail } from "@/features/projects/view/use-project-detail";
import type { ApiError } from "@/api/errors";
import type { ActResult } from "@/hooks/act-result";
import { nodeChangeLineOf, projectChangeLineOf } from "@/lib/workbench-action";
import { useActLine } from "../use-act-line";
import { useDialogClosed } from "../use-dialog-closed";
import { useNodeAct } from "../use-node-act";
import { useNodeProject } from "../use-node-project";
import { useProjectAct } from "../use-project-act";

interface ActionActProps {
  readonly offer: WorkbenchActionOffer;
  readonly onSettled: (result: ActResult) => void;
  readonly onLine: (line: string) => void;
  readonly onDialogClosed: () => void;
}

interface NodeActRunProps extends ActionActProps {
  readonly node: MissionNodeRecord;
  readonly projectId: string;
}

interface ProjectActRunProps extends ActionActProps {
  readonly project: Project;
}

function readFailureLine(offer: WorkbenchActionOffer, failure: ApiError): string {
  return `${offer.target_id} was not read: ${failure.message}`;
}

function StatusLine({ text }: { readonly text: string }) {
  return (
    <p role="status" className="min-w-0 text-sm break-words text-muted-foreground">
      {text}
    </p>
  );
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
  useActLine(failure === null ? null : readFailureLine(offer, failure), onLine);
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

function NodeAct({ offer, onSettled, onLine, onDialogClosed }: ActionActProps) {
  const record = useNodeRecord(offer.target_id);
  const node = record.data;
  const project = useNodeProject(node?.mission_id ?? null);
  const failure = record.error ?? project.error;
  const changed = node === null ? null : nodeChangeLineOf(offer, node);
  const line = failure === null ? changed : readFailureLine(offer, failure);
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

function ProjectActRun({ offer, onSettled, onDialogClosed, project }: ProjectActRunProps) {
  const { available, pause } = useProjectAct(offer.operation_id, project, onSettled);
  useDialogClosed(pause.confirming, onDialogClosed);
  return (
    <>
      {!available && (
        <StatusLine
          text={`Not available: ${offer.target_id} is ${project.paused_at === null ? "active" : "paused"}.`}
        />
      )}
      <ProjectPauseDialog name={project.name} pause={pause} />
    </>
  );
}

function ProjectAct({ offer, onSettled, onLine, onDialogClosed }: ActionActProps) {
  const read = useProjectDetail(offer.target_id);
  const changed = read.data === null ? null : projectChangeLineOf(offer, read.data);
  const line = read.error === null ? changed : readFailureLine(offer, read.error);
  useActLine(line, onLine);
  if (line !== null) return null;
  if (read.data === null) return <StatusLine text={`Reading ${offer.target_id}.`} />;
  return (
    <ProjectActRun
      offer={offer}
      onSettled={onSettled}
      onLine={onLine}
      onDialogClosed={onDialogClosed}
      project={read.data}
    />
  );
}

export function ActionAct(props: ActionActProps) {
  if (props.offer.operation_id.startsWith("project.")) return <ProjectAct {...props} />;
  return <NodeAct {...props} />;
}
