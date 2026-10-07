import type { MissionAttempt } from "@/api/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Item, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/ui/item";
import { Skeleton } from "@/components/ui/skeleton";
import { utcDateTime } from "@/lib/format";
import { nameOf, type GraphModel } from "@/lib/mission-graph";
import {
  actorText,
  assetText,
  claimStateVariant,
  closingEventText,
  resolutionVariant,
  resultVariant,
  verificationResultText,
} from "@/lib/mission-labels";
import { useAttemptRecords } from "../use-attempt-records";
import { BindingList } from "./binding-list";
import { FactList } from "./fact-list";
import { RecordSection } from "./record-section";

interface AttemptRecordsProps {
  readonly projectId: string;
  readonly model: GraphModel;
  readonly attempt: MissionAttempt;
  readonly currentRevision: number;
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted-foreground">{text}</p>;
}

export function AttemptRecords({
  projectId,
  model,
  attempt,
  currentRevision,
}: AttemptRecordsProps) {
  const records = useAttemptRecords(projectId, attempt);

  if (records.loading) return <Skeleton className="h-32 w-full" />;
  if (records.data === null) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{records.error?.message}</AlertDescription>
      </Alert>
    );
  }
  const { revision, executions, evidence, assessments, outcomes, externalActions, bindings } =
    records.data;
  const subjectOf = (id: string) => evidence.data?.find((item) => item.id === id)?.subject ?? id;
  const bindingName = (id: string) => {
    const read = bindings.get(id);
    return read?.data === undefined || read.data === null
      ? id
      : `${read.data.name} revision ${read.data.revision}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <RecordSection title={`Pinned revision ${attempt.node_revision}`} read={revision}>
        {(pinned) => (
          <div className="flex flex-col gap-2">
            {pinned.revision !== currentRevision && (
              <p className="text-sm">
                The attempt pins revision {pinned.revision}. The node is now at revision{" "}
                {currentRevision}, so the content below can differ from the current content.
              </p>
            )}
            <FactList
              facts={[
                { label: "Requirement", value: pinned.content.requirement },
                { label: "Criterion", value: pinned.content.criterion },
                {
                  label: "Verifications",
                  value: (
                    <span className="font-mono text-xs break-all">
                      {pinned.content.verifications.join(" · ")}
                    </span>
                  ),
                },
              ]}
            />
            <BindingList
              label={`Bindings of revision ${pinned.revision}`}
              bindingIds={pinned.content.bindings}
              reads={bindings}
            />
          </div>
        )}
      </RecordSection>

      <RecordSection title="Executions" read={executions}>
        {(items) =>
          items.length === 0 ? (
            <Empty text="No execution claimed this attempt." />
          ) : (
            <ItemGroup aria-label="Executions">
              {items.map((item) => (
                <Item key={item.execution_id} variant="outline" size="sm" role="listitem">
                  <ItemContent className="min-w-0">
                    <ItemTitle className="w-full flex-wrap">
                      <span className="break-all">
                        {item.claimant.name ?? item.claimant.runtime_identity}
                      </span>
                      <Badge variant={claimStateVariant(item.claim_state)}>
                        {item.claim_state}
                      </Badge>
                    </ItemTitle>
                    <ItemDescription className="flex flex-col gap-0.5">
                      <span className="font-mono text-xs break-all">{item.execution_id}</span>
                      <span className="break-all">{item.claimant.resource_identity}</span>
                      <span>
                        Claimed {utcDateTime(item.created_at)}
                        {item.ended_at === null ? "" : `, ended ${utcDateTime(item.ended_at)}`}
                        {`, deadline ${utcDateTime(item.expired_at)}`}
                      </span>
                      <span className="font-mono text-xs break-all">trace {item.trace_id}</span>
                    </ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          )
        }
      </RecordSection>

      <RecordSection title="Outcomes" read={outcomes}>
        {(items) =>
          items.length === 0 ? (
            <Empty text="The attempt holds no outcome." />
          ) : (
            <ItemGroup aria-label="Outcomes">
              {items.map((item) => {
                const basis = assessments.data?.find((entry) => entry.id === item.assessment_id);
                return (
                  <Item key={item.id} variant="outline" size="sm" role="listitem">
                    <ItemContent className="min-w-0">
                      <ItemTitle className="w-full flex-wrap">
                        Outcome <Badge variant={resultVariant(item.result)}>{item.result}</Badge>
                      </ItemTitle>
                      <ItemDescription className="flex flex-col gap-0.5">
                        <span>{closingEventText(item.closing_event)}</span>
                        <span>Written {utcDateTime(item.created_at)}</span>
                        <span className="break-words">
                          Basis:{" "}
                          {basis === undefined
                            ? item.assessment_id
                            : `${basis.result} assessment by ${actorText(basis.actor)}`}
                        </span>
                        {item.evidence_ids.length > 0 && (
                          <span className="break-words">
                            Evidence: {item.evidence_ids.map(subjectOf).join(", ")}
                          </span>
                        )}
                      </ItemDescription>
                    </ItemContent>
                  </Item>
                );
              })}
            </ItemGroup>
          )
        }
      </RecordSection>

      <RecordSection title="Assessments" read={assessments}>
        {(items) =>
          items.length === 0 ? (
            <Empty text="No assessment judged this attempt." />
          ) : (
            <ItemGroup aria-label="Assessments">
              {items.map((item) => (
                <Item key={item.id} variant="outline" size="sm" role="listitem">
                  <ItemContent className="min-w-0">
                    <ItemTitle className="w-full flex-wrap">
                      <Badge variant={resultVariant(item.result)}>{item.result}</Badge>
                      <span className="break-all">{actorText(item.actor)}</span>
                    </ItemTitle>
                    <ItemDescription className="flex flex-col gap-0.5">
                      <span className="break-words text-foreground">{item.rationale}</span>
                      <span>
                        Accepted {utcDateTime(item.created_at)} on revision {item.node_revision}
                        {item.worker_version === null ? "" : ` by ${item.worker_version}`}
                      </span>
                      <span className="break-words">
                        {item.currency === null
                          ? "A human assessment has no currency check."
                          : item.currency.current
                            ? "The assessment is current."
                            : `The assessment is not current: ${item.currency.reasons.join(" ")}`}
                      </span>
                      {item.evidence_ids.length > 0 && (
                        <span className="break-words">
                          Evidence: {item.evidence_ids.map(subjectOf).join(", ")}
                        </span>
                      )}
                      {item.child_node_ids.length > 0 && (
                        <span className="break-words">
                          Child outcomes of:{" "}
                          {item.child_node_ids.map((id) => nameOf(model, id)).join(", ")}
                        </span>
                      )}
                    </ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          )
        }
      </RecordSection>

      <RecordSection title="Evidence" read={evidence}>
        {(items) =>
          items.length === 0 ? (
            <Empty text="The attempt holds no evidence." />
          ) : (
            <ItemGroup aria-label="Evidence">
              {items.map((item) => (
                <Item key={item.id} variant="outline" size="sm" role="listitem">
                  <ItemContent className="min-w-0">
                    <ItemTitle className="w-full flex-wrap">
                      <span className="break-words">{item.subject}</span>
                      {item.requirement_key !== undefined && (
                        <Badge variant="outline">request</Badge>
                      )}
                    </ItemTitle>
                    <ItemDescription className="flex flex-col gap-0.5">
                      <span className="break-all">
                        {actorText(item.provenance)}, {utcDateTime(item.created_at)}
                      </span>
                      {item.requirement_key !== undefined && (
                        <span className="break-all">
                          Request {item.requirement_key}, end state {item.end_state ?? "not set"}
                        </span>
                      )}
                      {item.assets.map((asset) => (
                        <span key={asset.id} className="break-all">
                          {assetText(asset)}
                          {asset.published_at === null ? " (not published)" : ""}
                        </span>
                      ))}
                      {item.verification?.results.map((result, index) => (
                        <span key={`${index}-${result.command}`} className="break-all">
                          <span className="font-mono text-xs">{result.command}</span>:{" "}
                          {verificationResultText(result)}
                        </span>
                      ))}
                    </ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          )
        }
      </RecordSection>

      <RecordSection title="External actions" read={externalActions}>
        {(items) =>
          items.length === 0 ? (
            <Empty text="The attempt requires no external action." />
          ) : (
            <ItemGroup aria-label="External actions">
              {items.map((item) => (
                <Item key={item.action.key} variant="outline" size="sm" role="listitem">
                  <ItemContent className="min-w-0">
                    <ItemTitle className="w-full flex-wrap">
                      <span className="font-mono break-all">{item.action.key}</span>
                      <Badge variant={resolutionVariant(item.resolution)}>{item.resolution}</Badge>
                    </ItemTitle>
                    <ItemDescription className="flex flex-col gap-0.5">
                      <span className="break-all">
                        {item.action.action} on {bindingName(item.action.binding_id)}, base{" "}
                        {item.action.configuration.base_branch}
                      </span>
                      <span>Expected end state {item.action.expected_end_state}</span>
                      {item.request_evidence_id !== null && (
                        <span className="break-words">
                          Request: {subjectOf(item.request_evidence_id)}
                        </span>
                      )}
                    </ItemDescription>
                  </ItemContent>
                </Item>
              ))}
            </ItemGroup>
          )
        }
      </RecordSection>
    </div>
  );
}
