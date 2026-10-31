import type { ReactNode, Ref } from "react";
import { Link } from "react-router-dom";

import type { EnvironmentState, MissionNodeRecord, Project } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { TouchTarget } from "@/components/touch-target";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { approvalFactOf } from "@/lib/approval-attention";
import { type AttentionDetails, type AttentionItem, detailOf } from "@/lib/attention";
import { boardProjectsOf } from "@/lib/board-items";
import { detailTitleOf, heldText, positionText } from "@/lib/board-text";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";
import { causeSentenceOf } from "@/lib/external-requests";
import { spreadTextOf } from "@/lib/fix-attention";
import { badgeVariantOf } from "@/lib/node-state";
import { relativeAge } from "@/lib/relative-age";
import { causeLine } from "@/lib/trace-cause";

import { AssessmentPanel } from "./assessment-panel";
import { useBoardActs } from "./board-acts";
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
  readonly titleId: string;
  readonly titleRef: Ref<HTMLHeadingElement>;
}

const TEXT_WIDTH = "max-w-[80ch] break-words";

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

export function BoardSections({
  item,
  details,
  tabName,
  widthClass,
  position,
  now,
  held,
  environments,
  titleId,
  titleRef,
}: BoardSectionsProps) {
  const { read, proposals, unresolved, lastTrace, retry } = useBoardActs();
  const spread = item.group === "fixes" ? spreadTextOf(item) : null;
  const blockedDetail = item.kind === "blocked" ? detailOf(details, item.node) : null;

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
      <Section title="What">
        <p className={`text-sm ${TEXT_WIDTH}`}>
          <WhatText item={item} now={now} />
        </p>
      </Section>
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
          <AssessmentPanel
            item={item}
            detail={blockedDetail?.kind === "blocked" ? blockedDetail : null}
            proposals={proposals}
            onRetry={retry}
          />
        )}
        {read !== null && !read.failed && (
          <p className={`text-sm text-muted-foreground ${TEXT_WIDTH}`}>{read.text}</p>
        )}
        {unresolved !== null && (
          <p className={`text-sm text-muted-foreground ${TEXT_WIDTH}`}>{unresolved}</p>
        )}
        <EnvironmentFailure item={item} environments={environments} />
      </Section>
      <Section title="Root cause">
        <p className={`text-sm ${TEXT_WIDTH}`}>
          {lastTrace?.cause == null
            ? "No cause: this is a wait, not a fault."
            : causeLine(lastTrace.cause)}
        </p>
      </Section>
      <Section title="Evidence">
        {lastTrace === null ? (
          <p className={`text-sm text-muted-foreground ${TEXT_WIDTH}`}>No execution recorded.</p>
        ) : (
          <div>
            <TouchTarget>
              <Button
                nativeButton={false}
                render={<Link to={`/traces/${encodeURIComponent(lastTrace.id)}`} />}
                variant="outline"
                size="sm"
              >
                Last trace
              </Button>
            </TouchTarget>
          </div>
        )}
      </Section>
    </div>
  );
}
