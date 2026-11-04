import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldDescription, FieldError } from "@/components/ui/field";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { promptHelp, promptTitle } from "../prompt-help";
import type { BindingPromptDialogState } from "../use-binding-prompt-dialog";
import type { PromptPreviewScope } from "../use-prompt-preview";
import { PromptPreviewPanel } from "./prompt-preview-panel";

const PREVIEW_ABSENT = "Save the binding first. The preview reads the stored binding.";

interface BindingPromptDialogProps {
  readonly dialog: BindingPromptDialogState;
  readonly preview: PromptPreviewScope | null;
}

export function BindingPromptDialog({ dialog, preview }: BindingPromptDialogProps) {
  const title = promptTitle(dialog.target);
  const usageId = `binding-prompt-usage-${dialog.target}`;
  return (
    <Dialog open={dialog.open} onOpenChange={(next) => !next && dialog.cancel()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto]">
        <DialogHeader>
          <DialogTitle>Edit {title}</DialogTitle>
          <DialogDescription>
            Markdown for this repository. Apply changes the binding draft only. Save the binding to
            store the text. A prompt holds no secret.
          </DialogDescription>
        </DialogHeader>
        <div className="-m-1 flex min-h-0 min-w-0 flex-col gap-3 overflow-y-auto p-1">
          {promptHelp(dialog.target).map((help) => (
            <FieldDescription key={help}>{help}</FieldDescription>
          ))}
          <Tabs defaultValue="edit" className="flex min-w-0 flex-col gap-3">
            <TabsList>
              <TabsTrigger value="edit">Edit</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="edit" className="flex min-w-0 flex-col gap-2">
              <Textarea
                aria-label={`Markdown of the ${title}`}
                aria-invalid={dialog.problem !== null}
                aria-describedby={usageId}
                className="max-h-[50dvh] min-h-60"
                placeholder="Write markdown. An empty text removes the prompt."
                value={dialog.draft}
                onChange={(event) => dialog.setDraft(event.target.value)}
              />
              <div id={usageId} className="flex flex-wrap justify-between gap-2">
                {dialog.problem !== null ? (
                  <FieldError>{dialog.problem}</FieldError>
                ) : (
                  <FieldDescription>Markdown.</FieldDescription>
                )}
                <FieldDescription>{dialog.usage}</FieldDescription>
              </div>
            </TabsContent>
            <TabsContent value="preview">
              {preview === null ? (
                <p className="text-sm text-muted-foreground">{PREVIEW_ABSENT}</p>
              ) : (
                <PromptPreviewPanel scope={preview} target={dialog.target} text={dialog.draft} />
              )}
            </TabsContent>
          </Tabs>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={dialog.cancel}>
            Cancel
          </Button>
          <Button type="button" disabled={dialog.problem !== null} onClick={dialog.apply}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
