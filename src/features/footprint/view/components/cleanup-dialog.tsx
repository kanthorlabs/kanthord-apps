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
import type { FootprintCleanupState } from "../use-footprint-cleanup";

export function CleanupDialog({ cleanup }: { cleanup: FootprintCleanupState }) {
  const plan = cleanup.plan;
  return (
    <AlertDialog open={plan !== null} onOpenChange={(open) => !open && cleanup.cancel()}>
      <AlertDialogContent>
        {plan !== null && (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle>{plan.title}</AlertDialogTitle>
              <AlertDialogDescription render={<div />} className="flex flex-col gap-2">
                {plan.sentences.map((sentence) => (
                  <p key={sentence}>{sentence}</p>
                ))}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <p className="text-sm text-muted-foreground">{plan.saferPath}</p>
            {cleanup.error !== null && (
              <p role="alert" className="text-sm text-destructive">
                {cleanup.error}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={cleanup.sending}>Keep them</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={cleanup.sending || cleanup.blocked}
                onClick={cleanup.confirm}
              >
                {plan.actionLabel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
}
