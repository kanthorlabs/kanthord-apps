import { BanIcon, CopyIcon } from "lucide-react";

import type { Credential, CredentialRevision } from "@/api/types";
import { DataListItem } from "@/components/data-list-item";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ItemGroup } from "@/components/ui/item";
import { metadataFacts } from "@/lib/credential-facts";
import { newestLiveRevision, revisionsNewestFirst } from "@/lib/credential-revisions";
import { utcDateTime } from "@/lib/format";
import { SSH_PLATFORM, sshKeyOf } from "@/lib/ssh-key";
import { usePublicKeyCopy } from "../../use-public-key-copy";

interface RevisionListProps {
  readonly credential: Credential;
  readonly canRevoke: (revision: CredentialRevision) => boolean;
  readonly onRevoke: (revision: CredentialRevision) => void;
}

export function RevisionList({ credential, canRevoke, onRevoke }: RevisionListProps) {
  const newest = newestLiveRevision(credential);
  const copy = usePublicKeyCopy();
  const sshKeyOfRevision = (revision: CredentialRevision) =>
    credential.platform === SSH_PLATFORM ? sshKeyOf(revision.metadata) : null;

  const metadataFields = (revision: CredentialRevision) => {
    const sshKey = sshKeyOfRevision(revision);
    if (sshKey === null) {
      return metadataFacts(credential.platform, revision.metadata).map((fact) => ({
        label: fact.label,
        value: <span className="break-all">{fact.value}</span>,
      }));
    }
    return [
      {
        label: "Fingerprint",
        value: <span className="font-mono break-all">{sshKey.fingerprint}</span>,
      },
      {
        label: "Public key",
        value: <span className="font-mono break-all">{sshKey.public_key}</span>,
      },
    ];
  };

  const copyAction = (revision: CredentialRevision) => {
    const sshKey = sshKeyOfRevision(revision);
    if (sshKey === null || revision.revision !== newest?.revision) return undefined;
    return (
      <Button variant="outline" size="sm" onClick={() => copy(sshKey.public_key)}>
        <CopyIcon aria-hidden="true" data-icon="inline-start" />
        Copy public key
      </Button>
    );
  };

  return (
    <ItemGroup aria-label="Revisions" className="gap-2">
      {revisionsNewestFirst(credential).map((revision) => (
        <DataListItem
          key={revision.id}
          title={`Revision ${revision.revision}`}
          status={
            <span className="flex flex-wrap gap-1">
              <Badge variant={revision.ended_at === null ? "default" : "secondary"}>
                {revision.ended_at === null ? "live" : "ended"}
              </Badge>
              {revision.revision === newest?.revision && <Badge variant="outline">newest</Badge>}
            </span>
          }
          fields={[
            {
              label: "Identity",
              value: <span className="font-mono break-all">{revision.id}</span>,
            },
            { label: "Created", value: utcDateTime(revision.created_at) },
            {
              label: "Ended",
              value: revision.ended_at === null ? "—" : utcDateTime(revision.ended_at),
            },
            ...metadataFields(revision),
          ]}
          actions={
            canRevoke(revision) ? (
              <Button variant="outline" size="sm" onClick={() => onRevoke(revision)}>
                <BanIcon aria-hidden="true" data-icon="inline-start" />
                Revoke revision {revision.revision}
              </Button>
            ) : (
              copyAction(revision)
            )
          }
        />
      ))}
    </ItemGroup>
  );
}
