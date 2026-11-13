import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SnoozeChoice } from "@/lib/inbox-snooze";

interface InboxSnoozeDialogProps {
  readonly subject: string;
  readonly choices: readonly SnoozeChoice[];
  readonly busy: boolean;
  readonly onChoose: (choice: SnoozeChoice) => void;
  readonly onCancel: () => void;
}

export function InboxSnoozeDialog({
  subject,
  choices,
  busy,
  onChoose,
  onCancel,
}: InboxSnoozeDialogProps) {
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Snooze {subject}</DialogTitle>
          <DialogDescription>
            The thread leaves the Inbox until the time that you pick. A new update brings it back.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {choices.map((choice) => (
            <Button
              key={choice.id}
              variant="outline"
              disabled={busy}
              onClick={() => onChoose(choice)}
            >
              {choice.label}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
