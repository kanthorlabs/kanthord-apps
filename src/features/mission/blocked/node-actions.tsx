import type { MissionNode } from "@/api/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { Dependent } from "./use-node-actions";
import { useNodeActions } from "./use-node-actions";

interface NodeActionsProps {
  readonly node: MissionNode;
  readonly projectId: string;
  readonly dependents: readonly Dependent[];
  readonly clearedAttemptId?: string;
  readonly onSuccess?: () => void;
}

export function NodeActions({
  node,
  projectId,
  dependents,
  clearedAttemptId,
  onSuccess,
}: NodeActionsProps) {
  const actions = useNodeActions(projectId, node, dependents, clearedAttemptId, onSuccess);

  if (actions.terminal) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {actions.canPause && (
        <Button
          variant="outline"
          size="sm"
          disabled={actions.isPausing}
          onClick={actions.handlePause}
        >
          Pause
        </Button>
      )}

      {actions.canResume && (
        <Button
          variant="outline"
          size="sm"
          disabled={actions.isResuming}
          onClick={actions.handleResume}
        >
          Resume
        </Button>
      )}

      {actions.canBlock && (
        <Dialog open={actions.blockOpen} onOpenChange={actions.setBlockOpen}>
          <DialogTrigger render={<Button variant="outline" size="sm" />}>Block…</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Block this node</DialogTitle>
              <DialogDescription>
                This closes the open attempt. The records of the closed attempt stay, and the
                effects on the repository and the platform stay. A block cancels no live request.
                Leaving the node in Paused keeps the attempt resumable.
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="block-reason">Reason (required)</FieldLabel>
              <Textarea
                id="block-reason"
                placeholder="Describe why this node is being blocked."
                value={actions.blockReason}
                onChange={(e) => actions.setBlockReason(e.target.value)}
              />
            </Field>
            {actions.blockError !== null && (
              <FieldError>
                {actions.blockError}
                {actions.blockErrorDetail ? ` — ${actions.blockErrorDetail}` : ""}
              </FieldError>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button
                variant="destructive"
                disabled={!actions.blockReason.trim() || actions.isBlocking}
                onClick={actions.handleBlock}
              >
                Block
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {actions.canUnblock && (
        <Dialog open={actions.unblockOpen} onOpenChange={actions.setUnblockOpen}>
          <DialogTrigger render={<Button variant="default" size="sm" />}>Unblock…</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Unblock this node</DialogTitle>
              <DialogDescription>
                This clears the blocked attempt and opens exactly one new attempt. The next attempt
                starts from the current revision.
              </DialogDescription>
            </DialogHeader>
            {actions.unblockError !== null && (
              <FieldError>
                {actions.unblockError}
                {actions.unblockErrorDetail ? ` — ${actions.unblockErrorDetail}` : ""}
              </FieldError>
            )}
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
              <Button disabled={actions.isUnblocking} onClick={actions.handleUnblock}>
                Unblock
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {actions.canOverride && (
        <AlertDialog open={actions.overrideOpen} onOpenChange={actions.setOverrideOpen}>
          <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
            Override success…
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Override asserting success</AlertDialogTitle>
              <AlertDialogDescription render={<div />} className="space-y-2">
                <p>
                  This writes a human assessment and a successful outcome that names it. It closes
                  the current attempt by force and marks this node Completed, which is terminal and
                  unreversible. Every dependent node is satisfied immediately.
                </p>
                {dependents.length > 0 && (
                  <div>
                    <p className="font-medium text-foreground">Dependents that will be released:</p>
                    <ul className="mt-1 list-inside list-disc">
                      {dependents.map((d) => (
                        <li key={d.id}>{d.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <p>
                  An optional landed commit identity is accepted with no check against the
                  repository.
                </p>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-4">
              <Field>
                <FieldLabel htmlFor="override-reason">
                  Reason for asserting success (required)
                </FieldLabel>
                <Textarea
                  id="override-reason"
                  placeholder="State why success is being asserted."
                  value={actions.overrideReason}
                  onChange={(e) => actions.setOverrideReason(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="override-commit">Landed commit identity (optional)</FieldLabel>
                <Input
                  id="override-commit"
                  placeholder="e.g. sha256:abc123"
                  value={actions.overrideLandedCommitId}
                  onChange={(e) => actions.setOverrideLandedCommitId(e.target.value)}
                />
              </Field>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={!actions.overrideReason.trim() || actions.isOverriding}
                onClick={() => {
                  actions.handleOverride();
                }}
              >
                Confirm override
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {actions.canDiscard && (
        <AlertDialog open={actions.discardOpen} onOpenChange={actions.setDiscardOpen}>
          <AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
            Discard…
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Discard this node</AlertDialogTitle>
              <AlertDialogDescription render={<div />} className="space-y-2">
                <p>
                  This writes an outcome whose asserted result is that nothing is established. It is
                  terminal and unreversible. A discarded node satisfies no dependency.
                </p>
                {dependents.length > 0 && (
                  <div>
                    <p className="font-medium text-foreground">Dependents that will strand:</p>
                    <ul className="mt-1 list-inside list-disc">
                      {dependents.map((d) => (
                        <li key={d.id}>{d.title}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {dependents.length === 0 && <p>No dependent nodes will strand.</p>}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <Field>
              <FieldLabel htmlFor="discard-reason">Stopping reason (required)</FieldLabel>
              <Textarea
                id="discard-reason"
                placeholder="State why this node is being discarded."
                value={actions.discardReason}
                onChange={(e) => actions.setDiscardReason(e.target.value)}
              />
            </Field>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={!actions.discardReason.trim() || actions.isDiscarding}
                onClick={() => {
                  actions.handleDiscard();
                }}
              >
                Confirm discard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {actions.canSetPriority && (
        <div className="flex items-center gap-2">
          <Input
            id={`priority-${node.id}`}
            type="number"
            aria-label="Priority"
            className="w-20"
            value={actions.priorityValue}
            onChange={(e) => actions.setPriorityValue(e.target.value)}
            placeholder="0"
          />
          <Button
            variant="outline"
            size="sm"
            disabled={actions.isSettingPriority}
            onClick={actions.handleSetPriority}
            title="Raising priority orders this node higher in the work queue. It never makes a Blocked, Paused, or Pending node claimable."
          >
            Set priority
          </Button>
        </div>
      )}
    </div>
  );
}
