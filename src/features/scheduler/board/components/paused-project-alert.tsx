import { PlayIcon } from "lucide-react";

import type { Project } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useProjectPause } from "@/hooks/use-project-pause";

interface PausedProjectAlertProps {
  readonly project: Project;
  readonly onResumed: () => void;
}

export function PausedProjectAlert({ project, onResumed }: PausedProjectAlertProps) {
  const { busy, toggle } = useProjectPause(project, onResumed);
  return (
    <Alert>
      <AlertDescription>
        <RecordName>{project.name}</RecordName> is paused. The scheduler claims no job of it.
      </AlertDescription>
      <div className="mt-2 flex md:justify-end">
        <Button variant="outline" size="sm" disabled={busy} onClick={toggle}>
          <PlayIcon aria-hidden="true" data-icon="inline-start" />
          Resume project
        </Button>
      </div>
    </Alert>
  );
}
