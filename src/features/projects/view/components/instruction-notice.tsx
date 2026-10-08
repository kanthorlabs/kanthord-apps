import { Skeleton } from "@/components/ui/skeleton";
import {
  holdsNoInstructionFile,
  INSTRUCTION_FILE_NAMES,
  noInstructionFileLine,
} from "@/lib/instruction-files";
import type { InstructionFilesState } from "../use-instruction-files";
import { InstructionRefusal } from "./instruction-refusal";

interface InstructionNoticeProps {
  readonly state: InstructionFilesState;
  readonly bindingName: string;
  readonly baseBranch: string;
  readonly sshCredential: string;
}

export function InstructionNotice({
  state,
  bindingName,
  baseBranch,
  sshCredential,
}: InstructionNoticeProps) {
  const { view } = state;
  if (view.status === "unsaved") {
    return (
      <p className="text-sm text-muted-foreground">
        Save the binding to read its instruction files.
      </p>
    );
  }
  if (view.status === "loading") {
    return (
      <div role="status" aria-label="Reading the instruction files" className="flex flex-col gap-2">
        {Object.values(INSTRUCTION_FILE_NAMES).map((name) => (
          <Skeleton key={name} className="h-10 w-full" />
        ))}
      </div>
    );
  }
  if (view.status === "refused") {
    return (
      <InstructionRefusal
        error={view.error}
        sshCredential={sshCredential}
        onRetry={state.refresh}
      />
    );
  }
  if (holdsNoInstructionFile(view.files.files)) {
    return (
      <p className="text-sm text-muted-foreground">
        {noInstructionFileLine(bindingName, baseBranch)}
      </p>
    );
  }
  return null;
}
