import type { ReactNode } from "react";

import { MarkdownText } from "@/components/markdown-text";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { FieldDescription, FieldError } from "@/components/ui/field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { PromptEditorState } from "@/hooks/use-prompt-editor";

interface PromptEditorSheetProps {
  readonly title: string;
  readonly description: ReactNode;
  readonly editor: PromptEditorState;
}

function FailureAlert({ editor }: { readonly editor: PromptEditorState }) {
  const failure = editor.failure;
  if (failure === null) return null;
  return (
    <Alert variant="destructive">
      <AlertTitle>
        {failure.conflict ? "The prompt changed elsewhere." : "The custom prompt was not saved."}
      </AlertTitle>
      <AlertDescription className="flex flex-col items-start gap-2">
        {failure.conflict
          ? "Your draft stays here. Load the latest revision, then save again to replace it."
          : failure.message}
        {failure.conflict && (
          <Button type="button" variant="outline" size="sm" onClick={editor.loadLatest}>
            Load latest revision
          </Button>
        )}
      </AlertDescription>
    </Alert>
  );
}

export function PromptEditorSheet({ title, description, editor }: PromptEditorSheetProps) {
  return (
    <>
      <Sheet open={editor.open} onOpenChange={(next) => !next && editor.requestClose()}>
        <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-2xl">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
            <SheetDescription>{description}</SheetDescription>
          </SheetHeader>
          <form
            noValidate
            aria-label={title}
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              editor.save();
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4">
              <FailureAlert editor={editor} />
              <Tabs defaultValue="write" className="flex min-h-0 flex-1 flex-col">
                <TabsList>
                  <TabsTrigger value="write">Write</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                <TabsContent value="write" className="flex min-h-0 flex-1 flex-col gap-2">
                  <Textarea
                    aria-label="Custom prompt markdown"
                    aria-invalid={editor.tooLarge}
                    aria-describedby="prompt-editor-usage"
                    placeholder="Write markdown. An empty text removes the custom prompt."
                    className="min-h-80 flex-1"
                    value={editor.draft}
                    onChange={(event) => editor.setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                        event.preventDefault();
                        editor.save();
                      }
                    }}
                  />
                  <div id="prompt-editor-usage" className="flex flex-wrap justify-between gap-2">
                    {editor.tooLarge ? (
                      <FieldError>The text is above the limit.</FieldError>
                    ) : (
                      <FieldDescription>Markdown. ⌘ or Ctrl with Enter saves.</FieldDescription>
                    )}
                    <FieldDescription>{editor.usage}</FieldDescription>
                  </div>
                </TabsContent>
                <TabsContent value="preview" className="min-h-0 flex-1 overflow-y-auto">
                  {editor.draft.trim() === "" ? (
                    <FieldDescription>Nothing to preview.</FieldDescription>
                  ) : (
                    <MarkdownText text={editor.draft} />
                  )}
                </TabsContent>
              </Tabs>
            </div>
            <SheetFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={editor.requestClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={!editor.canSave}>
                {editor.saving ? "Saving" : "Save custom prompt"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={editor.confirmingDiscard}
        onOpenChange={(next) => !next && editor.keepEditing()}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard the unsaved changes?</AlertDialogTitle>
            <AlertDialogDescription>
              The draft is lost. The saved custom prompt stays as it is.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={editor.discard}>
              Discard draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
