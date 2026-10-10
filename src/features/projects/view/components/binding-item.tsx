import { Loader2Icon, ShieldCheckIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import type { BindingSetEntry } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { isAvailable } from "@/lib/binding-change";
import type { BindingCheckBadge, BindingVerifyState } from "../use-binding-verify";

interface BindingItemProps {
  readonly name: string;
  readonly entry: BindingSetEntry;
  readonly bindingId: string | null;
  readonly revision: number | null;
  readonly verifyState: BindingVerifyState;
  readonly onVerify: () => void;
  readonly onEdit: () => void;
  readonly onRemove: () => void;
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
      `instance count ${config.instance_count}`,
      config.resource_budget === undefined
        ? "worker default budget"
        : `budget ${config.resource_budget.turns} turns, ${config.resource_budget.wall_time_ms} ms`,
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
  revision,
  verifyState,
  onVerify,
  onEdit,
  onRemove,
}: BindingItemProps) {
  const available = isAvailable(entry);
  const showVerify = entry.kind === "repository" && bindingId !== null;

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
