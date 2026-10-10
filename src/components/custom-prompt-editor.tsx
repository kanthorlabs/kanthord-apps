import { PencilIcon } from "lucide-react";
import type { ReactNode } from "react";

import { PromptEditorSheet } from "@/components/prompt-editor-sheet";
import { Button } from "@/components/ui/button";
import { usePromptEditor } from "@/hooks/use-prompt-editor";
import type { PromptSettingsState } from "@/hooks/use-prompt-settings";

interface CustomPromptEditorProps {
  readonly title: string;
  readonly description: ReactNode;
  readonly settings: PromptSettingsState;
}

export function CustomPromptEditor({ title, description, settings }: CustomPromptEditorProps) {
  const editor = usePromptEditor(
    settings.settings?.custom_text ?? "",
    settings.saveText,
    settings.reload,
  );
  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${title}`}
        disabled={settings.settings === null}
        onClick={editor.start}
      >
        <PencilIcon aria-hidden="true" />
      </Button>
      <PromptEditorSheet title={`Edit ${title}`} description={description} editor={editor} />
    </>
  );
}
