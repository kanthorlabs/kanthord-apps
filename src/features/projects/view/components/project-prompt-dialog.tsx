import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
          <DialogTitle>Edit Project prompt</DialogTitle>
          <DialogDescription>
            Markdown that agents of this repository read after its instruction files. Apply changes
            the binding draft only. Save the binding to store the text.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          aria-label="Project prompt markdown"
          className="min-h-60"
          placeholder="Write markdown. An empty text removes the project prompt."
          value={dialog.draft}
          onChange={(event) => dialog.setDraft(event.target.value)}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={dialog.cancel}>
            Cancel
          </Button>
          <Button type="button" onClick={dialog.apply}>
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
