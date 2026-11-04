import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  listAllFootprintCandidates,
  listAllFootprintItems,
  listFootprintCandidatePage,
  listFootprintItemPage,
} from "@/api/resources/footprint";
import type {
  CleanableKind,
  CleanupRule,
  CleanupRuleName,
  FootprintCandidate,
  FootprintStat,
  WorkerPlacement,
} from "@/api/types";
import { type CursorPages, useCursorPages } from "@/hooks/use-cursor-pages";
import { asApiError } from "@/hooks/use-resource";
import { counted } from "@/lib/counted";
import { byteText } from "@/lib/format";
import {
  EVERY_ITEM_LABEL,
  FOOTPRINT_CLEANUP_KEYS_MAX,
  FOOTPRINT_DEFAULT_AGE_DAYS,
  FOOTPRINT_OLDER_THAN_DAYS_MAX,
  RULE_LABELS,
} from "@/lib/footprint";
import { type CleanupPlan, isSelectable, saferPathOf, selectionPlan } from "./cleanup-plan";

export const CANDIDATE_PAGE_LIMIT = 50;
export const EVERY_ITEM = "every";
const AGE_MIN = 1;
const AGE_MAX = FOOTPRINT_OLDER_THAN_DAYS_MAX;

export type CandidateMode = CleanupRuleName | typeof EVERY_ITEM;

export interface CandidateTotals {
  readonly count: number;
  readonly bytes: number | null;
  readonly estimated: boolean;
}

export interface CandidateSelection {
  readonly mode: CandidateMode;
  readonly modeOptions: readonly { readonly value: string; readonly label: string }[];
  readonly age: string;
  readonly ageError: string | undefined;
  readonly pages: CursorPages<FootprintCandidate>;
  readonly totals: CandidateTotals | null;
  readonly totalText: string | null;
  readonly selected: ReadonlySet<string>;
  readonly selectingAll: boolean;
  readonly disabledReason: string | null;
  readonly setMode: (mode: string | null) => void;
  readonly setAge: (age: string) => void;
  readonly toggle: (candidate: FootprintCandidate) => void;
  readonly selectAll: () => void;
  readonly clear: () => void;
  readonly plan: () => CleanupPlan;
}

interface Picked {
  readonly scope: string;
  readonly bytes: ReadonlyMap<string, number | null>;
}

function ageOf(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  const days = Number(text);
  return days >= AGE_MIN && days <= AGE_MAX ? days : null;
}

function ruleOf(mode: CandidateMode, days: number | null): CleanupRule | null {
  if (mode === EVERY_ITEM) return null;
  if (mode === "older_than") return days === null ? null : { name: mode, older_than_days: days };
  return { name: mode };
}

function modesOf(stat: FootprintStat): readonly CandidateMode[] {
  return [...stat.rules, EVERY_ITEM];
}

function initialMode(stat: FootprintStat): CandidateMode {
  return stat.candidates?.rule.name ?? stat.rules[0] ?? EVERY_ITEM;
}

function totalTextOf(totals: CandidateTotals | null): string | null {
  if (totals === null) return null;
  const count = counted(totals.count, "candidate", "candidates");
  if (totals.bytes === null) return count;
  return `${count} · ${totals.estimated ? "about " : ""}${byteText(totals.bytes)}`;
}

function averageBytes(stat: FootprintStat): number | null {
  return stat.bytes === null || stat.count === null || stat.count === 0
    ? null
    : stat.bytes / stat.count;
}

export function useCandidateSelection(
  kind: CleanableKind,
  stat: FootprintStat,
  placement: WorkerPlacement | null,
): CandidateSelection {
  const [mode, setModeState] = useState<CandidateMode>(() => initialMode(stat));
  const [age, setAge] = useState(String(FOOTPRINT_DEFAULT_AGE_DAYS));
  const [totals, setTotals] = useState<CandidateTotals | null>(null);
  const [selectingAll, setSelectingAll] = useState(false);
  const days = ageOf(age);
  const rule = ruleOf(mode, days);
  const instanceName = stat.instance_name;
  const waiting = mode === "older_than" && days === null;
  const scope = JSON.stringify([kind, instanceName, mode, waiting ? null : days]);
  const [picked, setPicked] = useState<Picked>({ scope, bytes: new Map() });
  const bytes = useMemo(
    () => (picked.scope === scope ? picked.bytes : new Map<string, number | null>()),
    [picked, scope],
  );

  const pages = useCursorPages<FootprintCandidate>(
    (cursor) => {
      if (rule === null && mode !== EVERY_ITEM) {
        return Promise.resolve({ items: [], next_cursor: null });
      }
      if (rule === null) {
        setTotals(null);
        return listFootprintItemPage(kind, instanceName, cursor, CANDIDATE_PAGE_LIMIT);
      }
      return listFootprintCandidatePage(
        kind,
        { instance_name: instanceName, rule },
        cursor,
        CANDIDATE_PAGE_LIMIT,
      ).then((page) => {
        setTotals({
          count: page.total_count,
          bytes: page.total_bytes,
          estimated: page.bytes_estimated,
        });
        return page;
      });
    },
    [scope],
  );

  const setMode = useCallback((next: string | null) => {
    if (next !== null) setModeState(next as CandidateMode);
  }, []);

  const toggle = useCallback(
    (candidate: FootprintCandidate) => {
      if (!isSelectable(candidate)) return;
      setPicked((current) => {
        const next = new Map(current.scope === scope ? current.bytes : []);
        if (next.has(candidate.key)) next.delete(candidate.key);
        else next.set(candidate.key, candidate.bytes);
        return { scope, bytes: next };
      });
    },
    [scope],
  );

  const selectAll = useCallback(() => {
    setSelectingAll(true);
    const read =
      rule === null
        ? listAllFootprintItems(kind, instanceName)
        : listAllFootprintCandidates(kind, { instance_name: instanceName, rule });
    read.then(
      (items) => {
        setSelectingAll(false);
        setPicked({
          scope,
          bytes: new Map(
            items
              .filter(isSelectable)
              .map((item): [string, number | null] => [item.key, item.bytes]),
          ),
        });
      },
      (cause: unknown) => {
        setSelectingAll(false);
        toast.error("The selection failed.", { description: asApiError(cause).message });
      },
    );
  }, [kind, instanceName, rule, scope]);

  const clear = useCallback(() => setPicked({ scope, bytes: new Map() }), [scope]);

  const plan = useCallback((): CleanupPlan => {
    const values = [...bytes.values()];
    const unknown = values.filter((value) => value === null).length;
    const average = averageBytes(stat);
    const known = values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
    const estimated = unknown > 0 && average !== null;
    return selectionPlan({
      kind,
      instanceName,
      placement,
      rule,
      keys: [...bytes.keys()],
      bytes: unknown > 0 && average === null ? null : known + unknown * (average ?? 0),
      estimated: estimated || (totals?.estimated ?? false),
    });
  }, [bytes, stat, kind, instanceName, placement, rule, totals]);

  const disabledReason = stat.stale
    ? "The measurement of this host is stale. Clean up waits for the next report of the host."
    : bytes.size === 0
      ? "Select at least one item."
      : bytes.size > FOOTPRINT_CLEANUP_KEYS_MAX
        ? `Select at most ${FOOTPRINT_CLEANUP_KEYS_MAX} items. ${saferPathOf(rule)}`
        : null;

  return {
    mode,
    modeOptions: modesOf(stat).map((value) => ({
      value,
      label: value === EVERY_ITEM ? EVERY_ITEM_LABEL : RULE_LABELS[value],
    })),
    age,
    ageError: waiting ? `Enter a whole number of days from ${AGE_MIN} to ${AGE_MAX}.` : undefined,
    pages,
    totals: rule === null ? null : totals,
    totalText: totalTextOf(rule === null ? null : totals),
    selected: new Set(bytes.keys()),
    selectingAll,
    disabledReason,
    setMode,
    setAge,
    toggle,
    selectAll,
    clear,
    plan,
  };
}
