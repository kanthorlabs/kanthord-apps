import { useEffect, useState } from "react";

import type { EnvironmentState } from "@/api/types";
import { moreCountOf, shownEnvironmentOf } from "@/lib/environment-bar";

const READY_DISPLAY_MS = 10_000;

export interface EnvironmentBar {
  readonly state: EnvironmentState;
  readonly more: number;
  readonly ready: boolean;
}

interface Recorded {
  readonly bindingId: string | null;
  readonly expired: boolean;
}

const NOTHING_RECORDED: Recorded = { bindingId: null, expired: false };

export function useEnvironmentBar(
  states: readonly EnvironmentState[] | null,
): EnvironmentBar | null {
  const shown = states === null ? null : shownEnvironmentOf(states);
  const shownId = shown === null ? null : shown.binding_id;
  const loaded = states !== null;
  const [recorded, setRecorded] = useState<Recorded>(NOTHING_RECORDED);

  if (!loaded && recorded.bindingId !== null) {
    setRecorded(NOTHING_RECORDED);
  } else if (shownId !== null && (recorded.bindingId !== shownId || recorded.expired)) {
    setRecorded({ bindingId: shownId, expired: false });
  }

  useEffect(() => {
    if (!loaded || shownId !== null || recorded.bindingId === null || recorded.expired) return;
    const timer = setTimeout(
      () => setRecorded({ bindingId: recorded.bindingId, expired: true }),
      READY_DISPLAY_MS,
    );
    return () => clearTimeout(timer);
  }, [loaded, shownId, recorded]);

  if (states === null) return null;
  if (shown !== null) return { state: shown, more: moreCountOf(states, shown), ready: false };
  if (recorded.bindingId === null || recorded.expired) return null;
  const settled = states.find((state) => state.binding_id === recorded.bindingId);
  return settled === undefined ? null : { state: settled, more: 0, ready: true };
}
