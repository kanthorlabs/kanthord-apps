import { useState } from "react";

import { type EntryRebuildFailure, entryRebuildFailure } from "@/api/entry-rebuild-failure";
import { rebuildSessionEntry } from "@/api/resources/tracking";
import type { TraceSessionEntry } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";

export interface FullEntry {
  readonly entry: TraceSessionEntry | null;
  readonly loading: boolean;
  readonly failure: EntryRebuildFailure | null;
  readonly load: () => void;
}

interface State {
  readonly entry: TraceSessionEntry | null;
  readonly loading: boolean;
  readonly failure: EntryRebuildFailure | null;
}

const IDLE: State = { entry: null, loading: false, failure: null };

export function useFullEntry(cut: TraceSessionEntry): FullEntry {
  const [state, setState] = useState<State>(IDLE);

  const load = () => {
    if (state.loading) return;
    setState({ entry: null, loading: true, failure: null });
    rebuildSessionEntry(cut.trace_id, cut.session_id, cut.entry_id).then(
      (entry) => setState({ entry, loading: false, failure: null }),
      (cause: unknown) =>
        setState({ entry: null, loading: false, failure: entryRebuildFailure(asApiError(cause)) }),
    );
  };

  return { ...state, load };
}
