import { RefreshCwIcon } from "lucide-react";

import { RecordName } from "@/components/record-name";
import { Button } from "@/components/ui/button";
import { shortCommit } from "@/lib/instruction-files";
import { relativeAge } from "@/lib/relative-age";
import type { InstructionFilesState } from "../use-instruction-files";

interface InstructionFilesHeaderProps {
  readonly baseBranch: string;
  readonly state: InstructionFilesState;
}

export function InstructionFilesHeader({ baseBranch, state }: InstructionFilesHeaderProps) {
  const { view } = state;
  const readFacts =
    view.status === "ready"
      ? ` · ${shortCommit(view.files.commit)} · read ${relativeAge(view.files.read_at, state.now)}`
      : "";
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="min-w-0 font-mono text-sm break-all text-muted-foreground">
        <RecordName>{baseBranch}</RecordName>
        {readFacts}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={view.status === "loading"}
        onClick={state.refresh}
      >
        <RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
        Refresh
      </Button>
    </div>
  );
}
