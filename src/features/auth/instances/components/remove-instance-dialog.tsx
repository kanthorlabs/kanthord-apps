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
import type { RemovalPrompt } from "../use-instance-removal";

interface RemoveInstanceDialogProps {
  readonly prompt: RemovalPrompt | null;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

export function RemoveInstanceDialog({ prompt, onConfirm, onCancel }: RemoveInstanceDialogProps) {
  return (
    <AlertDialog
      open={prompt !== null}
      onOpenChange={(open) => {
        if (!open) onCancel();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="break-all">{prompt?.title}</AlertDialogTitle>
          <AlertDialogDescription>
            {prompt?.consequences.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep instance</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            Remove instance
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
