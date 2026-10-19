import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Skeleton } from "@/components/ui/skeleton";
import { RecordName } from "@/components/record-name";
import type { SshKeyBindings, SshKeyRotateState } from "../use-ssh-key-rotate";
import { SshKeyFacts } from "./ssh-key-facts";
import { WriteFailureAlert } from "./write-failure-alert";

interface SshKeyRotateDialogProps {
  readonly name: string;
  readonly rotate: SshKeyRotateState;
}

function BindingsOfKey({
  name,
  bindings,
  onRetry,
}: {
  readonly name: string;
  readonly bindings: SshKeyBindings;
  readonly onRetry: () => void;
}) {
  if (bindings.status === "loading") return <Skeleton className="h-10 w-full" />;
  if (bindings.status === "error") {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-destructive">{bindings.message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </div>
    );
  }
  if (bindings.items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No binding names <RecordName>{name}</RecordName>.
      </p>
    );
  }
  return (
    <ul aria-label={`Bindings of ${name}`} className="flex flex-col gap-1 text-sm">
      {bindings.items.map((binding) => (
        <li key={binding.binding_id}>
          <RecordName>{binding.name}</RecordName> of project{" "}
          <RecordName>{binding.project_name}</RecordName>
        </li>
      ))}
    </ul>
  );
}

export function SshKeyRotateDialog({ name, rotate }: SshKeyRotateDialogProps) {
  const rotated = rotate.rotated;
  const older = rotate.expectedRevision;

  return (
    <AlertDialog open={rotate.open} onOpenChange={(open) => !open && rotate.close()}>
      <AlertDialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {rotated === null ? `Rotate the key of ${name}?` : `New key of ${name}`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {rotated === null ? (
              <>
                The server generates a new key at once. Every new git operation of{" "}
                <RecordName>{name}</RecordName> uses the new key. Until the new key is a deploy key
                of the repository, the binding check of each binding below answers key_refused.
              </>
            ) : (
              <>
                Revision {rotated.revision} of <RecordName>{name}</RecordName> is live. Each binding
                below answers key_refused until its repository holds the new deploy key.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {rotate.failure !== null && (
          <WriteFailureAlert
            title="The key was not rotated."
            failure={rotate.failure}
            onReload={rotate.readLatest}
          />
        )}
        {rotated !== null &&
          (rotated.key === null ? (
            <Alert>
              <AlertTitle>The answer holds no public key.</AlertTitle>
              <AlertDescription>Open the credential to read the new key.</AlertDescription>
            </Alert>
          ) : (
            <SshKeyFacts sshKey={rotated.key} />
          ))}
        <section aria-labelledby="ssh-rotate-bindings" className="flex flex-col gap-2">
          <h3 id="ssh-rotate-bindings" className="text-sm font-medium">
            Bindings
          </h3>
          <BindingsOfKey name={name} bindings={rotate.bindings} onRetry={rotate.readBindings} />
        </section>
        {rotated === null ? (
          <p className="text-sm text-muted-foreground">
            Keep the current key until you can add the new deploy key. The current key stays live.
          </p>
        ) : (
          <section aria-labelledby="ssh-rotate-steps" className="flex flex-col gap-2">
            <h3 id="ssh-rotate-steps" className="text-sm font-medium">
              Next steps
            </h3>
            <ol className="list-decimal space-y-1 pl-5 text-sm">
              <li>Add the new public key as a deploy key with write access.</li>
              <li>Verify each binding.</li>
              <li>Wait until revision {older} shows an end time.</li>
              <li>Delete the old deploy key at GitHub.</li>
            </ol>
          </section>
        )}
        <AlertDialogFooter>
          {rotated === null ? (
            <>
              <AlertDialogCancel disabled={rotate.submitting}>Keep current key</AlertDialogCancel>
              <AlertDialogAction disabled={rotate.submitting} onClick={rotate.confirm}>
                Rotate key
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogAction onClick={rotate.close}>Done</AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
