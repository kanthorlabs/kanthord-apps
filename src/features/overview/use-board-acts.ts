import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from "react";

import type { EffectiveCause, MissionProposal } from "@/api/types";
import { type AttentionDetails, type DecisionAttentionItem, detailOf } from "@/lib/attention";
import {
  type BoardAct,
  decisionActsOf,
  type GateRoute,
  needsOf,
  type ReadNote,
} from "@/lib/board-acts";
import type { ActedAct } from "@/lib/board-done";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";

import type { ActFailure } from "./use-board-tool-acts";
import { type DecisionActs, useDecisionActs } from "./use-decision-acts";

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

export interface ActsContext {
  readonly reload: () => void;
  readonly retryDetail: (nodeId: string) => void;
  readonly markActed: (itemId: string, act?: ActedAct) => void;
  readonly setDialogOpen: (itemId: string, nodeId: string, open: boolean, act?: ActedAct) => void;
  readonly registerDialogCloser: (close: (() => void) | null) => void;
}

interface ActsFrame {
  readonly widthClass: BoardWidth;
  readonly subject: string;
}

export interface ActsStore {
  readonly get: () => BoardActsState;
  readonly set: (state: BoardActsState) => void;
  readonly subscribe: (listener: () => void) => () => void;
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

export function createActsStore(): ActsStore {
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

export const BoardActsContext = createContext<ActsStore>(createActsStore());

export const BoardFrameContext = createContext<ActsFrame>({
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

export function usePublished(store: ActsStore, state: BoardActsState) {
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

export function stateOf(
  acts: readonly BoardAct[],
  rest: Partial<BoardActsState> = {},
): BoardActsState {
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

export function useDecisionBoardActs(
  store: ActsStore,
  item: DecisionAttentionItem,
  details: AttentionDetails,
  route: GateRoute | null,
  { reload, retryDetail, markActed, setDialogOpen, registerDialogCloser }: ActsContext,
): DecisionActs {
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
  return acts;
}
