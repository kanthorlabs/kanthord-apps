import { FileCogIcon, HistoryIcon, PlusIcon, RefreshCwIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import type { Credential, CredentialComponent, CredentialPlatformEntry } from "@/api/types";
import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  archiveTime,
  isArchived,
  liveRevisionCount,
  newestLiveRevision,
} from "@/lib/credential-revisions";
import { platformEntryOf } from "@/lib/credential-platforms";
import { credentialDetailPath, credentialSectionPath } from "@/lib/credential-sections";
import { utcDateTime } from "@/lib/format";
import { CheckStatusBadge } from "../components/check-status-badge";
import { MetadataSheet } from "../components/metadata-sheet";
import { PlatformCombobox } from "../components/platform-combobox";
import { RotateSheet } from "../components/rotate-sheet";
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
        title={name}
        status={
          <>
            {archived && <Badge variant="secondary">Archived</Badge>}
            <CheckStatusBadge badge={check.badge} />
          </>
        }
        select={{ label: `Open ${name}`, disabled: false, onSelect: () => navigate(detailPath) }}
        fields={[
          { label: "Platform", value: <span className="font-mono">{credential.platform}</span> },
          {
            label: "Newest live revision",
            value:
              newest === null ? "none" : <span className="tabular-nums">r{newest.revision}</span>,
          },
          {
            label: "Live revisions",
            value: <span className="tabular-nums">{liveRevisionCount(credential)}</span>,
          },
          archivedAt === null
            ? { label: "Updated", value: newest === null ? "—" : utcDateTime(newest.createdAt) }
            : { label: "Archived", value: utcDateTime(archivedAt) },
        ]}
        actions={
          <div className="flex flex-wrap gap-2 md:w-[27rem]">
            {!archived && (
              <VerifyButton
                label={`Verify ${name}`}
                platform={credential.platform}
                verifiable={entry?.verifiable ?? true}
                checking={check.checking}
                onVerify={check.verify}
              />
            )}
            {!archived && rotate.available && (
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
            {!archived && metadata.available && (
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
            <Button
              nativeButton={false}
              render={<Link to={detailPath} />}
              variant="outline"
              size="sm"
              aria-label={`Revisions of ${name}`}
            >
              <HistoryIcon aria-hidden="true" data-icon="inline-start" />
              Revisions
            </Button>
          </div>
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
        <Button
          nativeButton={false}
          render={<Link to={`${credentialSectionPath(component)}/new`} />}
          className="ml-auto"
        >
          <PlusIcon aria-hidden="true" data-icon="inline-start" />
          New credential
        </Button>
      </div>
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
