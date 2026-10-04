import { ArchiveIcon, FileCogIcon, RefreshCwIcon } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import type { Credential, CredentialPlatformEntry } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckStatusBadge } from "../components/check-status-badge";
import { type CredentialCheck, useCredentialCheck } from "../use-credential-check";
import { useCredentialPlatforms } from "../use-credential-platforms";
import { VerifyButton } from "../components/verify-button";
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
import { platformEntryOf } from "@/lib/credential-platforms";
import { useRevisionRevoke } from "./use-revision-revoke";

interface HealthSectionProps {
  readonly entry: CredentialPlatformEntry | null;
  readonly check: CredentialCheck;
}

function HealthSection({ entry, check }: HealthSectionProps) {
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold leading-none">Health</h3>
        <VerifyButton
          platform={entry?.platform ?? ""}
          verifiable={entry?.verifiable ?? true}
          checking={check.checking}
          onVerify={check.verify}
        />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          Verify runs the resource healthcheck of the daemon. Custody makes no remote call at create
          or rotate.
        </p>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm">
          <dt className="text-muted-foreground">Capability</dt>
          <dd className="min-w-0 break-words">{check.capability}</dd>
          <dt className="text-muted-foreground">Checked</dt>
          <dd className="min-w-0 break-words tabular-nums">{check.checkedAt}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

function CredentialDetail({ credential, reload }: { credential: Credential; reload: () => void }) {
  const entry = platformEntryOf(useCredentialPlatforms().data, credential.platform);
  const rotate = useCredentialRotate(credential, entry, reload);
  const metadata = useMetadataEdit(credential, entry, reload);
  const revoke = useRevisionRevoke(credential, reload);
  const archive = useCredentialArchive(credential);
  const archived = isArchived(credential);
  const check = useCredentialCheck(credential.name);

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Credential" className="flex flex-col gap-2 border-b pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="min-w-0 font-mono text-lg font-semibold break-all">{credential.name}</h2>
            <Badge variant="outline">{credential.platform}</Badge>
            {archived && <Badge variant="secondary">Archived</Badge>}
            <CheckStatusBadge badge={check.badge} />
          </div>
          <div className="flex flex-wrap gap-2">
            {!archived && rotate.available && (
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
      {!archived && <HealthSection entry={entry} check={check} />}
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
      {entry !== null && <RotateSheet name={credential.name} entry={entry} rotate={rotate} />}
      {entry !== null && <MetadataSheet name={credential.name} entry={entry} edit={metadata} />}
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
