import type { WorkbenchSessionListItem } from "@/api/types";
import { sessionTitle } from "./workbench-sessions";

export interface HomeNotice {
  readonly sessionId: string;
  readonly text: string;
}

export function homeNoticesOf(
  sessions: readonly WorkbenchSessionListItem[],
): readonly HomeNotice[] {
  return [...sessions]
    .sort((left, right) => left.modified - right.modified)
    .flatMap((session): readonly HomeNotice[] =>
      session.notice === null
        ? []
        : [{ sessionId: session.id, text: `${sessionTitle(session)}: ${session.notice}` }],
    );
}
