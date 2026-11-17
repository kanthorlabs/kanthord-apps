import { useState } from "react";

import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { utcDateTime } from "@/lib/format";
import type { InvitesState } from "../use-invites";
import { useShareInvite } from "../use-share-invite";
import { InlineError } from "./inline-error";

interface ShareDialogProps {
  readonly sessionId: string;
  readonly forkTitle: string | null;
  readonly invites: InvitesState;
}

export function ShareDialog({ sessionId, forkTitle, invites }: ShareDialogProps) {
  const [open, setOpen] = useState(false);
  const [revoking, setRevoking] = useState<{ id: string; name: string } | null>(null);
  const share = useShareInvite(sessionId, invites.reload);
  const { reset } = share;
  const failed = share.createFailure !== null || share.revokeFailure !== null;

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Share
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) reset();
        }}
      >
        <DialogContent
          className={
            failed
              ? "max-h-[90dvh] overflow-y-auto border border-destructive sm:max-w-xl"
              : "max-h-[90dvh] overflow-y-auto sm:max-w-xl"
          }
        >
          <DialogHeader>
            <DialogTitle>Share this conversation</DialogTitle>
            <DialogDescription>
              Guests see the whole history of this conversation. The link expires in 7 days.
            </DialogDescription>
            {forkTitle !== null && (
              <p className="text-sm break-words text-muted-foreground">
                This conversation carries a summary of {forkTitle}. Guests see the summary.
              </p>
            )}
          </DialogHeader>
          <form
            noValidate
            aria-label="Create link"
            className="flex min-w-0 flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault();
              void share.create();
            }}
          >
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="share-invitee-name">Invite for (required)</FieldLabel>
                <Input
                  id="share-invitee-name"
                  autoComplete="off"
                  value={share.name}
                  onChange={(event) => share.setName(event.target.value)}
                />
              </Field>
              <div>
                <Button type="submit" disabled={!share.valid || share.pending}>
                  Create link
                </Button>
              </div>
              {share.createFailure !== null && (
                <InlineError
                  code={share.createFailure.code}
                  message={share.createFailure.message}
                />
              )}
            </FieldGroup>
          </form>
          {share.link !== null && (
            <div className="flex min-w-0 items-center gap-2">
              <Input readOnly aria-label="Invite link (copy now, shown once)" value={share.link} />
              <Button type="button" variant="outline" onClick={share.copy}>
                Copy link
              </Button>
            </div>
          )}
          <DataList
            label="Invites"
            items={invites.invites}
            getKey={(invite) => invite.id}
            status={invites.status}
            error={invites.error}
            pending={false}
            onRetry={invites.reload}
            emptyText="No live invites."
            renderItem={(invite) => (
              <DataListItem
                title={invite.invitee_name}
                description={`Expires ${utcDateTime(invite.expires_at)}`}
                actions={
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Revoke ${invite.invitee_name}`}
                    disabled={share.revokingId === invite.id}
                    onClick={() => setRevoking({ id: invite.id, name: invite.invitee_name })}
                  >
                    Revoke
                  </Button>
                }
                notice={
                  share.revokeFailure?.inviteId === invite.id ? (
                    <InlineError
                      code={share.revokeFailure.line.code}
                      message={share.revokeFailure.line.message}
                    />
                  ) : undefined
                }
              />
            )}
          />
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>Done</DialogClose>
          </DialogFooter>
          <AlertDialog open={revoking !== null} onOpenChange={(next) => !next && setRevoking(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Revoke the invite of {revoking?.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  The guest loses access to this conversation at once. The link stops working.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep the invite</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  onClick={() => {
                    if (revoking !== null) void share.revoke(revoking.id);
                    setRevoking(null);
                  }}
                >
                  Revoke invite
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DialogContent>
      </Dialog>
    </>
  );
}
