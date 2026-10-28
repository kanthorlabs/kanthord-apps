import { RefreshCwIcon } from "lucide-react";

import type { HostKey, HostKeySource } from "@/api/types";
import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { utcDateTime } from "@/lib/format";
import { publishedFingerprintsUrl } from "@/lib/published-fingerprints";
import { type HostKeyConfirmation, useHostKeys } from "../use-host-keys";

const SOURCE_LABELS: Readonly<Record<HostKeySource, string>> = {
  github_meta: "api.github.com",
  keyscan: "ssh-keyscan",
};

interface HostKeyItemProps {
  readonly item: HostKey;
  readonly busy: boolean;
  readonly disabled: boolean;
  readonly onPinAgain: (item: HostKey) => void;
}

function HostKeyItem({ item, busy, disabled, onPinAgain }: HostKeyItemProps) {
  return (
    <DataListItem
      title={item.host}
      fields={[
        {
          label: "Fingerprint",
          value: <span className="font-mono break-all">{item.fingerprint}</span>,
        },
        { label: "Source", value: SOURCE_LABELS[item.source] },
        { label: "Pinned", value: utcDateTime(item.created_at) },
      ]}
      actions={
        <Button
          variant="outline"
          size="sm"
          aria-label={`Pin again ${item.host}`}
          disabled={disabled}
          onClick={() => onPinAgain(item)}
        >
          <RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
          {busy ? "Reading key…" : "Pin again"}
        </Button>
      }
    />
  );
}

interface ConfirmDialogProps {
  readonly confirmation: HostKeyConfirmation;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
}

function ConfirmHostKeyDialog({ confirmation, onConfirm, onCancel }: ConfirmDialogProps) {
  const { scan, pinned } = confirmation;
  const published = publishedFingerprintsUrl(scan.host);
  const same = scan.fingerprint === pinned.fingerprint;

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confirm the host key of {scan.host}</DialogTitle>
          <DialogDescription>
            Compare the scanned fingerprint with the fingerprint that the provider publishes.
            Confirm only an equal value.
          </DialogDescription>
        </DialogHeader>
        <dl className="flex min-w-0 flex-col gap-2 text-sm">
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-muted-foreground">Scanned fingerprint</dt>
            <dd className="font-mono break-all">{scan.fingerprint}</dd>
          </div>
          <div className="flex min-w-0 flex-col gap-0.5">
            <dt className="text-muted-foreground">Pinned fingerprint</dt>
            <dd className="font-mono break-all">{pinned.fingerprint}</dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">
          {same
            ? "The scanned key equals the pinned key."
            : "The scanned key differs from the pinned key. A changed key can mean an interception."}
        </p>
        {published !== null && (
          <p className="text-sm">
            <a
              href={published}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              Published fingerprints of {scan.host}
            </a>
          </p>
        )}
        {confirmation.error !== null && (
          <Alert variant="destructive">
            <AlertTitle>The host key was not pinned.</AlertTitle>
            <AlertDescription>{confirmation.error}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" disabled={confirmation.pinning} onClick={onCancel}>
            Cancel
          </Button>
          <Button disabled={confirmation.pinning} onClick={onConfirm}>
            Confirm host key
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function HostKeyPanel() {
  const hostKeys = useHostKeys();
  const { list } = hostKeys;
  const status = list.loading ? "loading" : list.error !== null ? "error" : "ready";

  return (
    <section aria-labelledby="host-keys-heading" className="flex flex-col gap-2">
      <h2 id="host-keys-heading" className="font-semibold">
        Host keys
      </h2>
      <p className="text-sm text-muted-foreground">
        The server trusts one pinned ed25519 key for each SSH host. Pin again reads the current key
        of the host.
      </p>
      <DataList
        label="Host keys"
        items={list.data ?? []}
        getKey={(item) => item.host}
        renderItem={(item) => (
          <HostKeyItem
            item={item}
            busy={hostKeys.busyHost === item.host}
            disabled={hostKeys.busyHost !== null || hostKeys.confirmation !== null}
            onPinAgain={hostKeys.pinAgain}
          />
        )}
        status={status}
        error={list.error?.message ?? null}
        pending={list.loading}
        onRetry={list.reload}
        emptyText="No host key is pinned. A binding sheet pins the host of its address."
      />
      {hostKeys.confirmation !== null && (
        <ConfirmHostKeyDialog
          confirmation={hostKeys.confirmation}
          onConfirm={hostKeys.confirm}
          onCancel={hostKeys.cancel}
        />
      )}
    </section>
  );
}
