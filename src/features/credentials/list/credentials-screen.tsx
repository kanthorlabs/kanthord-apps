import { FileCogIcon, HistoryIcon, PlusIcon, RefreshCwIcon, ShieldCheckIcon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

import { CREDENTIAL_PLATFORMS, type Credential } from "@/api/types";
import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { liveRevisionCount, newestLiveRevision } from "@/lib/credential-revisions";
import { utcDateTime } from "@/lib/format";
import { CredentialHealthLine } from "../components/credential-health-line";
import { MetadataSheet } from "../components/metadata-sheet";
import { RotateSheet } from "../components/rotate-sheet";
import { useCredentialHealth } from "../use-credential-health";
import { useCredentialRotate } from "../use-credential-rotate";
import { useMetadataEdit } from "../use-metadata-edit";
import { useCredentialList } from "./use-credential-list";

const ALL_PLATFORMS = "all";

const PLATFORM_ITEMS = [
  { value: ALL_PLATFORMS, label: "All platforms" },
  ...CREDENTIAL_PLATFORMS.map((platform) => ({ value: platform, label: platform })),
];

interface CredentialItemProps {
  readonly credential: Credential;
  readonly reload: () => void;
}

function CredentialItem({ credential, reload }: CredentialItemProps) {
  const navigate = useNavigate();
  const health = useCredentialHealth();
  const rotate = useCredentialRotate(credential, reload);
  const metadata = useMetadataEdit(credential, reload);
  const newest = newestLiveRevision(credential);
  const name = credential.name;
  const detailPath = `/credentials/${encodeURIComponent(name)}`;

  return (
    <>
      <DataListItem
        title={name}
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
          { label: "Updated", value: newest === null ? "—" : utcDateTime(newest.createdAt) },
        ]}
        notice={
          health.state.status === "idle" ? undefined : (
            <CredentialHealthLine name={name} state={health.state} onVerify={health.verify} />
          )
        }
        actions={
          <div className="flex flex-wrap gap-2 md:w-[27rem]">
            <Button
              variant="outline"
              size="sm"
              aria-label={`Verify ${name}`}
              disabled={health.state.status === "checking"}
              onClick={health.verify}
            >
              <ShieldCheckIcon aria-hidden="true" data-icon="inline-start" />
              Verify
            </Button>
            {rotate.expectedRevision !== null && (
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
      <RotateSheet name={name} platform={credential.platform} rotate={rotate} />
      <MetadataSheet name={name} platform={credential.platform} edit={metadata} />
    </>
  );
}

export function CredentialsScreen() {
  const { pages, platform, selectPlatform } = useCredentialList();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <Field className="md:max-w-56">
          <FieldLabel htmlFor="credential-platform-filter">Platform</FieldLabel>
          <Select
            items={PLATFORM_ITEMS}
            value={platform ?? ALL_PLATFORMS}
            onValueChange={selectPlatform}
          >
            <SelectTrigger id="credential-platform-filter" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORM_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button nativeButton={false} render={<Link to="/credentials/new" />} size="lg">
          <PlusIcon aria-hidden="true" data-icon="inline-start" />
          New credential
        </Button>
      </div>
      <DataList
        label="Credentials"
        items={pages.items}
        getKey={(credential) => credential.name}
        renderItem={(credential) => (
          <CredentialItem credential={credential} reload={pages.reload} />
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
