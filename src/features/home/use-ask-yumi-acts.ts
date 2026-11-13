import { useMemo } from "react";

import type { AttentionItem } from "@/lib/attention";
import { type BoardAct, withAskYumi } from "@/lib/board-acts";

export function useAskYumiActs(
  acts: readonly BoardAct[],
  kind: AttentionItem["kind"] | null,
  askYumi: (() => void) | null,
): readonly BoardAct[] {
  return useMemo(
    () => (kind === null ? acts : withAskYumi(acts, kind, askYumi)),
    [acts, kind, askYumi],
  );
}
