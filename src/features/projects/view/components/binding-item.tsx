import { Loader2Icon, ShieldCheckIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import type { BindingSetEntry, EnvironmentState } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { isAvailable } from "@/lib/binding-change";
import { counted } from "@/lib/counted";
import { environmentStatusVariant } from "@/lib/environment-bar";
import type { BindingCheckBadge, BindingVerifyState } from "../use-binding-verify";

interface BindingItemProps {
  readonly name: string;
  readonly entry: BindingSetEntry;
  readonly bindingId: string | null;
  readonly environment: EnvironmentState | null;
  readonly revision: number | null;
  readonly verifyState: BindingVerifyState;
  readonly onVerify: () => void;
  readonly onEdit: () => void;
  readonly onRemove: () => void;
}

function instancesFact(instances: readonly string[]): ReactNode {
  if (instances.length === 0) return "no instances";
  return (
    <>
      instances{" "}
      {instances.map((instance, index) => (
        <Fragment key={instance}>
          {index > 0 && ", "}
          <RecordName>{instance}</RecordName>
        </Fragment>
      ))}
    </>
  );
}

function factsOf(entry: BindingSetEntry): readonly ReactNode[] {
  if (entry.kind === "repository") {
    const { config } = entry;
    return [
      config.address,
      <RecordName>{config.platform}</RecordName>,
      <>
        ssh <RecordName>{config.ssh_credential}</RecordName>
      </>,
      ...(config.credential !== undefined
        ? [
            <>
              credential <RecordName>{config.credential}</RecordName>
            </>,
          ]
        : []),
    ];
  }
  if (entry.kind === "worker") {
    const { config } = entry;
    return [
      <RecordName>{config.worker}</RecordName>,
      "worker_instances" in config
        ? instancesFact(config.worker_instances)
        : `instance count ${config.instance_count}`,
      config.resource_budget === undefined
        ? "worker default budget"
        : `budget ${counted(config.resource_budget.turns, "turn", "turns")}, ${config.resource_budget.wall_time_ms} ms`,
      `agent entries ${config.entries?.length ?? 0}`,
    ];
  }
  const { config } = entry;
  return [
    config.endpoint,
    <>
      bucket <RecordName>{config.bucket}</RecordName>
    </>,
    config.region,
    config.prefix === "" ? "no prefix" : `prefix ${config.prefix}`,
    <>
      credential <RecordName>{config.credential}</RecordName>
    </>,
  ];
}

function tagsOf(entry: BindingSetEntry): readonly string[] {
  return entry.kind === "worker" ? (entry.config.tags ?? []) : [];
}

function HealthBadge({ badge, label }: { badge: BindingCheckBadge; label: string }) {
  return (
    <Badge variant={badge.variant}>
      {badge.busy && (
        <Loader2Icon aria-hidden="true" data-icon="inline-start" className="animate-spin" />
      )}
      {label} · {badge.label}
    </Badge>
  );
}

export function BindingItem({
  name,
  entry,
  bindingId,
  environment,
  revision,
  verifyState,
  onVerify,
  onEdit,
  onRemove,
}: BindingItemProps) {
  const available = isAvailable(entry);
  const showVerify = entry.kind === "repository" && bindingId !== null;
  const tags = tagsOf(entry);

  return (
    <Item variant="outline" role="listitem">
      <ItemContent className="min-w-0">
        <ItemTitle className="w-full flex-wrap">
          <span className="min-w-0 font-mono break-all">{name}</span>
          {revision !== null && (
            <span className="text-muted-foreground tabular-nums">(v{revision})</span>
          )}
          <Badge variant={available ? "secondary" : "destructive"}>
            {available ? "available" : "unavailable"}
          </Badge>
          {environment !== null && environment.status !== "none" && (
            <Badge variant={environmentStatusVariant(environment.status)}>
              Environment · {environment.status}
            </Badge>
          )}
          {showVerify && (
            <span role="status" className="inline-flex gap-1">
              {verifyState.addressBadge !== null && (
                <HealthBadge badge={verifyState.addressBadge} label="Address" />
              )}
              {verifyState.sshCredentialBadge !== null && (
                <HealthBadge badge={verifyState.sshCredentialBadge} label="SSH credential" />
              )}
              {verifyState.credentialBadge !== null && (
                <HealthBadge badge={verifyState.credentialBadge} label="GitHub credential" />
              )}
            </span>
          )}
        </ItemTitle>
        <ItemDescription className="break-words">
          {factsOf(entry).map((fact, index) => (
            <Fragment key={index}>
              {index > 0 && " · "}
              {fact}
            </Fragment>
          ))}
        </ItemDescription>
        {showVerify && (
          <p
            role="status"
            aria-label={`Verify hint of ${name}`}
            className="flex flex-col text-sm break-words empty:hidden"
          >
            {verifyState.addressHint !== null && <span>{verifyState.addressHint}</span>}
            {verifyState.sshCredentialHint !== null && <span>{verifyState.sshCredentialHint}</span>}
          </p>
        )}
        {tags.length > 0 && (
          <ul aria-label={`Tags of ${name}`} className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <li key={tag}>
                <Badge variant="outline">{tag}</Badge>
              </li>
            ))}
          </ul>
        )}
      </ItemContent>
      <ItemActions className="basis-full md:basis-auto">
        {showVerify && (
          <Button
            variant="outline"
            size="sm"
            aria-label={`Verify ${name}`}
            aria-busy={verifyState.checking}
            disabled={verifyState.checking}
            onClick={onVerify}
          >
            <ShieldCheckIcon aria-hidden="true" data-icon="inline-start" />
            Verify
          </Button>
        )}
        <Button variant="outline" size="sm" aria-label={`Edit ${name}`} onClick={onEdit}>
          Edit
        </Button>
        <Button variant="outline" size="sm" aria-label={`Remove ${name}`} onClick={onRemove}>
          Remove
        </Button>
      </ItemActions>
    </Item>
  );
}
