import { PencilIcon } from "lucide-react";

import { PromptItem } from "@/components/prompt-item";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  type PromptTarget,
  promptTextOf,
  type RepositoryDraft,
  withPromptText,
} from "@/lib/binding-draft";
import { promptTitle } from "../prompt-help";
import { useBindingPromptDialog } from "../use-binding-prompt-dialog";
import type { PromptPreviewScope } from "../use-prompt-preview";
import { BindingPromptDialog } from "./binding-prompt-dialog";

interface BindingPromptRowProps {
  readonly target: PromptTarget;
  readonly draft: RepositoryDraft;
  readonly preview: PromptPreviewScope | null;
  readonly onEdit: (draft: RepositoryDraft) => void;
}

export function BindingPromptRow({ target, draft, preview, onEdit }: BindingPromptRowProps) {
  const text = promptTextOf(draft, target);
  const dialog = useBindingPromptDialog(target, text, (next) =>
    onEdit(withPromptText(draft, target, next)),
  );
  const filled = text.trim() !== "";
  return (
    <>
      <PromptItem
        title={target === "repository" ? "Repository prompt" : `Binding prompt · ${target}`}
        text={filled ? text : null}
        badges={
          <Badge variant={filled ? "default" : "secondary"}>{filled ? "set" : "empty"}</Badge>
        }
        control={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Edit ${promptTitle(target)}`}
            onClick={dialog.start}
          >
            <PencilIcon aria-hidden="true" />
          </Button>
        }
      />
      <BindingPromptDialog dialog={dialog} preview={preview} />
    </>
  );
}
