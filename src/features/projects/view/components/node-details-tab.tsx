import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { utcDateTime } from "@/lib/format";
import { nameOf, type GraphModel } from "@/lib/mission-graph";
import { closingEventText, resultVariant } from "@/lib/mission-labels";
import { badgeVariantOf, meaningOf } from "@/lib/node-state";
import { useBindingRecords } from "../use-binding-records";
import { useNodeRecord } from "../use-node-record";
import { BindingList } from "./binding-list";
import { FactList, type Fact } from "./fact-list";
import { NodeStructure } from "./node-structure";
import type { MissionNodeRecord } from "@/api/types";

interface NodeDetailsTabProps {
  readonly projectId: string;
  readonly model: GraphModel;
  readonly nodeId: string;
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
    { label: "Revision", value: `revision ${node.visibleRevision}` },
    {
      label: "Pinned by",
      value:
        node.pinnedByAttempts.length === 0
          ? "no attempt"
          : node.pinnedByAttempts.map((attempt) => `attempt ${attempt}`).join(", "),
    },
  );
  return facts;
}

function BlockedNotice({ node }: { node: MissionNodeRecord }) {
  if (node.kind === "task" || node.blockedContext === undefined) return null;
  const { outcome, requests } = node.blockedContext;
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
        <span>{closingEventText(outcome.closingEvent)}</span>
        <span>Closed {utcDateTime(outcome.createdAt)}</span>
        {requests.map((request) => (
          <span key={request.id}>
            Request {request.requirementKey}: {request.subject}, end state{" "}
            {request.endState ?? "not set"}
          </span>
        ))}
      </AlertDescription>
    </Alert>
  );
}

export function NodeDetailsTab({ projectId, model, nodeId, onSelect }: NodeDetailsTabProps) {
  const record = useNodeRecord(nodeId);
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

  const owner = node.kind === "task" && node.parentId !== null ? node.parentId : null;

  return (
    <div className="flex flex-col gap-5">
      <BlockedNotice node={node} />
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
        <h4 className="text-sm font-medium">Content of revision {node.visibleRevision}</h4>
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
          <h3 className="font-semibold">Bindings of revision {node.visibleRevision}</h3>
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
