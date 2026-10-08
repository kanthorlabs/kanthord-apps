import type { RepositoryBindingConfig, WorkingLayerKey } from "@/api/types";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { withWorkingLayerSwitch, type RepositoryDraft } from "@/lib/binding-draft";
import { holdsNoInstructionFile } from "@/lib/instruction-files";
import { instructionReadAllowed } from "@/lib/instruction-read";
import { useInstructionFiles } from "../use-instruction-files";
import { InstructionFileRows } from "./instruction-file-rows";
import { InstructionFilesHeader } from "./instruction-files-header";
import { InstructionNotice } from "./instruction-notice";
import { ProjectPromptRow } from "./project-prompt-row";

interface RepositoryInstructionsProps {
  readonly projectId: string;
  readonly bindingId: string | null;
  readonly saved: RepositoryBindingConfig | null;
  readonly draft: RepositoryDraft;
  readonly onEdit: (draft: RepositoryDraft) => void;
}

export function RepositoryInstructions({
  projectId,
  bindingId,
  saved,
  draft,
  onEdit,
}: RepositoryInstructionsProps) {
  const state = useInstructionFiles(projectId, bindingId, instructionReadAllowed(saved, draft));
  const { view } = state;
  const toggle = (key: WorkingLayerKey, enabled: boolean) =>
    onEdit(withWorkingLayerSwitch(draft, key, enabled));
  const showFiles = view.status === "ready" && !holdsNoInstructionFile(view.files.files);

  return (
    <FieldSet>
      <FieldLegend>Repository instructions</FieldLegend>
      {view.status !== "unsaved" && (
        <InstructionFilesHeader baseBranch={draft.baseBranch.trim()} state={state} />
      )}
      <InstructionNotice
        state={state}
        bindingName={draft.name}
        baseBranch={draft.baseBranch.trim()}
        sshCredential={draft.sshCredential.trim()}
      />
      <div className="-mb-2 grid grid-cols-[minmax(0,1fr)]">
        <div
          role="list"
          aria-label="Repository instructions"
          className="grid grid-cols-[minmax(0,1fr)]"
        >
          {showFiles && (
            <InstructionFileRows
              files={view.files.files}
              switches={draft.workingLayer}
              absentShown={state.absentShown}
              onShowAbsent={state.showAbsent}
              onToggle={toggle}
            />
          )}
          <div className="pb-2">
            <ProjectPromptRow
              draft={draft}
              onEdit={onEdit}
              onToggle={(enabled) => toggle("project_prompt", enabled)}
            />
          </div>
        </div>
      </div>
    </FieldSet>
  );
}
