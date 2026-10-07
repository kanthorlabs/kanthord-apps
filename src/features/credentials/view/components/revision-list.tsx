import { BanIcon } from "lucide-react";

import type { Credential, CredentialRevision } from "@/api/types";
import { DataListItem } from "@/components/data-list-item";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ItemGroup } from "@/components/ui/item";
import { metadataFacts } from "@/lib/credential-facts";
import { newestLiveRevision, revisionsNewestFirst } from "@/lib/credential-revisions";
import { utcDateTime } from "@/lib/format";

interface RevisionListProps {
  readonly credential: Credential;
  readonly canRevoke: (revision: CredentialRevision) => boolean;
  readonly onRevoke: (revision: CredentialRevision) => void;
}

export function RevisionList({ credential, canRevoke, onRevoke }: RevisionListProps) {
  const newest = newestLiveRevision(credential);

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
            ...metadataFacts(credential.platform, revision.metadata).map((fact) => ({
              label: fact.label,
              value: <span className="break-all">{fact.value}</span>,
            })),
          ]}
          actions={
            canRevoke(revision) ? (
              <Button variant="outline" size="sm" onClick={() => onRevoke(revision)}>
                <BanIcon aria-hidden="true" data-icon="inline-start" />
                Revoke revision {revision.revision}
              </Button>
            ) : undefined
          }
        />
      ))}
    </ItemGroup>
  );
}
