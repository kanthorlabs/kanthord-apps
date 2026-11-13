import type { Project } from "@/api/types";
import { ProjectPauseDialog } from "@/components/project-pause-dialog";
import { useProjectDetail } from "@/features/projects/view/use-project-detail";
import { projectChangeLineOf, readFailureLineOf } from "@/lib/workbench-action";
import { useActLine } from "../use-act-line";
import { useDialogClosed } from "../use-dialog-closed";
import { useProjectAct } from "../use-project-act";
import type { ActionActProps } from "./action-act-props";
import { StatusLine } from "./status-line";

interface ProjectActRunProps extends ActionActProps {
  readonly project: Project;
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

export function ProjectAct({ offer, onSettled, onLine, onDialogClosed }: ActionActProps) {
  const read = useProjectDetail(offer.target_id);
  const changed = read.data === null ? null : projectChangeLineOf(offer, read.data);
  const line = read.error === null ? changed : readFailureLineOf(offer, read.error.message);
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
