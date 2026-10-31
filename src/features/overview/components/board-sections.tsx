import { Fragment, type ReactNode, type Ref, useRef, useState } from "react";
import { Link } from "react-router-dom";

import type {
  EnvironmentState,
  MissionAssessment,
  MissionNodeRecord,
  MissionProposal,
  Project,
} from "@/api/types";
import { RecordName } from "@/components/record-name";
import { TouchTarget } from "@/components/touch-target";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { approvalFactOf } from "@/lib/approval-attention";
import {
  type AttentionDetails,
  type AttentionItem,
  type BlockedDetail,
  type DependencyItem,
  detailOf,
} from "@/lib/attention";
import { changeAskedOf } from "@/lib/board-change";
import {
  type BoardEvidence,
  type EvidenceLine,
  evidenceOf,
  type TraceCause,
} from "@/lib/board-evidence";
import { type BoardGate, boardProjectsOf } from "@/lib/board-items";
import { actorNameOf, proposalSourceOf, suggestionOf } from "@/lib/board-suggestion";
import { detailTitleOf, heldText, positionText } from "@/lib/board-text";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";
import { causeSentenceOf } from "@/lib/external-requests";
import { spreadTextOf } from "@/lib/fix-attention";
import { badgeVariantOf } from "@/lib/node-state";
import { relativeAge } from "@/lib/relative-age";
import { causeLine } from "@/lib/trace-cause";

import { type BoardReadsValue, useBoardReadsContext } from "../use-board-reads";
import { useBoardActs } from "./board-acts";
import { BoardReadBlock } from "./board-read-block";
import { CauseText } from "./cause-text";
import { FixCauseText } from "./fix-cause-text";

export interface BoardPosition {
  readonly index: number;
  readonly total: number;
}

export interface HeldNode {
  readonly node: MissionNodeRecord;
  readonly project: Project;
}

interface BoardSectionsProps {
  readonly item: AttentionItem;
  readonly details: AttentionDetails;
  readonly tabName: string;
  readonly widthClass: BoardWidth;
  readonly position: BoardPosition | null;
  readonly now: number;
  readonly held: readonly HeldNode[];
  readonly environments: readonly EnvironmentState[] | null;
  readonly gate?: BoardGate | null;
  readonly titleId: string;
  readonly titleRef: Ref<HTMLHeadingElement>;
}

const TEXT_WIDTH = "max-w-[80ch] break-words";
const MUTED_TEXT = `text-sm text-muted-foreground ${TEXT_WIDTH}`;
const LOG_BLOCK =
  "min-w-0 rounded-md bg-muted p-2 font-mono text-xs break-words whitespace-pre-wrap";
const COMPACT_EVIDENCE_LINES = 3;

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      {children}
    </div>
  );
}

function WhatText({ item, now }: { readonly item: AttentionItem; readonly now: number }) {
  switch (item.kind) {
    case "blocked":
    case "paused":
    case "dependency_discarded":
      return <CauseText item={item} />;
    case "merge_wait":
    case "delivery_unconfirmed":
      return <>{causeSentenceOf(item, now)}</>;
    case "tool_approval":
      return (
        <>
          <RecordName>{item.agent}</RecordName> waits for your answer to {approvalFactOf(item)}.
        </>
      );
    default:
      return <FixCauseText item={item} />;
  }
}

function EnvironmentFailure({
  item,
  environments,
}: {
  readonly item: AttentionItem;
  readonly environments: readonly EnvironmentState[] | null;
}) {
  if (item.kind !== "environment_failed") return null;
  const failure = environments?.find((state) => state.binding_id === item.bindingId)?.failure;
  if (failure === null || failure === undefined) return null;
  return (
    <p className={`text-sm ${TEXT_WIDTH}`}>
      <RecordName>{failure.command}</RecordName>
      {failure.exit_code === null ? " did not finish." : ` exited with ${failure.exit_code}.`}{" "}
      Reproduce it with <RecordName>{failure.reproduce}</RecordName>.
    </p>
  );
}

function assessmentOf(detail: BlockedDetail | null): MissionAssessment | null {
  return detail?.assessment.status === "ready" ? detail.assessment.data : null;
}

function WhatSection({
  item,
  now,
  reads,
  evidence,
}: {
  readonly item: AttentionItem;
  readonly now: number;
  readonly reads: BoardReadsValue;
  readonly evidence: BoardEvidence;
}) {
  const failureLimit = item.kind === "paused" && item.pause?.cause === "failure-limit";
  const { failures } = evidence;
  return (
    <Section title="What">
      <p className={`text-sm ${TEXT_WIDTH}`}>
        <WhatText item={item} now={now} />
      </p>
      {failureLimit && (
        <BoardReadBlock
          name="the execution trace"
          read={reads.transition}
          onRetry={reads.retry.transition}
        >
          {() =>
            failures === null ? null : (
              <div>
                <Badge variant="outline">{`failures ${failures.count} of ${failures.limit}`}</Badge>
              </div>
            )
          }
        </BoardReadBlock>
      )}
    </Section>
  );
}

function ChangeAskedSection({ reads }: { readonly reads: BoardReadsValue }) {
  return (
    <Section title="Change asked">
      <BoardReadBlock name="the session" read={reads.session} onRetry={reads.retry.session}>
        {(pending) => {
          const change = changeAskedOf(pending);
          if (change === null)
            return <p className={`text-sm ${TEXT_WIDTH}`}>The call no longer waits.</p>;
          return (
            <div className="flex flex-col gap-2">
              <p className={`text-sm ${TEXT_WIDTH}`}>
                Operation <RecordName>{change.operationId}</RecordName>
              </p>
              {change.rows.map((row) => (
                <div key={row.field} className="flex flex-col gap-1">
                  <p className="text-sm font-medium break-words">{row.label}</p>
                  {row.json ? (
                    <pre className={LOG_BLOCK}>{row.text}</pre>
                  ) : (
                    <p className={`text-sm ${TEXT_WIDTH}`}>{row.text}</p>
                  )}
                </div>
              ))}
            </div>
          );
        }}
      </BoardReadBlock>
    </Section>
  );
}

function ProposalSection({
  proposals,
  read,
  onRetry,
}: {
  readonly proposals: readonly MissionProposal[];
  readonly read: BlockedDetail["proposals"] | null;
  readonly onRetry: () => void;
}) {
  return (
    <Section title="Proposal">
      <BoardReadBlock name="the proposals" read={read} onRetry={onRetry}>
        {() =>
          proposals.map((proposal) => (
            <div key={proposal.id} className="flex flex-col gap-1 rounded-md border p-3 text-sm">
              <p className="break-words">
                <RecordName>{proposal.content.name}</RecordName>
              </p>
              <p className={TEXT_WIDTH}>{proposal.content.requirement}</p>
              <ul className="flex flex-col gap-1">
                {proposal.content.task.verifications.map((verification, index) => (
                  <li key={`${index}:${verification}`}>
                    <code className="font-mono text-xs break-words">{verification}</code>
                  </li>
                ))}
              </ul>
            </div>
          ))
        }
      </BoardReadBlock>
    </Section>
  );
}

function Rationale({ assessment }: { readonly assessment: MissionAssessment | null }) {
  if (assessment === null) {
    return <p className={MUTED_TEXT}>The daemon holds no assessment for this outcome.</p>;
  }
  return (
    <figure className="flex flex-col gap-1">
      <blockquote className={`border-l-2 pl-3 text-sm ${TEXT_WIDTH}`}>
        {assessment.rationale}
      </blockquote>
      <figcaption className="text-sm text-muted-foreground">
        <cite className="not-italic">{actorNameOf(assessment.actor)}</cite>
      </figcaption>
    </figure>
  );
}

function DiscardReasons({
  item,
  reads,
}: {
  readonly item: DependencyItem;
  readonly reads: BoardReadsValue;
}) {
  return (
    <BoardReadBlock name="the discard reason" read={reads.discard} onRetry={reads.retry.discard}>
      {(reasons) =>
        item.discarded.map((dependency) => {
          const reason = reasons.find((candidate) => candidate.id === dependency.id)?.reason;
          return (
            <p key={dependency.id} className={`text-sm ${TEXT_WIDTH}`}>
              You discarded <RecordName>{dependency.name}</RecordName>.{" "}
              {reason === null || reason === undefined
                ? "No reason is recorded."
                : `Reason: "${reason}"`}
            </p>
          );
        })
      }
    </BoardReadBlock>
  );
}

function RootCauseText({
  item,
  trace,
}: {
  readonly item: AttentionItem;
  readonly trace: TraceCause | null;
}) {
  if (trace?.cause != null) {
    return (
      <>
        <p className={`text-sm ${TEXT_WIDTH}`}>{causeLine(trace.cause)}</p>
        <p className={MUTED_TEXT}>assigned by {trace.cause.assigner}</p>
      </>
    );
  }
  const undetermined =
    item.kind === "blocked" && item.node.blocked_context?.outcome.result === "undetermined";
  return (
    <p className={`text-sm ${TEXT_WIDTH}`}>
      {undetermined
        ? "No cause assigned: the assessment was undetermined."
        : "No cause: this is a wait, not a fault."}
    </p>
  );
}

function EvidenceRow({ line }: { readonly line: EvidenceLine }) {
  if (line.kind === "log") {
    return (
      <li>
        <pre className={LOG_BLOCK}>{line.text}</pre>
      </li>
    );
  }
  return (
    <li className={`text-sm ${TEXT_WIDTH}`}>
      {line.text}
      {line.command !== null && (
        <>
          {" "}
          <code className="font-mono text-xs break-words">{line.command}</code>
        </>
      )}
      {line.links.map((link) => (
        <Fragment key={link.to}>
          {" "}
          <Link className="underline underline-offset-4" to={link.to}>
            {link.label}
          </Link>
        </Fragment>
      ))}
    </li>
  );
}

function EvidenceList({
  lines,
  collapsible,
}: {
  readonly lines: readonly EvidenceLine[];
  readonly collapsible: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const list = useRef<HTMLUListElement>(null);
  const hidden = collapsible && !expanded ? lines.length - COMPACT_EVIDENCE_LINES : 0;
  const shown = hidden > 0 ? lines.slice(0, COMPACT_EVIDENCE_LINES) : lines;

  const showAll = () => {
    setExpanded(true);
    list.current?.focus();
  };

  return (
    <>
      <ul ref={list} tabIndex={-1} aria-label="Evidence lines" className="flex flex-col gap-1">
        {shown.map((line) => (
          <EvidenceRow key={line.key} line={line} />
        ))}
      </ul>
      {hidden > 0 && (
        <div>
          <TouchTarget>
            <Button variant="outline" size="sm" onClick={showAll}>
              Show {hidden} more
            </Button>
          </TouchTarget>
        </div>
      )}
    </>
  );
}

function EvidenceSection({
  item,
  reads,
  evidence,
  widthClass,
}: {
  readonly item: AttentionItem;
  readonly reads: BoardReadsValue;
  readonly evidence: BoardEvidence;
  readonly widthClass: BoardWidth;
}) {
  const blocked = item.kind === "blocked";
  const settled = !blocked || reads.evidence?.status === "ready";
  const { lines } = evidence;
  return (
    <Section title="Evidence">
      {blocked && (
        <BoardReadBlock name="the evidence" read={reads.evidence} onRetry={reads.retry.evidence}>
          {() => null}
        </BoardReadBlock>
      )}
      {lines.length > 0 && (
        <EvidenceList
          key={item.id}
          lines={lines}
          collapsible={widthClass === BOARD_WIDTH.Compact}
        />
      )}
      {lines.length === 0 && settled && <p className={MUTED_TEXT}>No execution recorded.</p>}
    </Section>
  );
}

export function BoardSections({
  item,
  details,
  tabName,
  widthClass,
  position,
  now,
  held,
  environments,
  gate = null,
  titleId,
  titleRef,
}: BoardSectionsProps) {
  const { read, proposals, unresolved, retry } = useBoardActs();
  const reads = useBoardReadsContext();
  const spread = item.group === "fixes" ? spreadTextOf(item) : null;
  const detail = item.kind === "blocked" ? detailOf(details, item.node) : null;
  const blockedDetail = detail?.kind === "blocked" ? detail : null;
  const evidence = evidenceOf(item, reads, environments);
  const proposalsRead = blockedDetail?.proposals ?? null;
  const showProposals =
    item.kind === "blocked" && (proposals.length > 0 || proposalsRead?.status === "failed");
  const suggestion = suggestionOf(
    item,
    gate,
    proposalSourceOf(proposals, assessmentOf(blockedDetail)),
  );

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {boardProjectsOf(item).map((project) => (
            <Badge key={project.id} variant="outline">
              {project.name}
            </Badge>
          ))}
          <Badge variant="secondary">{tabName}</Badge>
          {"node" in item && (
            <Badge variant={badgeVariantOf(item.node.state)}>{item.node.state}</Badge>
          )}
          <span className="text-sm text-muted-foreground">
            {item.at === null ? "age unknown" : relativeAge(item.at, now)}
          </span>
        </div>
        <div className="flex items-start justify-between gap-2">
          <h3
            id={titleId}
            ref={titleRef}
            tabIndex={-1}
            className="text-base font-semibold break-words"
          >
            {detailTitleOf(item, details)}
          </h3>
          {widthClass === BOARD_WIDTH.Expanded && position !== null && (
            <span className="shrink-0 text-sm text-muted-foreground">
              {positionText(position.index, position.total)}
            </span>
          )}
        </div>
      </div>
      <WhatSection item={item} now={now} reads={reads} evidence={evidence} />
      {item.kind === "tool_approval" && <ChangeAskedSection reads={reads} />}
      {showProposals && (
        <ProposalSection proposals={proposals} read={proposalsRead} onRetry={retry} />
      )}
      <Section title="Impact">
        {spread !== null && <p className={`text-sm ${TEXT_WIDTH}`}>{spread}</p>}
        <p className={`text-sm ${TEXT_WIDTH}`}>
          {held.length === 0 ? "No node waits on this card." : `${heldText(held.length)} in total.`}
        </p>
        {held.length > 0 && (
          <ul className="flex flex-col gap-1">
            {held.map(({ node, project }) => (
              <li key={node.id} className="flex flex-wrap items-center gap-1.5 text-sm">
                <RecordName>{node.content.name}</RecordName>
                <span className="text-muted-foreground">in {project.name}</span>
                <Badge variant={badgeVariantOf(node.state)}>{node.state}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Why">
        {item.kind === "blocked" && (
          <BoardReadBlock
            name="the assessment"
            read={blockedDetail?.assessment ?? null}
            onRetry={retry}
          >
            {(assessment) => <Rationale assessment={assessment} />}
          </BoardReadBlock>
        )}
        {item.kind === "dependency_discarded" && <DiscardReasons item={item} reads={reads} />}
        {read !== null && !read.failed && <p className={MUTED_TEXT}>{read.text}</p>}
        {unresolved !== null && <p className={MUTED_TEXT}>{unresolved}</p>}
        <EnvironmentFailure item={item} environments={environments} />
      </Section>
      <Section title="Root cause">
        {item.kind === "dependency_discarded" ? (
          <p className={`text-sm ${TEXT_WIDTH}`}>No fault. A human act ended the dependency.</p>
        ) : (
          <BoardReadBlock name="the execution trace" read={reads.cause} onRetry={reads.retry.cause}>
            {(trace) => <RootCauseText item={item} trace={trace} />}
          </BoardReadBlock>
        )}
      </Section>
      <EvidenceSection item={item} reads={reads} evidence={evidence} widthClass={widthClass} />
      <Section title="Suggestion">
        <p className={`text-sm ${TEXT_WIDTH}`}>{suggestion.text}</p>
        <p className={MUTED_TEXT}>{suggestion.source}</p>
      </Section>
    </div>
  );
}
