import { Button } from "@/components/ui/button";
import { NodeDiscardDialog } from "@/components/node-discard-dialog";
import { NodeOverrideDialog } from "@/components/node-override-dialog";
import { NodePauseDialog } from "@/components/node-pause-dialog";
import { NodeResumeDialog } from "@/components/node-resume-dialog";
import { NodeUnblockDialog } from "@/components/node-unblock-dialog";

import { type NodeControlsInput, useNodeControls } from "../use-node-controls";

export function NodeControls(input: NodeControlsInput) {
  const { pause, unblock, resume, override, discard, guardLine, retry, visible } =
    useNodeControls(input);
  const name = input.node.content.name;

  if (!visible) return null;

  return (
    <section aria-label="Controls" className="flex flex-col gap-2">
      <h3 className="font-semibold">Controls</h3>
      {guardLine !== null && <p className="text-sm text-muted-foreground">{guardLine}</p>}
      {retry !== null && (
        <div className="flex md:justify-end">
          <Button variant="outline" size="sm" onClick={retry}>
            Retry
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2 md:justify-end">
        {pause.available && (
          <Button variant="outline" size="sm" onClick={pause.request}>
            Pause
          </Button>
        )}
        {unblock.available && (
          <Button variant="outline" size="sm" onClick={unblock.request}>
            Unblock
          </Button>
        )}
        {resume.available && (
          <Button variant="outline" size="sm" onClick={resume.request}>
            Resume
          </Button>
        )}
        {override.available && (
          <Button variant="outline" size="sm" onClick={override.request}>
            Override
          </Button>
        )}
        {discard.available && (
          <Button variant="destructive" size="sm" onClick={discard.request}>
            Discard
          </Button>
        )}
      </div>
      <NodePauseDialog name={name} pause={pause} />
      <NodeUnblockDialog name={name} unblock={unblock} />
      <NodeResumeDialog name={name} resume={resume} />
      <NodeOverrideDialog name={name} override={override} />
      <NodeDiscardDialog name={name} discard={discard} />
    </section>
  );
}
