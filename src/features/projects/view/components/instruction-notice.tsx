import { Spinner } from "@/components/ui/spinner";
import {
  holdsNoInstructionFile,
  noInstructionFileLine,
  readingInstructionFilesLine,
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
      <div
        role="status"
        aria-live="polite"
        aria-label="Reading the instruction files"
        className="flex items-start gap-2 text-sm"
      >
        <Spinner aria-hidden="true" role="presentation" className="mt-0.5 shrink-0" />
        <div className="flex min-w-0 flex-col gap-1">
          <p>Reading the instruction files from {baseBranch}.</p>
          <p className="text-muted-foreground">{readingInstructionFilesLine(bindingName)}</p>
        </div>
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
