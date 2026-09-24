import { Link } from "react-router-dom";

import { useProjectId } from "@/features/projects/project-context";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import type { Binding, CredentialReference, PermittedClientIdentity } from "@/api/types";
import { useSettings } from "./use-settings";
import { useRotateSecret } from "./use-rotate-secret";

function CredentialReferenceList({ refs }: { refs: readonly CredentialReference[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        The secret stays in custody inside the daemon. Only provenance fields are shown below.
      </p>
      {refs.map((ref) => (
        <div
          key={`${ref.capability}-${ref.recordId}`}
          className="rounded-md border p-3 text-sm space-y-1"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium">{ref.capability}</span>
            <Badge variant="outline" className="text-xs">
              {ref.recordType}
            </Badge>
          </div>
          <p className="text-muted-foreground">
            Record: <span className="font-mono">{ref.recordId}</span>
          </p>
          <p className="text-muted-foreground">
            Principal: {ref.upstreamPrincipal} · Configured by {ref.configuringActor}
          </p>
        </div>
      ))}
    </div>
  );
}

function RepositoryBindingCard({ binding }: { binding: Binding }) {
  const strategy = binding.strategy;
  const expectedEndState =
    strategy?.actionKind === "fire-and-forget action" || strategy?.expectedEndState === null
      ? "none"
      : (strategy?.expectedEndState ?? "none");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-mono">{binding.identity}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Platform</p>
            <p>{binding.platform ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Transport</p>
            <p>{binding.transportForm ?? "—"}</p>
          </div>
          <div className="col-span-2">
            <p className="text-muted-foreground">Address</p>
            <p className="font-mono break-all">{binding.repositoryAddress ?? "—"}</p>
          </div>
        </div>
        {binding.requiredCapabilities && binding.requiredCapabilities.length > 0 && (
          <div>
            <p className="text-sm text-muted-foreground mb-1">Required capabilities</p>
            <div className="flex flex-wrap gap-1">
              {binding.requiredCapabilities.map((c) => (
                <Badge key={c} variant="secondary" className="text-xs">
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {strategy !== undefined && (
          <div>
            <p className="text-sm text-muted-foreground mb-2">Repository strategy</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Base branch</dt>
              <dd className="font-mono">{strategy.baseBranch}</dd>
              <dt className="text-muted-foreground">Action</dt>
              <dd>{strategy.configuredAction}</dd>
              <dt className="text-muted-foreground">Action kind</dt>
              <dd>{strategy.actionKind}</dd>
              <dt className="text-muted-foreground">Expected end state</dt>
              <dd>{expectedEndState}</dd>
            </dl>
          </div>
        )}
        {binding.credentialReferences.length > 0 && (
          <CredentialReferenceList refs={binding.credentialReferences} />
        )}
      </CardContent>
    </Card>
  );
}

function WorkerBindingCard({ binding }: { binding: Binding }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-mono">{binding.identity}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm space-y-2">
        <p>
          Worker: <span className="font-mono">{binding.workerName ?? "—"}</span> · rev{" "}
          {binding.revision}
        </p>
        <p className="text-muted-foreground">
          See{" "}
          <Link to="/workers" className="underline underline-offset-2">
            Workers
          </Link>{" "}
          for instance count, availability and effective configuration.
        </p>
      </CardContent>
    </Card>
  );
}

function ProviderBindingCard({ binding }: { binding: Binding }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <span className="font-mono">{binding.identity}</span>
          {binding.isDefaultAccount === true && (
            <Badge variant="default" className="text-xs">
              default
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Provider</p>
            <p>{binding.provider ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Account</p>
            <p>{binding.account ?? "—"}</p>
          </div>
        </div>
        {binding.credentialReferences.length > 0 && (
          <CredentialReferenceList refs={binding.credentialReferences} />
        )}
      </CardContent>
    </Card>
  );
}

function SourceBindingCard({ binding }: { binding: Binding }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-mono">{binding.identity}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-muted-foreground">Delivery source</p>
          <p>{binding.deliverySource ?? "—"}</p>
        </div>
        {binding.credentialReferences.length > 0 && (
          <CredentialReferenceList refs={binding.credentialReferences} />
        )}
      </CardContent>
    </Card>
  );
}

function ClientIdentityRow({
  identity,
  onRotate,
}: {
  identity: PermittedClientIdentity;
  onRotate: (identityId: string) => void;
}) {
  return (
    <Card>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="font-mono text-sm">{identity.clientIdentity}</p>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>
                Role: <Badge variant="outline">{identity.role}</Badge>
              </span>
              <span>Executions: {identity.executionCount}</span>
              <span>Live: {identity.liveExecutions}</span>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => onRotate(identity.id)}>
            Rotate secret
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          The role of a permitted client identity never changes. A different role requires a
          different client identity.
        </p>
      </CardContent>
    </Card>
  );
}

function RevealedSecretPanel({ secret, onDismiss }: { secret: string; onDismiss: () => void }) {
  function handleCopy() {
    void navigator.clipboard.writeText(secret);
  }

  return (
    <div className="rounded-md border border-amber-400 bg-amber-50 p-4 space-y-3 dark:border-amber-700 dark:bg-amber-950">
      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
        New client secret — shown once only
      </p>
      <p className="text-xs text-amber-800 dark:text-amber-300">
        Copy this secret now. The daemon keeps only its hash. This value will not be shown again.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 break-all rounded bg-background p-2 text-xs font-mono border">
          {secret}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopy}
          aria-label="Copy new client secret"
        >
          Copy
        </Button>
      </div>
      <Button variant="ghost" size="sm" onClick={onDismiss}>
        Dismiss
      </Button>
    </div>
  );
}

function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-destructive">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

export function SettingsScreen() {
  const projectId = useProjectId();
  const {
    repositoryBindings,
    workerBindings,
    providerBindings,
    sourceBindings,
    clientIdentities,
    bindingsLoading,
    bindingsError,
    identitiesLoading,
    identitiesError,
    reloadBindings,
    reloadIdentities,
  } = useSettings();

  const rotateSecret = useRotateSecret();

  function handleRotate(identityId: string) {
    rotateSecret.requestRotate(projectId, identityId);
  }

  return (
    <div className="space-y-8 px-4 lg:px-0">
      <section aria-labelledby="repo-heading">
        <h2 id="repo-heading" className="text-lg font-semibold mb-4">
          Repository bindings
        </h2>
        {bindingsLoading && (
          <div className="space-y-3">
            <Skeleton className="h-48 w-full" />
          </div>
        )}
        {bindingsError !== null && !bindingsLoading && (
          <SectionError message={bindingsError.message} onRetry={reloadBindings} />
        )}
        {!bindingsLoading && bindingsError === null && (
          <div className="grid gap-4 lg:grid-cols-2">
            {repositoryBindings.length === 0 && (
              <p className="text-sm text-muted-foreground">No repository bindings.</p>
            )}
            {repositoryBindings.map((b) => (
              <RepositoryBindingCard key={b.id} binding={b} />
            ))}
          </div>
        )}
      </section>

      <Separator />

      <section aria-labelledby="worker-binding-heading">
        <h2 id="worker-binding-heading" className="text-lg font-semibold mb-4">
          Worker bindings
        </h2>
        {bindingsLoading && <Skeleton className="h-24 w-full" />}
        {bindingsError !== null && !bindingsLoading && (
          <SectionError message={bindingsError.message} onRetry={reloadBindings} />
        )}
        {!bindingsLoading && bindingsError === null && (
          <div className="grid gap-4 lg:grid-cols-2">
            {workerBindings.length === 0 && (
              <p className="text-sm text-muted-foreground">No worker bindings.</p>
            )}
            {workerBindings.map((b) => (
              <WorkerBindingCard key={b.id} binding={b} />
            ))}
          </div>
        )}
      </section>

      <Separator />

      <section aria-labelledby="provider-heading">
        <h2 id="provider-heading" className="text-lg font-semibold mb-4">
          Provider account bindings
        </h2>
        {bindingsLoading && <Skeleton className="h-24 w-full" />}
        {bindingsError !== null && !bindingsLoading && (
          <SectionError message={bindingsError.message} onRetry={reloadBindings} />
        )}
        {!bindingsLoading && bindingsError === null && (
          <div className="grid gap-4 lg:grid-cols-2">
            {providerBindings.length === 0 && (
              <p className="text-sm text-muted-foreground">No provider account bindings.</p>
            )}
            {providerBindings.map((b) => (
              <ProviderBindingCard key={b.id} binding={b} />
            ))}
          </div>
        )}
      </section>

      <Separator />

      <section aria-labelledby="source-heading">
        <h2 id="source-heading" className="text-lg font-semibold mb-4">
          Source bindings
        </h2>
        {bindingsLoading && <Skeleton className="h-24 w-full" />}
        {bindingsError !== null && !bindingsLoading && (
          <SectionError message={bindingsError.message} onRetry={reloadBindings} />
        )}
        {!bindingsLoading && bindingsError === null && (
          <div className="grid gap-4 lg:grid-cols-2">
            {sourceBindings.length === 0 && (
              <p className="text-sm text-muted-foreground">No source bindings.</p>
            )}
            {sourceBindings.map((b) => (
              <SourceBindingCard key={b.id} binding={b} />
            ))}
          </div>
        )}
      </section>

      <Separator />

      <section aria-labelledby="identities-heading">
        <h2 id="identities-heading" className="text-lg font-semibold mb-4">
          Client identities
        </h2>
        {identitiesLoading && <Skeleton className="h-24 w-full" />}
        {identitiesError !== null && !identitiesLoading && (
          <SectionError message={identitiesError.message} onRetry={reloadIdentities} />
        )}
        {!identitiesLoading && identitiesError === null && (
          <div className="space-y-3">
            {clientIdentities.length === 0 && (
              <p className="text-sm text-muted-foreground">No client identities.</p>
            )}
            {clientIdentities.map((ci) => (
              <ClientIdentityRow key={ci.id} identity={ci} onRotate={handleRotate} />
            ))}
          </div>
        )}
        {rotateSecret.revealedSecret !== null && (
          <div className="mt-4">
            <RevealedSecretPanel
              secret={rotateSecret.revealedSecret}
              onDismiss={rotateSecret.dismissSecret}
            />
          </div>
        )}
      </section>

      <AlertDialog
        open={rotateSecret.pendingIdentityId !== null}
        onOpenChange={(open) => {
          if (!open) rotateSecret.cancelRotate();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rotate client secret?</AlertDialogTitle>
            <AlertDialogDescription>
              The previous secret stops working immediately. The new secret is shown one time and
              cannot be retrieved again. Store it before dismissing.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={rotateSecret.cancelRotate}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                void rotateSecret.confirmRotate();
              }}
            >
              Rotate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
