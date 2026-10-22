import { useSearchParams } from "react-router-dom";

import { withParam } from "@/lib/trace-query";

const DEFAULT_TAB = "timeline";
const TABS: readonly string[] = [DEFAULT_TAB];

export interface TraceSelection {
  readonly tab: string;
  readonly span: string | null;
  readonly entry: string | null;
  readonly selectTab: (tab: string) => void;
  readonly selectSpan: (spanId: string | null) => void;
  readonly selectEntry: (entryId: string | null) => void;
}

export function useTraceSelection(): TraceSelection {
  const [params, setParams] = useSearchParams();
  const requested = params.get("tab");
  const tab = requested !== null && TABS.includes(requested) ? requested : DEFAULT_TAB;

  const write = (changes: Readonly<Record<string, string | null>>) =>
    setParams(
      (current) =>
        Object.entries(changes).reduce(
          (next, [key, value]) => withParam(next, key, value),
          current,
        ),
      { replace: true },
    );

  return {
    tab,
    span: params.get("span"),
    entry: params.get("entry"),
    selectTab: (next) => write({ tab: next }),
    selectSpan: (spanId) => write({ tab, span: spanId }),
    selectEntry: (entryId) => write({ entry: entryId }),
  };
}
