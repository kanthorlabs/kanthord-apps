import { FileCogIcon, PlusIcon, RefreshCwIcon, UploadIcon } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import type { Credential, CredentialComponent, CredentialPlatformEntry } from "@/api/types";
import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { archiveTime, isArchived, newestLiveRevision } from "@/lib/credential-revisions";
import { platformEntryOf } from "@/lib/credential-platforms";
import { credentialDetailPath, credentialSectionPath } from "@/lib/credential-sections";
import { utcDateTime } from "@/lib/format";
import { CheckStatusBadge } from "../components/check-status-badge";
import { MetadataSheet } from "../components/metadata-sheet";
import { PlatformCombobox } from "../components/platform-combobox";
import { RotateSheet } from "../components/rotate-sheet";
import { SshImportDialog } from "../components/ssh-import-dialog";
import { VerifyButton } from "../components/verify-button";
import { useCredentialCheck } from "../use-credential-check";
import { useCredentialRotate } from "../use-credential-rotate";
import { useMetadataEdit } from "../use-metadata-edit";
import { ALL_PLATFORMS, useCredentialList } from "./use-credential-list";

function platformLabel(value: string): string {
  return value === ALL_PLATFORMS ? "All platforms" : value;
}

interface CredentialItemProps {
  readonly component: CredentialComponent;
  readonly credential: Credential;
  readonly entry: CredentialPlatformEntry | null;
  readonly reload: () => void;
}

function CredentialItem({ component, credential, entry, reload }: CredentialItemProps) {
  const navigate = useNavigate();
  const check = useCredentialCheck(component, credential.name);
  const rotate = useCredentialRotate(component, credential, entry, reload);
  const metadata = useMetadataEdit(component, credential, entry, reload);
  const newest = newestLiveRevision(credential);
  const archived = isArchived(credential);
  const archivedAt = archiveTime(credential);
  const name = credential.name;
  const detailPath = credentialDetailPath(component, name);

  return (
    <>
      <DataListItem
        title={
          <>
            {name}
            {newest !== null && (
              <span className="text-muted-foreground tabular-nums"> (v{newest.revision})</span>
            )}
          </>
        }
        status={
          <>
            {archived && <Badge variant="secondary">Archived</Badge>}
            <CheckStatusBadge badge={check.badge} />
          </>
        }
        select={{ label: `Open ${name}`, disabled: false, onSelect: () => navigate(detailPath) }}
        fields={[
          { label: "Platform", value: <span className="font-mono">{credential.platform}</span> },
          archivedAt === null
            ? { label: "Updated", value: newest === null ? "—" : utcDateTime(newest.created_at) }
            : { label: "Archived", value: utcDateTime(archivedAt) },
        ]}
        actions={
          archived ? undefined : (
            <div className="flex flex-wrap gap-2 md:w-[27rem] md:justify-end">
              <VerifyButton
                label={`Verify ${name}`}
                platform={credential.platform}
                verifiable={entry?.verifiable ?? true}
                checking={check.checking}
                onVerify={check.verify}
              />
              {rotate.available && (
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Rotate ${name}`}
                  onClick={rotate.start}
                >
                  <RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
                  Rotate
                </Button>
              )}
              {metadata.available && (
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Edit metadata of ${name}`}
                  onClick={metadata.start}
                >
                  <FileCogIcon aria-hidden="true" data-icon="inline-start" />
                  Edit metadata
                </Button>
              )}
            </div>
          )
        }
      />
      {entry !== null && <RotateSheet name={name} entry={entry} rotate={rotate} />}
      {entry !== null && <MetadataSheet name={name} entry={entry} edit={metadata} />}
    </>
  );
}

export function CredentialsScreen({ component }: { component: CredentialComponent }) {
  const {
    pages,
    platforms,
    platformIds,
    platform,
    includeArchived,
    selectPlatform,
    setIncludeArchived,
  } = useCredentialList(component);
  const [sshImportOpen, setSshImportOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-full md:w-64">
          <PlatformCombobox
            id="credential-platform-filter"
            label="Platform"
            items={platformIds}
            value={platform ?? ALL_PLATFORMS}
            labelOf={platformLabel}
            onValueChange={selectPlatform}
          />
        </div>
        <Field orientation="horizontal" className="w-auto">
          <Switch
            id="credential-include-archived"
            checked={includeArchived}
            onCheckedChange={setIncludeArchived}
          />
          <FieldLabel htmlFor="credential-include-archived">Include archived</FieldLabel>
        </Field>
        <div className="flex gap-2 md:ml-auto">
          {component === "repository" && (
            <Button variant="outline" onClick={() => setSshImportOpen(true)}>
              <UploadIcon aria-hidden="true" data-icon="inline-start" />
              Import from ~/.ssh/config
            </Button>
          )}
          <Button
            nativeButton={false}
            render={<Link to={`${credentialSectionPath(component)}/new`} />}
          >
            <PlusIcon aria-hidden="true" data-icon="inline-start" />
            New credential
          </Button>
        </div>
      </div>
      {sshImportOpen && (
        <SshImportDialog
          open
          onClose={() => setSshImportOpen(false)}
          onImported={() => {
            setSshImportOpen(false);
            pages.reload();
          }}
        />
      )}
      <DataList
        label="Credentials"
        items={pages.items}
        getKey={(credential) => credential.name}
        renderItem={(credential) => (
          <CredentialItem
            component={component}
            credential={credential}
            entry={platformEntryOf(platforms, credential.platform)}
            reload={pages.reload}
          />
        )}
        status={pages.status}
        error={pages.error?.message ?? null}
        pending={pages.pending}
        onRetry={pages.retry}
        emptyText={
          platform === null
            ? "No credentials. Create the first one with New credential."
            : `No ${platform} credentials.`
        }
        pager={{
          hasPrevious: pages.hasPrevious,
          hasNext: pages.hasNext,
          position: pages.position,
          onPrevious: pages.previous,
          onNext: pages.next,
        }}
      />
    </div>
  );
}
