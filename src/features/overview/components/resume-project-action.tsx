import { PlayIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ProjectPausedItem } from "@/lib/fix-attention";

import { useFixActs } from "../use-fix-acts";

interface ResumeProjectActionProps {
  readonly item: ProjectPausedItem;
  readonly reload: () => void;
  readonly markActed: (itemId: string) => void;
}

export function ResumeProjectAction({ item, reload, markActed }: ResumeProjectActionProps) {
  const pause = useFixActs(item, { reload, markActed });

  return (
    <Button variant="outline" size="sm" disabled={pause.busy} onClick={pause.toggle}>
      <PlayIcon aria-hidden="true" data-icon="inline-start" />
      Resume project
    </Button>
  );
}
