import type { MissionNodeRecord, Project, WorkbenchActionOffer } from "@/api/types";
import { NodeDiscardDialog } from "@/components/node-discard-dialog";
import { NodeOverrideDialog } from "@/components/node-override-dialog";
import { NodePauseDialog } from "@/components/node-pause-dialog";
import { NodeResumeDialog } from "@/components/node-resume-dialog";
import { NodeUnblockDialog } from "@/components/node-unblock-dialog";
import { ProjectPauseDialog } from "@/components/project-pause-dialog";
import { useNodeRecord } from "@/features/projects/view/use-node-record";
import { useProjectDetail } from "@/features/projects/view/use-project-detail";
import type { ActResult } from "@/hooks/act-result";
import { nodeChangeLineOf, projectChangeLineOf } from "@/lib/workbench-action";
import { useNodeAct } from "../use-node-act";
import { useNodeProject } from "../use-node-project";
import { useProjectAct } from "../use-project-act";
import { InlineError } from "./inline-error";

interface ActionActProps {
  readonly offer: WorkbenchActionOffer;
  readonly onSettled: (result: ActResult) => void;
}

interface NodeActRunProps extends ActionActProps {
  readonly node: MissionNodeRecord;
  readonly projectId: string;
}

interface ProjectActRunProps extends ActionActProps {
  readonly project: Project;
}

function StatusLine({ text }: { readonly text: string }) {
  return (
    <p role="status" className="min-w-0 text-sm break-words text-muted-foreground">
      {text}
    </p>
  );
}

function NodeActRun({ offer, onSettled, node, projectId }: NodeActRunProps) {
  const { phase, failure, controls, check } = useNodeAct(
    offer.operation_id,
    node,
    projectId,
    onSettled,
  );
  const name = node.content.name;
  return (
    <>
      {phase === "reading" && <StatusLine text={`Reading ${offer.target_id}.`} />}
      {failure !== null && (
        <InlineError code={null} message={`${offer.target_id} was not read: ${failure.message}`} />
      )}
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

function NodeAct({ offer, onSettled }: ActionActProps) {
  const record = useNodeRecord(offer.target_id);
  const node = record.data;
  const project = useNodeProject(node?.mission_id ?? null);
  const failure = record.error ?? project.error;
  if (failure !== null) {
    return (
      <InlineError code={null} message={`${offer.target_id} was not read: ${failure.message}`} />
    );
  }
  if (node === null || project.data === null)
    return <StatusLine text={`Reading ${offer.target_id}.`} />;
  const changed = nodeChangeLineOf(offer, node);
  if (changed !== null) return <StatusLine text={changed} />;
  return <NodeActRun offer={offer} onSettled={onSettled} node={node} projectId={project.data} />;
}

function ProjectActRun({ offer, onSettled, project }: ProjectActRunProps) {
  const { available, pause } = useProjectAct(offer.operation_id, project, onSettled);
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

function ProjectAct({ offer, onSettled }: ActionActProps) {
  const read = useProjectDetail(offer.target_id);
  if (read.error !== null) {
    return (
      <InlineError code={null} message={`${offer.target_id} was not read: ${read.error.message}`} />
    );
  }
  if (read.data === null) return <StatusLine text={`Reading ${offer.target_id}.`} />;
  const changed = projectChangeLineOf(offer, read.data);
  if (changed !== null) return <StatusLine text={changed} />;
  return <ProjectActRun offer={offer} onSettled={onSettled} project={read.data} />;
}

export function ActionAct({ offer, onSettled }: ActionActProps) {
  if (offer.operation_id.startsWith("project.")) {
    return <ProjectAct offer={offer} onSettled={onSettled} />;
  }
  return <NodeAct offer={offer} onSettled={onSettled} />;
}
