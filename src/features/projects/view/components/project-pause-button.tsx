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

  return (
    <Button variant="outline" size="sm" disabled={busy} onClick={toggle}>
      <Icon aria-hidden="true" data-icon="inline-start" />
      {paused ? "Resume" : "Pause"}
    </Button>
  );
}
