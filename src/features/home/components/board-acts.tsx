import { type ReactNode, useMemo, useState } from "react";

import { FollowupDecisionDialog } from "@/components/followup-decision-dialog";
import { FindingDecisionDialog } from "@/components/finding-decision-dialog";
import { NodeDiscardDialog } from "@/components/node-discard-dialog";
import { NodeOverrideDialog } from "@/components/node-override-dialog";
import { NodeResumeDialog } from "@/components/node-resume-dialog";
import { NodeUnblockDialog } from "@/components/node-unblock-dialog";
import { ProposalDecisionDialog } from "@/components/proposal-decision-dialog";
import { FindingReportSheet } from "@/components/finding-report-sheet";
import type { ToolApprovalItem } from "@/lib/approval-attention";
import {
  type AttentionDetails,
  type AttentionItem,
  type DecisionAttentionItem,
  detailOf,
  type FindingReviewItem,
  type FollowupItem,
  type OutsideAttentionItem,
  type ProjectSnapshot,
} from "@/lib/attention";
import {
  type BoardAct,
  credentialRefusedActsOf,
  environmentFailedActsOf,
  findingReviewActsOf,
  fixTargetActsOf,
  followupActsOf,
  type GateRoute,
  outsideActsOf,
  outsideReadOf,
  projectPausedActsOf,
  toolApprovalActsOf,
} from "@/lib/board-acts";
import { type BoardGate, pausedNodeCountOf } from "@/lib/board-items";
import type { CredentialRefusedItem, EnvironmentFailedItem } from "@/lib/fix-attention";

import {
  type ActsContext,
  type ActsStore,
  BoardActsContext,
  BoardFrameContext,
  createActsStore,
  stateOf,
  useDecisionBoardActs,
  usePublished,
} from "../use-board-acts";
import { useBoardChecks } from "../use-board-checks";
import { useBoardReadsContext } from "../use-board-reads";
import { useBoardRotate } from "../use-board-rotate";
import { useFindingReviewActs } from "../use-finding-review-acts";
import { useFollowupActs } from "../use-followup-acts";
import { useBoardToolActs } from "../use-board-tool-acts";
import { useOutsideActs } from "../use-outside-acts";
import { BoardRotateSheet } from "./board-rotate-sheet";
import { DependencyRemoveDialog } from "./dependency-remove-dialog";
import { FindingDecideSheet } from "./finding-decide-sheet";
import { InboxActs } from "./inbox-acts";

interface BoardActsProviderProps extends ActsContext {
  readonly snapshots: readonly ProjectSnapshot[];
  readonly gate?: BoardGate | null;
  readonly jump?: (itemId: string) => void;
  readonly item: AttentionItem | null;
  readonly details: AttentionDetails;
  readonly children: ReactNode;
}

function DecisionActs({
  store,
  item,
  details,
  route,
  ...context
}: ActsContext & {
  readonly store: ActsStore;
  readonly item: DecisionAttentionItem;
  readonly details: AttentionDetails;
  readonly route: GateRoute | null;
}) {
  const { node } = item;
  const acts = useDecisionBoardActs(store, item, details, route, context);
  return (
    <>
      <NodeUnblockDialog name={node.content.name} unblock={acts.unblock} />
      <ProposalDecisionDialog name={node.content.name} decision={acts.decide} />
      <NodeResumeDialog name={node.content.name} resume={acts.resume} />
      <NodeOverrideDialog name={node.content.name} override={acts.override} />
      <DependencyRemoveDialog name={node.content.name} remove={acts.remove} />
      <NodeDiscardDialog name={node.content.name} discard={acts.discard} />
    </>
  );
}

function FindingReviewActs({
  store,
  item,
  ...context
}: ActsContext & { readonly store: ActsStore; readonly item: FindingReviewItem }) {
  const { decision, report } = useFindingReviewActs(item, context);
  const [deciding, setDeciding] = useState(false);
  usePublished(store, stateOf(findingReviewActsOf(item, () => setDeciding(true))));
  return (
    <>
      <FindingDecideSheet
        item={item}
        open={deciding}
        assessments={report.assessments}
        onOpenChange={setDeciding}
        onDecide={decision.request}
        onEdit={report.requestEdit}
      />
      <FindingDecisionDialog decision={decision} />
      <FindingReportSheet report={report} />
    </>
  );
}

function FollowupActs({
  store,
  item,
  details,
  ...context
}: ActsContext & {
  readonly store: ActsStore;
  readonly item: FollowupItem;
  readonly details: AttentionDetails;
}) {
  const { decision, lastTraceId } = useFollowupActs(item, detailOf(details, item.node), context);
  usePublished(
    store,
    stateOf(
      followupActsOf({
        decide: { available: decision.available, request: decision.request },
        lastTraceId,
      }),
    ),
  );
  return <FollowupDecisionDialog name={item.node.content.name} decision={decision} />;
}

function OutsideActs({
  store,
  item,
  details,
  reload,
  retryDetail,
  markActed,
}: ActsContext & {
  readonly store: ActsStore;
  readonly item: OutsideAttentionItem;
  readonly details: AttentionDetails;
}) {
  const { check } = useOutsideActs(item, detailOf(details, item.node), { reload, markActed });
  const read = outsideReadOf(item, details, retryDetail);
  usePublished(
    store,
    stateOf(outsideActsOf(item, check, read), {
      read,
      retry: () => retryDetail(item.node.id),
    }),
  );
  return null;
}

function ToolApprovalActs({
  store,
  item,
  reload,
  markActed,
}: ActsContext & { readonly store: ActsStore; readonly item: ToolApprovalItem }) {
  const tool = useBoardToolActs(item, useBoardReadsContext(), { reload, markActed });
  usePublished(store, stateOf(toolApprovalActsOf(item, tool), { failure: tool.failure }));
  return null;
}

function CredentialRefusedActs({
  store,
  item,
  snapshots,
  reload,
  markActed,
  setDialogOpen,
}: ActsContext & {
  readonly store: ActsStore;
  readonly item: CredentialRefusedItem;
  readonly snapshots: readonly ProjectSnapshot[];
}) {
  const paused = pausedNodeCountOf(item, snapshots);
  const rotate = useBoardRotate(item, { reload, paused, markActed, setDialogOpen });
  const { verify } = useBoardChecks(item, { reload, markActed });
  usePublished(store, stateOf(credentialRefusedActsOf(item, rotate, verify)));
  return <BoardRotateSheet rotate={rotate} />;
}

function EnvironmentFailedActs({
  store,
  item,
  reload,
  markActed,
}: ActsContext & { readonly store: ActsStore; readonly item: EnvironmentFailedItem }) {
  const { onboarding } = useBoardChecks(item, { reload, markActed });
  usePublished(
    store,
    stateOf(environmentFailedActsOf(item, onboarding), { failure: onboarding.failure }),
  );
  return null;
}

function StaticActs({
  store,
  acts,
}: {
  readonly store: ActsStore;
  readonly acts: readonly BoardAct[];
}) {
  usePublished(store, stateOf(acts));
  return null;
}

function ItemActs({
  item,
  store,
  jump,
  ...context
}: ActsContext & {
  readonly store: ActsStore;
  readonly jump?: (itemId: string) => void;
  readonly item: AttentionItem;
  readonly details: AttentionDetails;
  readonly snapshots: readonly ProjectSnapshot[];
  readonly route: GateRoute | null;
}) {
  switch (item.kind) {
    case "blocked":
    case "paused":
    case "dependency_discarded":
      return <DecisionActs store={store} item={item} {...context} />;
    case "finding_review":
      return <FindingReviewActs store={store} item={item} {...context} />;
    case "followup_proposal":
      return <FollowupActs store={store} item={item} {...context} />;
    case "merge_wait":
    case "delivery_unconfirmed":
      return <OutsideActs store={store} item={item} {...context} />;
    case "tool_approval":
      return <ToolApprovalActs store={store} item={item} {...context} />;
    case "credential_refused":
      return <CredentialRefusedActs store={store} item={item} {...context} />;
    case "environment_failed":
      return <EnvironmentFailedActs store={store} item={item} {...context} />;
    case "project_paused":
      return (
        <StaticActs
          store={store}
          acts={projectPausedActsOf(item, context.reload, context.markActed)}
        />
      );
    case "inbox_item":
      return (
        <InboxActs
          store={store}
          item={item}
          snapshots={context.snapshots}
          reload={context.reload}
          markActed={context.markActed}
          closeInboxItem={context.closeInboxItem}
          jump={jump}
        />
      );
    default:
      return <StaticActs store={store} acts={fixTargetActsOf(item)} />;
  }
}

export function BoardActsProvider({
  item,
  gate = null,
  jump,
  children,
  ...context
}: BoardActsProviderProps) {
  const [store] = useState(createActsStore);
  const route = gate === null || jump === undefined ? null : { gate, jump };
  const subject = item?.subject ?? "";
  const kind = item?.kind ?? null;
  const frame = useMemo(() => ({ subject, kind }), [subject, kind]);
  return (
    <BoardActsContext.Provider value={store}>
      <BoardFrameContext.Provider value={frame}>
        {children}
        {item !== null && (
          <ItemActs
            key={item.id}
            store={store}
            item={item}
            route={route}
            jump={jump}
            {...context}
          />
        )}
      </BoardFrameContext.Provider>
    </BoardActsContext.Provider>
  );
}
