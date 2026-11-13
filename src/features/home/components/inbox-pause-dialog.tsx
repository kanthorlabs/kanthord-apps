import { useEffect, useRef } from "react";
import { toast } from "sonner";

import { NodePauseDialog } from "@/components/node-pause-dialog";
import type { MissionNodeRecord } from "@/api/types";
import { useNodePause } from "@/hooks/use-node-pause";

interface InboxPauseDialogProps {
  readonly node: MissionNodeRecord;
  readonly missionVersion: number;
  readonly reload: () => void;
  readonly onEnd: () => void;
}

export function InboxPauseDialog({ node, missionVersion, reload, onEnd }: InboxPauseDialogProps) {
  const pause = useNodePause(node, missionVersion, reload);
  const { available, open, request } = pause;
  const started = useRef(false);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      return;
    }
    if (wasOpen.current) {
      onEnd();
      return;
    }
    if (started.current) return;
    started.current = true;
    if (available) {
      request();
      return;
    }
    toast.info(`${node.content.name} is ${node.state}. The node admits no pause.`);
    onEnd();
  }, [available, open, request, onEnd, node.content.name, node.state]);

  return <NodePauseDialog name={node.content.name} pause={pause} />;
}
