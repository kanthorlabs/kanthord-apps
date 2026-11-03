import { BINDING_PROMPT_AGENTS } from "@/api/types";
import { FieldDescription, FieldError, FieldLegend, FieldSet } from "@/components/ui/field";
import type { InstructionFileView } from "@/lib/instruction-file";
import { type DraftErrors, type RepositoryDraft, withInstructionFile } from "@/lib/binding-draft";
import { INSTRUCTION_FILE_HELP } from "../prompt-help";
import type { PromptPreviewScope } from "../use-prompt-preview";
import { BindingPromptRow } from "./binding-prompt-row";
import { DraftField } from "./draft-field";

interface BindingPromptsFieldsetProps {
  readonly draft: RepositoryDraft;
  readonly errors: DraftErrors;
  readonly instructionFile: InstructionFileView | null;
  readonly instructionFileHint: string | null;
  readonly preview: PromptPreviewScope | null;
  readonly onEdit: (draft: RepositoryDraft) => void;
}

export function BindingPromptsFieldset({
  draft,
  errors,
  instructionFile,
  instructionFileHint,
  preview,
  onEdit,
}: BindingPromptsFieldsetProps) {
  const pathEmpty = draft.prompts.instructionFile.trim() === "";
  return (
    <FieldSet>
      <FieldLegend>Prompts</FieldLegend>
      <FieldDescription>
        These texts join the KanthorD prompt of each native agent that works on this repository. An
        edit creates a new binding revision, so an existing node keeps the old texts until{" "}
        <code>mission node rebind</code>. Onboarding treats the new revision as a changed binding
        and clears <code>environment_from_agent</code>. The Repository prompt joins every agent. A
        Binding prompt joins one agent.
      </FieldDescription>
      <DraftField
        id="binding-instruction-file"
        label="Instruction file"
        value={draft.prompts.instructionFile}
        error={errors["instructionFile"]}
        description={INSTRUCTION_FILE_HELP}
        onChange={(path) => onEdit(withInstructionFile(draft, path))}
      />
      <div aria-live="polite" className="flex min-w-0 flex-col gap-1 empty:hidden">
        {!pathEmpty &&
          instructionFile !== null &&
          (instructionFile.problem ? (
            <FieldError>{instructionFile.text}</FieldError>
          ) : (
            <FieldDescription className="break-all">{instructionFile.text}</FieldDescription>
          ))}
        {pathEmpty && instructionFileHint !== null && (
          <FieldDescription>{instructionFileHint}</FieldDescription>
        )}
      </div>
      <div role="list" aria-label="Prompts" className="grid grid-cols-[minmax(0,1fr)] gap-2">
        <BindingPromptRow target="repository" draft={draft} preview={preview} onEdit={onEdit} />
        {BINDING_PROMPT_AGENTS.map((agent) => (
          <BindingPromptRow
            key={agent}
            target={agent}
            draft={draft}
            preview={preview}
            onEdit={onEdit}
          />
        ))}
      </div>
    </FieldSet>
  );
}
