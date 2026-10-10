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
import type { ProposalApproveState } from "../use-proposal-approve";

export function ProposalApproveDialog({ approve }: { approve: ProposalApproveState }) {
  const target = approve.target;
  const approvable = target !== null && approve.canApprove(target);

  return (
    <AlertDialog open={target !== null} onOpenChange={(open) => !open && approve.cancel()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Approve the proposal {target?.content.name}?</AlertDialogTitle>
          <AlertDialogDescription>{approve.consequence}</AlertDialogDescription>
        </AlertDialogHeader>
        <p className="text-sm text-muted-foreground">{approve.saferPath}</p>
        <Field>
          <FieldLabel htmlFor="proposal-approve-reason">Reason</FieldLabel>
          <Textarea
            id="proposal-approve-reason"
            value={approve.reason}
            disabled={approve.approving}
            onChange={(event) => approve.setReason(event.target.value)}
          />
          <FieldDescription>Optional. The new revisions record it.</FieldDescription>
        </Field>
        {approve.error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {approve.error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={approve.approving}>Keep the proposal</AlertDialogCancel>
          <AlertDialogAction disabled={approve.approving || !approvable} onClick={approve.confirm}>
            Approve proposal
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
