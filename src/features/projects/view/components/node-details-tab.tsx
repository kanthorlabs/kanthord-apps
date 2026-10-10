import { useCallback } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { utcDateTime } from "@/lib/format";
import { nameOf, type GraphModel } from "@/lib/mission-graph";
import { closingEventText, resultVariant } from "@/lib/mission-labels";
import { badgeVariantOf, meaningOf } from "@/lib/node-state";
import { useBindingRecords } from "../use-binding-records";
import { useNodeProposals } from "../use-node-proposals";
import { useNodeRecord } from "../use-node-record";
import { BindingList } from "./binding-list";
import { FactList, type Fact } from "./fact-list";
import { NodeControls } from "./node-controls";
import { NodeStructure } from "./node-structure";
import { ProposalSection } from "./proposal-section";
import type { MissionNodeRecord } from "@/api/types";

interface NodeDetailsTabProps {
  readonly projectId: string;
  readonly model: GraphModel;
  readonly nodeId: string;
  readonly missionVersion: number;
  readonly onChanged: () => void;
  readonly onSelect: (nodeId: string) => void;
}

function factsOf(node: MissionNodeRecord): Fact[] {
  const facts: Fact[] = [
    { label: "Identity", value: <span className="font-mono text-xs break-all">{node.id}</span> },
    { label: "Kind", value: node.kind },
    { label: "Plan file", value: <span className="font-mono text-xs">{node.filename}</span> },
  ];
  if (node.kind !== "task") {
    facts.push(
      {
        label: "State",
        value: (
          <span className="flex flex-col items-start gap-1">
            <Badge variant={badgeVariantOf(node.state)}>{node.state}</Badge>
            <span className="text-muted-foreground">{meaningOf(node.state)}</span>
          </span>
        ),
      },
      {
        label: "Attempt",
        value: node.attempt === 0 ? "no attempt opened" : `attempt ${node.attempt}`,
      },
      { label: "Priority", value: String(node.priority) },
    );
  }
  facts.push(
    { label: "Revision", value: `revision ${node.visible_revision}` },
    {
      label: "Pinned by",
      value:
        node.pinned_by_attempts.length === 0
          ? "no attempt"
          : node.pinned_by_attempts.map((attempt) => `attempt ${attempt}`).join(", "),
    },
  );
  return facts;
}

function BlockedNotice({ node }: { node: MissionNodeRecord }) {
  if (node.kind === "task" || node.blocked_context === undefined) return null;
  const { outcome, requests } = node.blocked_context;
  return (
    <Alert variant="destructive">
      <AlertTitle>
        The node is blocked after attempt{" "}
        {outcome.attempt === 0 ? "0 (no attempt opened)" : outcome.attempt}.
      </AlertTitle>
      <AlertDescription className="flex flex-col gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          Outcome <Badge variant={resultVariant(outcome.result)}>{outcome.result}</Badge>
        </span>
        <span>{closingEventText(outcome.closing_event)}</span>
        <span>Closed {utcDateTime(outcome.created_at)}</span>
        {requests.map((request) => (
          <span key={request.id}>
            Request {request.requirement_key}: {request.subject}, end state{" "}
            {request.end_state ?? "not set"}
          </span>
        ))}
      </AlertDescription>
    </Alert>
  );
}

export function NodeDetailsTab({
  projectId,
  model,
  nodeId,
  missionVersion,
  onChanged,
  onSelect,
}: NodeDetailsTabProps) {
  const record = useNodeRecord(nodeId);
  const { reload: reloadRecord } = record;
  const proposals = useNodeProposals(nodeId, model.nodeById.get(nodeId)?.kind === "initiative");
  const { reload: reloadProposals } = proposals;
  const reloadAll = useCallback(() => {
    reloadRecord();
    reloadProposals();
    onChanged();
  }, [reloadRecord, reloadProposals, onChanged]);
  const bindingIds = record.data?.content.bindings ?? [];
  const bindings = useBindingRecords(projectId, bindingIds);
  const node = record.data;

  if (record.loading) return <Skeleton className="h-48 w-full" />;
  if (record.error !== null || node === null) {
    return (
      <Alert variant="destructive">
        <AlertDescription className="flex flex-col items-start gap-2">
          {record.error?.message}
          <Button variant="outline" size="sm" onClick={record.reload}>
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  const owner = node.kind === "task" && node.parent_id !== null ? node.parent_id : null;

  return (
    <div className="flex flex-col gap-5">
      <BlockedNotice node={node} />
      {node.kind !== "task" && (
        <NodeControls
          node={node}
          missionVersion={missionVersion}
          proposals={proposals.data ?? []}
          onChanged={reloadAll}
        />
      )}
      {node.kind === "initiative" && (
        <ProposalSection
          model={model}
          initiative={node}
          proposals={proposals}
          missionVersion={missionVersion}
          onChanged={reloadAll}
          onSelect={onSelect}
        />
      )}
      {owner !== null && (
        <p className="text-sm">
          A task holds no state, no attempt and no revision of its own. Its objective{" "}
          <Button variant="link" size="sm" onClick={() => onSelect(owner)}>
            {nameOf(model, owner)}
          </Button>{" "}
          holds them.
        </p>
      )}
      <FactList facts={factsOf(node)} />
      <section aria-label="Content" className="flex flex-col gap-2">
        <h4 className="text-sm font-medium">Content of revision {node.visible_revision}</h4>
        <FactList
          facts={[
            { label: "Requirement", value: node.content.requirement },
            { label: "Criterion", value: node.content.criterion },
            {
              label: "Verifications",
              value: (
                <ol className="flex list-decimal flex-col gap-0.5 pl-4">
                  {node.content.verifications.map((command, index) => (
                    <li key={`${index}-${command}`} className="font-mono text-xs break-all">
                      {command}
                    </li>
                  ))}
                </ol>
              ),
            },
          ]}
        />
      </section>
      <section aria-label="Structure" className="flex flex-col gap-2">
        <h3 className="font-semibold">Structure</h3>
        <NodeStructure model={model} nodeId={nodeId} onSelect={onSelect} />
      </section>
      {node.kind !== "task" && (
        <section aria-label="Bindings" className="flex flex-col gap-2">
          <h3 className="font-semibold">Bindings of revision {node.visible_revision}</h3>
          {bindings.loading ? (
            <Skeleton className="h-16 w-full" />
          ) : bindings.data === null ? (
            <Alert variant="destructive">
              <AlertDescription>{bindings.error?.message}</AlertDescription>
            </Alert>
          ) : (
            <BindingList
              label="Bindings of the current revision"
              bindingIds={bindingIds}
              reads={bindings.data}
            />
          )}
        </section>
      )}
    </div>
  );
}
