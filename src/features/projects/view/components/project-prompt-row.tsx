import { PencilIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { RepositoryDraft } from "@/lib/binding-draft";
import { useProjectPromptDialog } from "../use-project-prompt-dialog";
import { InstructionRow } from "./instruction-row";
import { ProjectPromptDialog } from "./project-prompt-dialog";

const TITLE = "Project prompt";

interface ProjectPromptRowProps {
  readonly draft: RepositoryDraft;
  readonly onEdit: (draft: RepositoryDraft) => void;
  readonly onToggle: (enabled: boolean) => void;
}

export function ProjectPromptRow({ draft, onEdit, onToggle }: ProjectPromptRowProps) {
  const dialog = useProjectPromptDialog(draft.projectPrompt, (projectPrompt) =>
    onEdit({ ...draft, projectPrompt }),
  );
  const filled = draft.projectPrompt.trim() !== "";
  return (
    <>
      <InstructionRow
        title={TITLE}
        text={filled ? draft.projectPrompt : null}
        state={filled ? "present" : "absent"}
        enabled={draft.workingLayer.project_prompt}
        onToggle={onToggle}
        control={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${TITLE}`}
            onClick={dialog.start}
          >
            <PencilIcon aria-hidden="true" />
          </Button>
        }
      />
      <ProjectPromptDialog dialog={dialog} />
    </>
  );
}
