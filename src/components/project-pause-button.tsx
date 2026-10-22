import { PauseIcon, PlayIcon } from "lucide-react";

import type { Project } from "@/api/types";
import { Button } from "@/components/ui/button";
import { useProjectPause } from "@/hooks/use-project-pause";

export function ProjectPauseButton({
  project,
  onChanged,
}: {
  project: Project;
  onChanged: () => void;
}) {
  const { paused, busy, toggle } = useProjectPause(project, onChanged);
  const Icon = paused ? PlayIcon : PauseIcon;
  const label = paused ? "Resume" : "Pause";

  return (
    <Button
      variant="outline"
      size="sm"
      aria-label={`${label} ${project.name}`}
      aria-busy={busy}
      disabled={busy}
      onClick={toggle}
    >
      <Icon aria-hidden="true" data-icon="inline-start" />
      {label}
    </Button>
  );
}
