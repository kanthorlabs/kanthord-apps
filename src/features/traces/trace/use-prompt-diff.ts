import type { ApiError } from "@/api/errors";
import { resolveAgentPrompt } from "@/api/resources/workers";
import type { PromptPart } from "@/api/types";
import { useResource } from "@/hooks/use-resource";
import { promptPartKey } from "@/lib/agent-prompt-parts";
import { type DiffLine, lineDiff } from "@/lib/line-diff";
import { promptPartStateLabel } from "@/lib/prompt-part";

export interface PromptDiff {
  readonly loading: boolean;
  readonly error: ApiError | null;
  readonly lines: readonly DiffLine[] | null;
  readonly note: string | null;
  readonly retry: () => void;
}

const ABSENT_NOTE = "The earlier execution held no such part.";
const CURRENT_NOTE = "The text of this execution does not resolve, so no diff is possible.";

function diffOf(
  previous: PromptPart | undefined,
  current: PromptPart,
): Pick<PromptDiff, "lines" | "note"> {
  if (current.text === null) return { lines: null, note: CURRENT_NOTE };
  if (previous === undefined) return { lines: lineDiff("", current.text), note: ABSENT_NOTE };
  if (previous.text === null)
    return {
      lines: null,
      note: `The earlier text does not resolve: ${promptPartStateLabel(previous.state)}.`,
    };
  return { lines: lineDiff(previous.text, current.text), note: null };
}

export function usePromptDiff(
  executionId: string,
  agentName: string,
  current: PromptPart,
): PromptDiff {
  const resource = useResource(
    () => resolveAgentPrompt(executionId, agentName),
    [executionId, agentName],
  );
  const key = promptPartKey(current);
  const previous = resource.data?.parts.find((part) => promptPartKey(part) === key);
  const diff = resource.data === null ? { lines: null, note: null } : diffOf(previous, current);
  return {
    loading: resource.loading,
    error: resource.error,
    lines: diff.lines,
    note: diff.note,
    retry: resource.reload,
  };
}
