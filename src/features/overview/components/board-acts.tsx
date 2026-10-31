import {
  createContext,
  type ReactNode,
  useContext,
  useLayoutEffect,
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
} from "@/lib/attention";
import { readFailureText } from "@/lib/external-requests";
import { fixTargetOf, type ProjectPausedItem } from "@/lib/fix-attention";

import { type DecisionActs, useDecisionActs } from "../use-decision-acts";
import { useOutsideActs } from "../use-outside-acts";
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
}

interface LinkAct {
  readonly type: "link";
  readonly id: string;
  readonly label: string;
  readonly to: string;
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

export type BoardAct = ButtonAct | GatedAct | LinkAct | ResumeProjectAct | BadgeAct;

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
  readonly markActed: (itemId: string) => void;
  readonly setDialogOpen: (itemId: string, nodeId: string, open: boolean) => void;
}

interface BoardActsProviderProps extends ActsContext {
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

export function useBoardActs(): BoardActsState {
  const store = useContext(BoardActsContext);
  return useSyncExternalStore(store.subscribe, store.get);
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

function decisionActsOf(item: DecisionAttentionItem, acts: DecisionActs): readonly BoardAct[] {
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
  if (item.kind === "paused") return present([resume, override, ...check, trace, discard]);
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

function DecisionActs({
  store,
  item,
  details,
  reload,
  retryDetail,
  markActed,
  setDialogOpen,
}: ActsContext & {
  readonly store: ActsStore;
  readonly item: DecisionAttentionItem;
  readonly details: AttentionDetails;
}) {
  const { node } = item;
  const acts = useDecisionActs(item, detailOf(details, node), { reload, markActed, setDialogOpen });
  usePublished(
    store,
    stateOf(decisionActsOf(item, acts), {
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
    stateOf(present(checkActsOf(check, gate)), {
      read,
      retry: () => retryDetail(item.node.id),
    }),
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
      return (
        <StaticActs
          store={store}
          acts={[
            { type: "link", id: "open_chat", label: "Open chat", to: approvalChatPathOf(item) },
          ]}
        />
      );
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
              markActed: context.markActed,
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

export function BoardActsProvider({ item, children, ...context }: BoardActsProviderProps) {
  const [store] = useState(createActsStore);
  return (
    <BoardActsContext.Provider value={store}>
      {children}
      {item !== null && <ItemActs key={item.id} store={store} item={item} {...context} />}
    </BoardActsContext.Provider>
  );
}
