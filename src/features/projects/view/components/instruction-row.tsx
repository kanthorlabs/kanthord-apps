import type { ReactNode } from "react";

import type { InstructionFileState } from "@/api/types";
import { PromptItem } from "@/components/prompt-item";
import { SourceSwitch } from "@/components/source-switch";
import { Badge } from "@/components/ui/badge";

interface InstructionRowProps {
  readonly title: string;
  readonly path?: boolean;
  readonly text: string | null;
  readonly state: InstructionFileState;
  readonly reason?: string | null;
  readonly enabled: boolean;
  readonly onToggle: (enabled: boolean) => void;
  readonly control?: ReactNode;
}

const STATE_VARIANTS = {
  present: "default",
  absent: "secondary",
  invalid: "destructive",
} as const;

export function InstructionRow({
  title,
  path,
  text,
  state,
  reason = null,
  enabled,
  onToggle,
  control,
}: InstructionRowProps) {
  return (
    <div className="flex flex-col gap-1">
      <PromptItem
        title={title}
        path={path}
        text={state === "present" ? text : null}
        dimmed={!enabled}
        badges={
          <>
            <Badge variant={STATE_VARIANTS[state]}>{state}</Badge>
            {!enabled && <Badge variant="outline">off</Badge>}
          </>
        }
        control={
          <>
            {control}
            <SourceSwitch
              title={title}
              checked={enabled}
              disabled={false}
              lockedReason={null}
              onChange={onToggle}
            />
          </>
        }
      />
      {reason !== null && (
        <p className="px-3 text-sm break-words text-muted-foreground">{reason}</p>
      )}
    </div>
  );
}
