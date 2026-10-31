import { useMemo, useState } from "react";

import { SHEET_KEYS, type SheetKey } from "@/lib/trace-filter-draft";
import { withParam, withRange } from "@/lib/trace-query";

import type { TraceSetter } from "./use-trace-list";

export interface FilterDraft {
  readonly params: URLSearchParams;
  readonly durationSeconds: string;
  readonly setDurationSeconds: (text: string) => void;
  readonly setters: Readonly<Record<SheetKey, TraceSetter>>;
}

export function useFilterDraft(applied: URLSearchParams, appliedSeconds: string): FilterDraft {
  const [params, setParams] = useState(() => new URLSearchParams(applied));
  const [durationSeconds, setDurationSeconds] = useState(appliedSeconds);
  const setters = useMemo(
    () =>
      Object.fromEntries(
        SHEET_KEYS.map((key) => [
          key,
          (value: string | null) =>
            setParams((current) =>
              key === "range" ? withRange(current, value) : withParam(current, key, value),
            ),
        ]),
      ) as Record<SheetKey, TraceSetter>,
    [],
  );
  return { params, durationSeconds, setDurationSeconds, setters };
}
