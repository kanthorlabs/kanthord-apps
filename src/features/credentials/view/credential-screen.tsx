import { ArchiveIcon, FileCogIcon, RefreshCwIcon, ShieldCheckIcon } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import type { Credential } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CredentialHealthLine } from "../components/credential-health-line";
import { useCredentialHealth } from "../use-credential-health";
import { MetadataSheet } from "../components/metadata-sheet";
import { ArchiveDialog } from "./components/archive-dialog";
import { RevisionList } from "./components/revision-list";
import { RevokeDialog } from "./components/revoke-dialog";
import { RotateSheet } from "../components/rotate-sheet";
import { useCredential } from "./use-credential";
import { useCredentialRotate } from "../use-credential-rotate";
import { useMetadataEdit } from "../use-metadata-edit";
import { useCredentialArchive } from "./use-credential-archive";
import { isArchived } from "@/lib/credential-revisions";
import { useRevisionRevoke } from "./use-revision-revoke";

function HealthSection({ name }: { name: string }) {
  const health = useCredentialHealth();

  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold leading-none">Health</h3>
        <Button
          variant="outline"
          size="sm"
          disabled={health.state.status === "checking"}
          onClick={health.verify}
        >
          <ShieldCheckIcon aria-hidden="true" data-icon="inline-start" />
          Verify
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {health.state.status === "idle" && (
          <p className="text-sm text-muted-foreground">
            Verify runs the resource healthcheck of the daemon. Custody makes no remote call at
            create or rotate.
          </p>
        )}
        <CredentialHealthLine name={name} state={health.state} onVerify={health.verify} />
      </CardContent>
    </Card>
  );
}

function CredentialDetail({ credential, reload }: { credential: Credential; reload: () => void }) {
  const rotate = useCredentialRotate(credential, reload);
  const metadata = useMetadataEdit(credential, reload);
  const revoke = useRevisionRevoke(credential, reload);
  const archive = useCredentialArchive(credential);
  const archived = isArchived(credential);

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Credential" className="flex flex-col gap-2 border-b pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="min-w-0 font-mono text-lg font-semibold break-all">{credential.name}</h2>
            <Badge variant="outline">{credential.platform}</Badge>
            {archived && <Badge variant="secondary">Archived</Badge>}
          </div>
          <div className="flex flex-wrap gap-2">
            {!archived && rotate.expectedRevision !== null && (
              <Button variant="outline" size="sm" onClick={rotate.start}>
                <RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
                Rotate secret
              </Button>
            )}
            {!archived && metadata.available && (
              <Button variant="outline" size="sm" onClick={metadata.start}>
                <FileCogIcon aria-hidden="true" data-icon="inline-start" />
                Edit metadata
              </Button>
            )}
            {!archived && (
              <Button variant="outline" size="sm" onClick={archive.request}>
                <ArchiveIcon aria-hidden="true" data-icon="inline-start" />
                Archive
              </Button>
            )}
          </div>
        </div>
      </section>
      {!archived && <HealthSection name={credential.name} />}
      <section aria-labelledby="credential-revisions" className="flex flex-col gap-2">
        <h3 id="credential-revisions" className="font-semibold">
          Revisions
        </h3>
        <RevisionList
          credential={credential}
          canRevoke={revoke.canRevoke}
          onRevoke={revoke.request}
        />
      </section>
      <RotateSheet name={credential.name} platform={credential.platform} rotate={rotate} />
      <MetadataSheet name={credential.name} platform={credential.platform} edit={metadata} />
      <RevokeDialog revoke={revoke} />
      <ArchiveDialog name={credential.name} archive={archive} />
    </div>
  );
}

export function CredentialScreen() {
  const { credentialName = "" } = useParams<{ credentialName: string }>();
  const { data: credential, error, loading, reload } = useCredential(credentialName);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error !== null || credential === null) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-sm text-destructive">{error?.message}</p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={reload}>
            Retry
          </Button>
          <Button
            nativeButton={false}
            render={<Link to="/credentials" />}
            variant="ghost"
            size="sm"
          >
            Back to credentials
          </Button>
        </div>
      </div>
    );
  }

  return <CredentialDetail credential={credential} reload={reload} />;
}
