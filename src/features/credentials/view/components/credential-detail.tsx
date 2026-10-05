import { ArchiveIcon, FileCogIcon, RefreshCwIcon } from "lucide-react";
import type { ReactNode } from "react";

import type { Credential, CredentialComponent, CredentialPlatformEntry } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { isArchived } from "@/lib/credential-revisions";
import { platformEntryOf } from "@/lib/credential-platforms";
import { CheckStatusBadge } from "../../components/check-status-badge";
import { MetadataSheet } from "../../components/metadata-sheet";
import { RotateSheet } from "../../components/rotate-sheet";
import { VerifyButton } from "../../components/verify-button";
import { type CredentialCheck, useCredentialCheck } from "../../use-credential-check";
import { useCredentialPlatforms } from "../../use-credential-platforms";
import { useCredentialRotate } from "../../use-credential-rotate";
import { useMetadataEdit } from "../../use-metadata-edit";
import { useCredentialArchive } from "../use-credential-archive";
import { useRevisionRevoke } from "../use-revision-revoke";
import { ArchiveDialog } from "./archive-dialog";
import { RevisionList } from "./revision-list";
import { RevokeDialog } from "./revoke-dialog";

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

interface CredentialDetailProps {
  readonly component: CredentialComponent;
  readonly credential: Credential;
  readonly reload: () => void;
  readonly children?: ReactNode;
}

export function CredentialDetail({
  component,
  credential,
  reload,
  children,
}: CredentialDetailProps) {
  const entry = platformEntryOf(useCredentialPlatforms(component).data, credential.platform);
  const rotate = useCredentialRotate(component, credential, entry, reload);
  const metadata = useMetadataEdit(component, credential, entry, reload);
  const revoke = useRevisionRevoke(component, credential, reload);
  const archive = useCredentialArchive(component, credential);
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
      {children}
      {entry !== null && <RotateSheet name={credential.name} entry={entry} rotate={rotate} />}
      {entry !== null && <MetadataSheet name={credential.name} entry={entry} edit={metadata} />}
      <RevokeDialog revoke={revoke} />
      <ArchiveDialog name={credential.name} archive={archive} />
    </div>
  );
}
