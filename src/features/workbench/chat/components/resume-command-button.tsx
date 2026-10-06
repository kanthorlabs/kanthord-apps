import { TerminalIcon } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useCopyCommand } from "../use-copy-command";

export function ResumeCommandButton({ command }: { command: string }) {
  const [open, setOpen] = useState(false);
  const copy = useCopyCommand(command);

  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger
        render={
          <Button
            variant="outline"
            size="icon-sm"
            aria-label="Copy pi resume command"
            onClick={copy}
          />
        }
        onPointerUp={() => setOpen(true)}
      >
        <TerminalIcon aria-hidden="true" />
      </TooltipTrigger>
      <TooltipContent className="max-w-sm">
        <p>
          Continues this session in your own pi, with your pi login, prompt and tools. Close it
          before you write here again.
        </p>
        <p className="font-mono break-all">{command}</p>
      </TooltipContent>
    </Tooltip>
  );
}
