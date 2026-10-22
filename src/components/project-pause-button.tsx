import { PauseIcon, PlayIcon } from "lucide-react";

import type { Project } from "@/api/types";
import { ProjectPauseDialog } from "@/components/project-pause-dialog";
import { Button } from "@/components/ui/button";
import { useProjectPause } from "@/hooks/use-project-pause";

export function ProjectPauseButton({
  project,
  onChanged,
}: {
  project: Project;
  onChanged: () => void;
}) {
  const pause = useProjectPause(project, onChanged);
  const Icon = pause.paused ? PlayIcon : PauseIcon;
  const label = pause.paused ? "Resume" : "Pause";

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-label={`${label} ${project.name}`}
        aria-busy={pause.busy}
        disabled={pause.busy}
        onClick={pause.toggle}
      >
        <Icon aria-hidden="true" data-icon="inline-start" />
        {label}
      </Button>
      <ProjectPauseDialog name={project.name} pause={pause} />
    </>
  );
}
