import { RecordName } from "@/components/record-name";
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
import { Textarea } from "@/components/ui/textarea";
import type { ProjectPromptDialogState } from "../use-project-prompt-dialog";

interface ProjectPromptDialogProps {
  readonly dialog: ProjectPromptDialogState;
}

export function ProjectPromptDialog({ dialog }: ProjectPromptDialogProps) {
  return (
    <Dialog open={dialog.open} onOpenChange={(next) => !next && dialog.cancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Binding prompt of {dialog.agent}</DialogTitle>
          <DialogDescription>
            Markdown that joins the Agent prompt of <RecordName>{dialog.agent}</RecordName> for this
            repository. Apply changes the binding draft only. Save the binding to store the text.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          aria-label={`Binding prompt markdown of ${dialog.agent}`}
          aria-invalid={dialog.problem !== null}
          aria-describedby={`binding-prompt-usage-${dialog.agent}`}
          className="max-h-[50dvh] min-h-60"
          placeholder="Write markdown. An empty text removes the Binding prompt."
          value={dialog.draft}
          onChange={(event) => dialog.setDraft(event.target.value)}
        />
        <div
          id={`binding-prompt-usage-${dialog.agent}`}
          className="flex flex-wrap justify-between gap-2"
        >
          {dialog.problem !== null ? (
            <FieldError>{dialog.problem}</FieldError>
          ) : (
            <FieldDescription>Markdown.</FieldDescription>
          )}
          <FieldDescription>{dialog.usage}</FieldDescription>
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
