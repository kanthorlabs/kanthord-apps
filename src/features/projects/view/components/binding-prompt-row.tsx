import { PencilIcon } from "lucide-react";

import type { BindingPromptAgent } from "@/api/types";
import { PromptItem } from "@/components/prompt-item";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { withBindingPrompt, type RepositoryDraft } from "@/lib/binding-draft";
import { useBindingPromptDialog } from "../use-binding-prompt-dialog";
import { BindingPromptDialog } from "./binding-prompt-dialog";

interface BindingPromptRowProps {
  readonly agent: BindingPromptAgent;
  readonly draft: RepositoryDraft;
  readonly onEdit: (draft: RepositoryDraft) => void;
}

export function BindingPromptRow({ agent, draft, onEdit }: BindingPromptRowProps) {
  const text = draft.prompts[agent];
  const dialog = useBindingPromptDialog(agent, text, (next) =>
    onEdit(withBindingPrompt(draft, agent, next)),
  );
  const filled = text.trim() !== "";
  return (
    <>
      <PromptItem
        title={agent}
        path
        text={filled ? text : null}
        badges={
          <Badge variant={filled ? "default" : "secondary"}>{filled ? "set" : "empty"}</Badge>
        }
        control={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit Binding prompt of ${agent}`}
            onClick={dialog.start}
          >
            <PencilIcon aria-hidden="true" />
          </Button>
        }
      />
      <BindingPromptDialog dialog={dialog} />
    </>
  );
}
