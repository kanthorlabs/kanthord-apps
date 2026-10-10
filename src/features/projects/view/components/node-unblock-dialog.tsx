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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { NodeUnblockState } from "../use-node-unblock";

export function NodeUnblockDialog({ name, unblock }: { name: string; unblock: NodeUnblockState }) {
  return (
    <AlertDialog open={unblock.open} onOpenChange={(open) => !open && unblock.cancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Unblock {name}?</AlertDialogTitle>
          <AlertDialogDescription>{unblock.consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        {unblock.proposalNotice !== null && <p className="text-sm">{unblock.proposalNotice}</p>}
        <p className="text-sm text-muted-foreground">{unblock.saferPath}</p>
        <Field>
          <FieldLabel htmlFor="node-unblock-reason">Reason</FieldLabel>
          <Textarea
            id="node-unblock-reason"
            value={unblock.reason}
            disabled={unblock.unblocking}
            onChange={(event) => unblock.setReason(event.target.value)}
          />
          <FieldDescription>Optional. The unblock records it.</FieldDescription>
        </Field>
        {unblock.error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {unblock.error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={unblock.unblocking}>Keep it blocked</AlertDialogCancel>
          <AlertDialogAction
            disabled={unblock.unblocking || !unblock.available}
            onClick={unblock.confirm}
          >
            Unblock node
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
