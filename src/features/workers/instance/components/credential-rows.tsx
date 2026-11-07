import { KeyRoundIcon, ListPlusIcon, RefreshCwIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { DataListItem } from "@/components/data-list-item";
import { DisabledAction } from "@/components/disabled-action";
import { RecordName } from "@/components/record-name";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { utcDateTime } from "@/lib/format";
import type { CopyHolder } from "@/lib/instance-credential-draft";
import { machinePagePath } from "@/lib/worker-paths";
import type { InstanceCopyModelsState } from "../use-instance-copy-models";
import type { InstanceCredentialRotateState } from "../use-instance-credential-rotate";
import type { InstanceCopyHealthLine, InstanceCredentialRow } from "../use-instance-page";
import type { InstanceSignInState } from "../use-instance-sign-in";

function CopyHealthLine({
  health,
  holder,
  reportedBy,
}: {
  health: InstanceCopyHealthLine;
  holder: string;
  reportedBy: string | null;
}) {
  if (health.reportedAt === null || reportedBy === null) {
    return (
      <p className="text-sm text-muted-foreground">
        No report from <RecordName>{holder}</RecordName> for this revision since the server start.
      </p>
    );
  }
  return (
    <p className="text-sm">
      {health.hint !== null && `${health.hint} `}Reported by <RecordName>{reportedBy}</RecordName>{" "}
      at {utcDateTime(health.reportedAt)}.
    </p>
  );
}

function CopyAction({
  row,
  kind,
  rotate,
  models,
  signIn,
}: {
  row: InstanceCredentialRow;
  kind: CopyHolder["kind"];
  rotate: InstanceCredentialRotateState;
  models: InstanceCopyModelsState;
  signIn: InstanceSignInState;
}) {
  if (row.shape === "oauth") {
    const icon = <KeyRoundIcon aria-hidden="true" data-icon="inline-start" />;
    if (row.copy.sealed_current) {
      return (
        <DisabledAction
          label="Sign in again"
          reason={`The copy is live. The server refuses a new sign-in while the copy is sealed to the current key of the ${kind}.`}
          icon={icon}
        />
      );
    }
    return (
      <Button variant="outline" size="sm" onClick={() => signIn.start(row)}>
        {icon}
        Sign in again
      </Button>
    );
  }
  if (row.shape !== "api_key") return null;
  return (
    <>
      {row.modelsEditable && (
        <Button variant="outline" size="sm" onClick={() => models.start(row)}>
          <ListPlusIcon aria-hidden="true" data-icon="inline-start" />
          Edit models
        </Button>
      )}
      <Button variant="outline" size="sm" onClick={() => rotate.start(row.copy)}>
        <RefreshCwIcon aria-hidden="true" data-icon="inline-start" />
        Rotate
      </Button>
    </>
  );
}

function holderLineOf(copyHolder: string, holder: CopyHolder): ReactNode {
  if (holder.kind === "machine") return undefined;
  if (copyHolder === holder.name) return "Own copy";
  return (
    <>
      Shared from machine{" "}
      <Link to={machinePagePath(copyHolder)} className="underline underline-offset-4">
        {copyHolder}
      </Link>
    </>
  );
}

export function CredentialRows({
  rows,
  holder,
  archived,
  rotate,
  models,
  signIn,
}: {
  rows: readonly InstanceCredentialRow[];
  holder: CopyHolder;
  archived: boolean;
  rotate: InstanceCredentialRotateState;
  models: InstanceCopyModelsState;
  signIn: InstanceSignInState;
}) {
  if (rows.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No credential copies.</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <ItemGroup aria-label="Credentials" className="gap-2">
      {rows.map((row) => {
        const copy = row.copy;
        const own = copy.holder === holder.name;
        return (
          <DataListItem
            key={`${copy.holder}/${copy.name}`}
            title={
              <>
                <span className="font-mono break-all">{copy.name}</span> · {copy.platform}{" "}
                <span className="text-muted-foreground tabular-nums">(v{copy.revision})</span>
              </>
            }
            description={holderLineOf(copy.holder, holder)}
            status={
              row.health === null ? (
                <Badge variant="destructive">Re-enter</Badge>
              ) : (
                <Badge variant={row.health.variant}>{row.health.label}</Badge>
              )
            }
            notice={
              row.health === null ? (
                <p className="text-sm">Re-enter: sealed to an ended key.</p>
              ) : (
                <CopyHealthLine
                  health={row.health}
                  holder={copy.holder}
                  reportedBy={copy.health.reported_by}
                />
              )
            }
            actions={
              archived || !own ? undefined : (
                <CopyAction
                  row={row}
                  kind={holder.kind}
                  rotate={rotate}
                  models={models}
                  signIn={signIn}
                />
              )
            }
          />
        );
      })}
    </ItemGroup>
  );
}
