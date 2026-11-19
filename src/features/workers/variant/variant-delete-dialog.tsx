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
import { InlineError } from "@/features/workbench/chat/components/inline-error";
import type { VariantDeleteState } from "./use-variant-delete";

export function VariantDeleteDialog({
  name,
  remove,
}: {
  readonly name: string;
  readonly remove: VariantDeleteState;
}) {
  return (
    <AlertDialog open={remove.open} onOpenChange={(next) => !next && remove.cancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            The variant and its instruction are removed. A session that uses the variant blocks the
            delete.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">
          To keep the variant, rename it or change its instruction instead.
        </p>
        {remove.failure !== null && (
          <InlineError code={remove.failure.code} message={remove.failure.message} />
        )}
        <AlertDialogFooter className="flex-row flex-wrap justify-start sm:justify-start md:justify-end">
          <AlertDialogCancel disabled={remove.pending}>Keep {name}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={remove.pending}
            onClick={remove.confirm}
          >
            Delete {name}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
