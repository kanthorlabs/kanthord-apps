import type { SshAliasItem } from "@/api/types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useSshImport } from "../use-ssh-import";

const REFUSED_HINT = "Add IdentitiesOnly yes and one IdentityFile to this Host block.";

interface SshImportDialogProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onImported: (names: readonly string[]) => void;
}

export function SshImportDialog({ open, onClose, onImported }: SshImportDialogProps) {
  const ssh = useSshImport(onImported);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from ~/.ssh/config</DialogTitle>
          <DialogDescription>
            Select SSH aliases to import as repository credentials.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 overflow-y-auto">
          {ssh.loading && (
            <>
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </>
          )}
          {ssh.discoverError !== null && (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-destructive">{ssh.discoverError.message}</p>
              <Button variant="outline" size="sm" onClick={ssh.reload}>
                Retry
              </Button>
            </div>
          )}
          {ssh.items.map((item) => (
            <SshAliasRow
              key={item.host}
              item={item}
              checked={ssh.selected.has(item.host)}
              failure={ssh.failures.find((f) => f.host === item.host)?.message ?? null}
              onCheckedChange={(checked) => ssh.toggle(item.host, checked)}
            />
          ))}
          {!ssh.loading && ssh.discoverError === null && ssh.items.length === 0 && (
            <p className="text-sm text-muted-foreground">No SSH aliases found in ~/.ssh/config.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={ssh.submitting || ssh.readyCount === 0} onClick={ssh.submit}>
            {ssh.submitting
              ? "Creating…"
              : `Create ${ssh.readyCount > 0 ? ssh.readyCount : ""} credential${ssh.readyCount !== 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface SshAliasRowProps {
  readonly item: SshAliasItem;
  readonly checked: boolean;
  readonly failure: string | null;
  readonly onCheckedChange: (checked: boolean) => void;
}

function SshAliasRow({ item, checked, failure, onCheckedChange }: SshAliasRowProps) {
  const id = `ssh-alias-${item.host}`;
  const ready = item.state === "ready";
  const present = item.state === "present";
  return (
    <div className="flex flex-col gap-1 rounded-md border p-3">
      <div className="flex items-center gap-3">
        {ready && (
          <Field orientation="horizontal" className="w-auto">
            <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
            <FieldLabel htmlFor={id} className="font-mono">
              {item.host}
            </FieldLabel>
          </Field>
        )}
        {!ready && <span className="font-mono text-sm font-medium">{item.host}</span>}
        {present && <span className="text-xs text-muted-foreground">Already imported</span>}
        {item.state === "refused" && <span className="text-xs text-destructive">Refused</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        {item.hostname}:{item.port}
        {item.state !== "ready" && item.identity_file !== null && ` · ${item.identity_file}`}
        {item.state === "ready" && ` · ${item.identity_file}`}
      </p>
      {item.state === "refused" && (
        <p className="text-xs text-muted-foreground">
          {item.reason !== null && <>{item.reason}. </>}
          {REFUSED_HINT}
        </p>
      )}
      {failure !== null && <p className="text-xs text-destructive">{failure}</p>}
    </div>
  );
}
