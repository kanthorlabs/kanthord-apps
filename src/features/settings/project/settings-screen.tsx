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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from "@/components/ui/item";
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
      <ItemGroup className="gap-2">
        {refs.map((ref) => (
          <Item
            key={`${ref.capability}-${ref.recordId}`}
            variant="outline"
            size="sm"
            role="listitem"
          >
            <ItemContent className="min-w-0">
              <ItemTitle>
                {ref.capability}
                <Badge variant="outline">{ref.recordType}</Badge>
              </ItemTitle>
              <ItemDescription className="line-clamp-none">
                Record: <span className="font-mono break-all">{ref.recordId}</span>
              </ItemDescription>
              <ItemDescription className="line-clamp-none">
                Principal: {ref.upstreamPrincipal} · Configured by {ref.configuringActor}
              </ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
    </div>
  );
}

function RepositoryBindingItem({ binding }: { binding: Binding }) {
  const strategy = binding.strategy;
  const expectedEndState =
    strategy?.actionKind === "fire-and-forget action" || strategy?.expectedEndState === null
      ? "none"
      : (strategy?.expectedEndState ?? "none");

  return (
    <Item variant="outline" role="listitem">
      <ItemHeader>
        <ItemTitle>
          <span className="font-mono break-all">{binding.identity}</span>
        </ItemTitle>
      </ItemHeader>
      <ItemContent className="min-w-0 gap-4">
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
            <p className="mb-1 text-sm text-muted-foreground">Required capabilities</p>
            <div className="flex flex-wrap gap-1">
              {binding.requiredCapabilities.map((c) => (
                <Badge key={c} variant="secondary">
                  {c}
                </Badge>
              ))}
            </div>
          </div>
        )}
        {strategy !== undefined && (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">Repository strategy</p>
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
      </ItemContent>
    </Item>
  );
}

function WorkerBindingItem({ binding }: { binding: Binding }) {
  return (
    <Item variant="outline" role="listitem">
      <ItemHeader>
        <ItemTitle>
          <span className="font-mono break-all">{binding.identity}</span>
        </ItemTitle>
      </ItemHeader>
      <ItemContent className="min-w-0 text-sm">
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
      </ItemContent>
    </Item>
  );
}

function ProviderBindingItem({ binding }: { binding: Binding }) {
  return (
    <Item variant="outline" role="listitem">
      <ItemHeader>
        <ItemTitle>
          <span className="font-mono break-all">{binding.identity}</span>
          {binding.isDefaultAccount === true && <Badge variant="default">default</Badge>}
        </ItemTitle>
      </ItemHeader>
      <ItemContent className="min-w-0 gap-3">
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
      </ItemContent>
    </Item>
  );
}

function SourceBindingItem({ binding }: { binding: Binding }) {
  return (
    <Item variant="outline" role="listitem">
      <ItemHeader>
        <ItemTitle>
          <span className="font-mono break-all">{binding.identity}</span>
        </ItemTitle>
      </ItemHeader>
      <ItemContent className="min-w-0 gap-3 text-sm">
        <div>
          <p className="text-muted-foreground">Delivery source</p>
          <p>{binding.deliverySource ?? "—"}</p>
        </div>
        {binding.credentialReferences.length > 0 && (
          <CredentialReferenceList refs={binding.credentialReferences} />
        )}
      </ItemContent>
    </Item>
  );
}

function ClientIdentityItem({
  identity,
  onRotate,
}: {
  identity: PermittedClientIdentity;
  onRotate: (identityId: string) => void;
}) {
  return (
    <Item variant="outline" role="listitem">
      <ItemContent className="min-w-0">
        <ItemTitle>
          <span className="font-mono break-all">{identity.clientIdentity}</span>
        </ItemTitle>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          <span>
            Role: <Badge variant="outline">{identity.role}</Badge>
          </span>
          <span>Executions: {identity.executionCount}</span>
          <span>Live: {identity.liveExecutions}</span>
        </div>
        <ItemDescription className="line-clamp-none text-xs">
          The role of a permitted client identity never changes. A different role requires a
          different client identity.
        </ItemDescription>
      </ItemContent>
      <ItemActions>
        <Button variant="outline" size="sm" onClick={() => onRotate(identity.id)}>
          Rotate secret
        </Button>
      </ItemActions>
    </Item>
  );
}

function RevealedSecretPanel({ secret, onDismiss }: { secret: string; onDismiss: () => void }) {
  function handleCopy() {
    void navigator.clipboard.writeText(secret);
  }

  return (
    <Alert>
      <AlertTitle>New client secret — shown once only</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          Copy this secret now. The daemon keeps only its hash. This value will not be shown again.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <code className="min-w-0 flex-1 font-mono text-xs break-all">{secret}</code>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            aria-label="Copy new client secret"
          >
            Copy
          </Button>
          <Button variant="ghost" size="sm" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
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
          <ItemGroup className="gap-4 lg:grid lg:grid-cols-2">
            {repositoryBindings.length === 0 && (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No repository bindings.</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
            {repositoryBindings.map((b) => (
              <RepositoryBindingItem key={b.id} binding={b} />
            ))}
          </ItemGroup>
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
          <ItemGroup className="gap-4 lg:grid lg:grid-cols-2">
            {workerBindings.length === 0 && (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No worker bindings.</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
            {workerBindings.map((b) => (
              <WorkerBindingItem key={b.id} binding={b} />
            ))}
          </ItemGroup>
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
          <ItemGroup className="gap-4 lg:grid lg:grid-cols-2">
            {providerBindings.length === 0 && (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No provider account bindings.</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
            {providerBindings.map((b) => (
              <ProviderBindingItem key={b.id} binding={b} />
            ))}
          </ItemGroup>
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
          <ItemGroup className="gap-4 lg:grid lg:grid-cols-2">
            {sourceBindings.length === 0 && (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No source bindings.</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
            {sourceBindings.map((b) => (
              <SourceBindingItem key={b.id} binding={b} />
            ))}
          </ItemGroup>
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
          <ItemGroup className="gap-3">
            {clientIdentities.length === 0 && (
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No client identities.</EmptyTitle>
                </EmptyHeader>
              </Empty>
            )}
            {clientIdentities.map((ci) => (
              <ClientIdentityItem key={ci.id} identity={ci} onRotate={handleRotate} />
            ))}
          </ItemGroup>
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
