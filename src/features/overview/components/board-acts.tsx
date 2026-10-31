import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import type { EffectiveCause, MissionProposal } from "@/api/types";
import { NodeDiscardDialog } from "@/components/node-discard-dialog";
import { NodeOverrideDialog } from "@/components/node-override-dialog";
import { NodeResumeDialog } from "@/components/node-resume-dialog";
import { NodeUnblockDialog } from "@/components/node-unblock-dialog";
import { ProposalDecisionDialog } from "@/components/proposal-decision-dialog";
import type { NodeCheckState } from "@/hooks/use-node-check";
import { approvalChatPathOf } from "@/lib/approval-attention";
import {
  type AttentionDetails,
  type AttentionItem,
  type DecisionAttentionItem,
  detailOf,
  type OutsideAttentionItem,
  type ProjectSnapshot,
} from "@/lib/attention";
import type { ActedAct } from "@/lib/board-done";
import { type BoardGate, pausedNodeCountOf } from "@/lib/board-items";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";
import { readFailureText } from "@/lib/external-requests";
import type { ToolApprovalItem } from "@/lib/approval-attention";
import {
  type CredentialRefusedItem,
  type EnvironmentFailedItem,
  fixTargetOf,
  type ProjectPausedItem,
} from "@/lib/fix-attention";

import { useBoardChecks } from "../use-board-checks";
import { useBoardReadsContext } from "../use-board-reads";
import { useBoardRotate } from "../use-board-rotate";
import { type ActFailure, useBoardToolActs } from "../use-board-tool-acts";
import { type DecisionActs, useDecisionActs } from "../use-decision-acts";
import { useOutsideActs } from "../use-outside-acts";
import { BoardRotateSheet } from "./board-rotate-sheet";
import { DependencyRemoveDialog } from "./dependency-remove-dialog";

type ActVariant = "outline" | "destructive";

interface ButtonAct {
  readonly type: "button";
  readonly id: string;
  readonly label: string;
  readonly ariaLabel: string | null;
  readonly variant: ActVariant;
  readonly disabled: boolean;
  readonly press: () => void;
}

interface GatedAct {
  readonly type: "gated";
  readonly id: string;
  readonly label: string;
  readonly ariaLabel: string | null;
  readonly need: string;
  readonly reason?: string;
}

interface LinkAct {
  readonly type: "link";
  readonly id: string;
  readonly label: string;
  readonly to: string;
}

interface ExternalLinkAct {
  readonly type: "external";
  readonly id: string;
  readonly label: string;
  readonly href: string;
}

interface ResumeProjectAct {
  readonly type: "resume_project";
  readonly id: string;
  readonly item: ProjectPausedItem;
  readonly reload: () => void;
  readonly markActed: (itemId: string) => void;
}

interface BadgeAct {
  readonly type: "badge";
  readonly id: string;
  readonly label: string;
}

export type BoardAct =
  ButtonAct | GatedAct | LinkAct | ExternalLinkAct | ResumeProjectAct | BadgeAct;

interface ReadNote {
  readonly text: string;
  readonly failed: boolean;
  readonly retry: () => void;
}

interface LastTrace {
  readonly id: string;
  readonly cause: EffectiveCause | null;
}

export interface BoardActsState {
  readonly acts: readonly BoardAct[];
  readonly needs: readonly string[];
  readonly read: ReadNote | null;
  readonly proposals: readonly MissionProposal[];
  readonly unresolved: string | null;
  readonly lastTrace: LastTrace | null;
  readonly failure: ActFailure | null;
  readonly retry: () => void;
}

interface Slot {
  readonly id: string;
  readonly gate: string;
  readonly label: string;
  readonly ariaLabel: string | null;
  readonly variant: ActVariant;
  readonly available: boolean;
  readonly disabled: boolean;
  readonly press: () => void;
}

interface Gate {
  readonly gates: readonly string[];
  readonly read: string;
}

interface ActsContext {
  readonly reload: () => void;
  readonly retryDetail: (nodeId: string) => void;
  readonly markActed: (itemId: string, act?: ActedAct) => void;
  readonly setDialogOpen: (itemId: string, nodeId: string, open: boolean, act?: ActedAct) => void;
  readonly registerDialogCloser: (close: (() => void) | null) => void;
}

interface GateRoute {
  readonly gate: BoardGate;
  readonly jump: (itemId: string) => void;
}

interface BoardActsProviderProps extends ActsContext {
  readonly widthClass: BoardWidth;
  readonly snapshots: readonly ProjectSnapshot[];
  readonly gate?: BoardGate | null;
  readonly jump?: (itemId: string) => void;
  readonly item: AttentionItem | null;
  readonly details: AttentionDetails;
  readonly children: ReactNode;
}

const NO_PROPOSALS: readonly MissionProposal[] = [];

const EMPTY: BoardActsState = {
  acts: [],
  needs: [],
  read: null,
  proposals: NO_PROPOSALS,
  unresolved: null,
  lastTrace: null,
  failure: null,
  retry: () => undefined,
};

interface ActsStore {
  readonly get: () => BoardActsState;
  readonly set: (state: BoardActsState) => void;
  readonly subscribe: (listener: () => void) => () => void;
}

function createActsStore(): ActsStore {
  let current = EMPTY;
  const listeners = new Set<() => void>();
  return {
    get: () => current,
    set: (state) => {
      current = state;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

const BoardActsContext = createContext<ActsStore>(createActsStore());

interface ActsFrame {
  readonly widthClass: BoardWidth;
  readonly subject: string;
}

const BoardFrameContext = createContext<ActsFrame>({
  widthClass: BOARD_WIDTH.Expanded,
  subject: "",
});

export function useBoardActs(): BoardActsState {
  const store = useContext(BoardActsContext);
  return useSyncExternalStore(store.subscribe, store.get);
}

export function useBoardActsFrame(): ActsFrame {
  return useContext(BoardFrameContext);
}

function usePublished(store: ActsStore, state: BoardActsState) {
  useLayoutEffect(() => {
    store.set(state);
  });
  useLayoutEffect(
    () => () => {
      store.set(EMPTY);
    },
    [store],
  );
}

function slotOf(
  id: string,
  label: string,
  variant: ActVariant,
  available: boolean,
  press: () => void,
  extra: Partial<Pick<Slot, "gate" | "ariaLabel" | "disabled">> = {},
): Slot {
  return {
    id,
    gate: extra.gate ?? id,
    label,
    ariaLabel: extra.ariaLabel ?? null,
    variant,
    available,
    disabled: extra.disabled ?? false,
    press,
  };
}

function actOf(slot: Slot, gate: Gate | null): BoardAct | null {
  if (gate?.gates.includes(slot.gate) === true) {
    return {
      type: "gated",
      id: slot.id,
      label: slot.label,
      ariaLabel: slot.ariaLabel,
      need: `${slot.label} needs: ${gate.read}.`,
    };
  }
  if (!slot.available) return null;
  return {
    type: "button",
    id: slot.id,
    label: slot.label,
    ariaLabel: slot.ariaLabel,
    variant: slot.variant,
    disabled: slot.disabled,
    press: slot.press,
  };
}

function checkActsOf(check: NodeCheckState, gate: Gate | null): readonly (BoardAct | null)[] {
  return [
    actOf(
      slotOf("check", "Check now", "outline", check.available, check.check, {
        disabled: check.checking,
      }),
      gate,
    ),
    check.label === null ? null : { type: "badge", id: "check_badge", label: check.label },
  ];
}

function present(acts: readonly (BoardAct | null)[]): readonly BoardAct[] {
  return acts.flatMap((act) => (act === null ? [] : [act]));
}

function needsOf(acts: readonly BoardAct[]): readonly string[] {
  return [...new Set(acts.flatMap((act) => (act.type === "gated" ? [act.need] : [])))];
}

function decisionGateOf(item: DecisionAttentionItem, acts: DecisionActs): Gate | null {
  if (acts.ready) return null;
  if (item.kind === "blocked") {
    return { gates: ["decide", "unblock", "discard"], read: "the proposals read" };
  }
  if (item.kind === "paused") {
    return {
      gates: ["resume", "override", "check", "discard"],
      read: "the executions and external actions read",
    };
  }
  return { gates: ["remove", "check", "discard"], read: "the external actions read" };
}

function credentialOf(gate: BoardGate): string {
  return gate.itemId.slice(gate.itemId.indexOf(":") + 1);
}

function gatedResumeOf({ gate }: GateRoute): GatedAct {
  return {
    type: "gated",
    id: "resume",
    label: "Resume",
    ariaLabel: null,
    need: `Resume needs: ${gate.need}.`,
    reason: `${gate.need}.`,
  };
}

function goToOf({ gate, jump }: GateRoute): BoardAct | null {
  return actOf(
    slotOf("goto", `Go to ${credentialOf(gate)}`, "outline", true, () => jump(gate.itemId)),
    null,
  );
}

function decisionActsOf(
  item: DecisionAttentionItem,
  acts: DecisionActs,
  route: GateRoute | null,
): readonly BoardAct[] {
  const gate = decisionGateOf(item, acts);
  const decide = actOf(
    slotOf("decide", "Decide", "outline", acts.decide.available, acts.decide.request),
    gate,
  );
  const unblock = actOf(
    slotOf("unblock", "Unblock", "outline", acts.unblock.available, acts.unblock.request),
    gate,
  );
  const resume = actOf(
    slotOf("resume", "Resume", "outline", acts.resume.available, acts.resume.request),
    gate,
  );
  const override = actOf(
    slotOf("override", "Override", "outline", acts.override.available, acts.override.request),
    gate,
  );
  const discard = actOf(
    slotOf("discard", "Discard", "destructive", acts.discard.available, acts.discard.request),
    gate,
  );
  const trace: LinkAct | null =
    acts.lastTraceId === null
      ? null
      : {
          type: "link",
          id: "last_trace",
          label: "Last trace",
          to: `/traces/${encodeURIComponent(acts.lastTraceId)}`,
        };
  const check = checkActsOf(acts.check, gate);
  if (item.kind === "paused") {
    return route === null
      ? present([resume, override, ...check, trace, discard])
      : present([gatedResumeOf(route), goToOf(route), override, ...check, trace, discard]);
  }
  if (item.kind === "blocked") {
    return present([decide, unblock, override, ...check, trace, discard]);
  }
  const removals = item.discarded.map((dependency) =>
    actOf(
      slotOf(
        `remove:${dependency.id}`,
        "Remove dependency",
        "outline",
        acts.remove.available,
        () => acts.remove.request(dependency),
        { gate: "remove", ariaLabel: `Remove dependency on ${dependency.name}` },
      ),
      gate,
    ),
  );
  return present([...removals, ...check, trace, discard]);
}

function stateOf(acts: readonly BoardAct[], rest: Partial<BoardActsState> = {}): BoardActsState {
  return { ...EMPTY, acts, needs: needsOf(acts), ...rest };
}

function openActOf(acts: DecisionActs): ActedAct | null {
  if (acts.unblock.open) return { id: "unblock" };
  if (acts.decide.open) return { id: "decide" };
  if (acts.override.open) return { id: "override" };
  if (acts.resume.open) return { id: "resume" };
  if (acts.remove.target !== null) {
    return { id: "remove_dependency", dependency: acts.remove.target.name };
  }
  if (acts.discard.open) return { id: "discard" };
  return null;
}

function cancelDialogsOf(acts: DecisionActs) {
  if (acts.unblock.open) acts.unblock.cancel();
  if (acts.decide.open) acts.decide.cancel();
  if (acts.override.open) acts.override.cancel();
  if (acts.resume.open) acts.resume.cancel();
  if (acts.remove.target !== null) acts.remove.cancel();
  if (acts.discard.open) acts.discard.cancel();
}

function DecisionActs({
  store,
  item,
  details,
  reload,
  retryDetail,
  markActed,
  setDialogOpen,
  registerDialogCloser,
  route,
}: ActsContext & {
  readonly store: ActsStore;
  readonly item: DecisionAttentionItem;
  readonly details: AttentionDetails;
  readonly route: GateRoute | null;
}) {
  const { node } = item;
  const lastOpen = useRef<ActedAct | null>(null);
  const trackedDialogOpen = useCallback(
    (itemId: string, nodeId: string, open: boolean) => {
      if (open) {
        setDialogOpen(itemId, nodeId, true);
        return;
      }
      const act = lastOpen.current ?? undefined;
      lastOpen.current = null;
      setDialogOpen(itemId, nodeId, false, act);
    },
    [setDialogOpen],
  );
  const acts = useDecisionActs(item, detailOf(details, node), {
    reload,
    markActed,
    setDialogOpen: trackedDialogOpen,
  });
  const openAct = openActOf(acts);
  useEffect(() => {
    if (openAct !== null) lastOpen.current = openAct;
  });
  useEffect(() => {
    registerDialogCloser(() => cancelDialogsOf(acts));
    return () => registerDialogCloser(null);
  });
  usePublished(
    store,
    stateOf(decisionActsOf(item, acts, route), {
      read:
        acts.waiting === null
          ? null
          : { text: acts.waiting, failed: acts.failed, retry: () => retryDetail(node.id) },
      retry: () => retryDetail(node.id),
      proposals: acts.proposals,
      unresolved: acts.unresolved,
      lastTrace:
        acts.lastTraceId === null ? null : { id: acts.lastTraceId, cause: acts.lastTraceCause },
    }),
  );

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

function outsideReadOf(
  item: OutsideAttentionItem,
  details: AttentionDetails,
  retryDetail: (nodeId: string) => void,
): ReadNote | null {
  const detail = detailOf(details, item.node);
  const { attempt } = item.node;
  if (detail?.kind !== "external") {
    return {
      text: `Reading the external actions of attempt ${attempt}. The acts show after the read.`,
      failed: false,
      retry: () => retryDetail(item.node.id),
    };
  }
  if (detail.actions.status === "failed") {
    return {
      text: readFailureText(attempt, detail.actions.message, false, "Check now waits for them."),
      failed: true,
      retry: () => retryDetail(item.node.id),
    };
  }
  return null;
}

const GITHUB_IDENTITY = /^repository:github:(.+)$/;

function pullRequestActOf(item: OutsideAttentionItem): ExternalLinkAct | null {
  for (const asset of item.request.evidence?.assets ?? []) {
    if (asset.kind !== "platform" || asset.address.kind !== "pull_request") continue;
    const github = GITHUB_IDENTITY.exec(asset.address.resource_identity);
    if (github?.[1] === undefined) return null;
    return {
      type: "external",
      id: "open_pull_request",
      label: "Open pull request",
      href: `https://github.com/${github[1]}/pull/${asset.address.number}`,
    };
  }
  return null;
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
  const gate: Gate | null =
    read === null ? null : { gates: ["check"], read: "the external actions read" };
  usePublished(
    store,
    stateOf(present([pullRequestActOf(item), ...checkActsOf(check, gate)]), {
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
  const approve =
    tool.need === null
      ? actOf(
          slotOf("approve", "Approve", "outline", true, tool.approve, { disabled: tool.sending }),
          null,
        )
      : ({
          type: "gated",
          id: "approve",
          label: "Approve",
          ariaLabel: null,
          need: tool.need,
        } satisfies GatedAct);
  const reject = actOf(
    slotOf("reject", "Reject", "outline", true, tool.reject, { disabled: tool.sending }),
    null,
  );
  const chat: LinkAct = {
    type: "link",
    id: "open_chat",
    label: "Open chat",
    to: approvalChatPathOf(item),
  };
  usePublished(store, stateOf(present([approve, reject, chat]), { failure: tool.failure }));
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
  const gate: Gate | null =
    rotate.missing === null ? null : { gates: ["rotate"], read: rotate.missing };
  const target = fixTargetOf(item);
  const open: LinkAct = { type: "link", id: "open", label: target.label, to: target.path };
  usePublished(
    store,
    stateOf(
      present([
        actOf(slotOf("rotate", "Rotate", "outline", true, rotate.start), gate),
        actOf(
          slotOf("verify", "Verify credential", "outline", true, verify.verify, {
            disabled: verify.checking,
          }),
          null,
        ),
        verify.label === null ? null : { type: "badge", id: "verify_badge", label: verify.label },
        open,
      ]),
    ),
  );
  return <BoardRotateSheet rotate={rotate} />;
}

function EnvironmentFailedActs({
  store,
  item,
  reload,
  markActed,
}: ActsContext & { readonly store: ActsStore; readonly item: EnvironmentFailedItem }) {
  const { onboarding } = useBoardChecks(item, { reload, markActed });
  const target = fixTargetOf(item);
  const open: LinkAct = { type: "link", id: "open", label: target.label, to: target.path };
  usePublished(
    store,
    stateOf(
      present([
        open,
        actOf(
          slotOf("onboarding", "Run onboarding again", "outline", true, onboarding.run, {
            disabled: onboarding.running,
          }),
          null,
        ),
      ]),
      { failure: onboarding.failure },
    ),
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
  ...context
}: ActsContext & {
  readonly store: ActsStore;
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
          acts={[
            {
              type: "resume_project",
              id: "resume_project",
              item,
              reload: context.reload,
              markActed: (itemId) => context.markActed(itemId, { id: "resume_project" }),
            },
          ]}
        />
      );
    default: {
      const target = fixTargetOf(item);
      return (
        <StaticActs
          store={store}
          acts={[{ type: "link", id: "fix_target", label: target.label, to: target.path }]}
        />
      );
    }
  }
}

export function BoardActsProvider({
  item,
  widthClass,
  gate = null,
  jump,
  children,
  ...context
}: BoardActsProviderProps) {
  const [store] = useState(createActsStore);
  const route = gate === null || jump === undefined ? null : { gate, jump };
  const subject = item?.subject ?? "";
  const frame = useMemo(() => ({ widthClass, subject }), [widthClass, subject]);
  return (
    <BoardActsContext.Provider value={store}>
      <BoardFrameContext.Provider value={frame}>
        {children}
        {item !== null && (
          <ItemActs key={item.id} store={store} item={item} route={route} {...context} />
        )}
      </BoardFrameContext.Provider>
    </BoardActsContext.Provider>
  );
}
