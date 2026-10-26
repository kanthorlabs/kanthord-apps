import type { EntryView } from "./session-entries";
import { costText, PRICE_LABEL, tokenText } from "./trace-format";

type AssistantView = Extract<EntryView, { kind: "assistant" }>;
type SystemView = Extract<EntryView, { kind: "system" }>;

const USAGE_SEPARATOR = " · ";
const PI_SYSTEM_LABEL = "System prompt update";
const FALLBACK_SYSTEM_LABEL = "System prompt";

export function usageLine(view: AssistantView): string | null {
  const parts = [
    view.inputTokens === null ? null : `${tokenText(view.inputTokens)} in`,
    view.outputTokens === null ? null : `${tokenText(view.outputTokens)} out`,
    view.costUsd === null ? null : `${PRICE_LABEL} ${costText(view.costUsd)}`,
  ].filter((part) => part !== null);
  return parts.length === 0 ? null : parts.join(USAGE_SEPARATOR);
}

export function systemLabel(view: SystemView): string {
  if (view.source === "pi") return PI_SYSTEM_LABEL;
  return view.sections[0]?.name ?? FALLBACK_SYSTEM_LABEL;
}

export function systemSize(view: SystemView): string {
  const size =
    view.source === "pi"
      ? view.text.length
      : view.sections.reduce((total, section) => total + section.text.length, 0);
  return `${size} ${size === 1 ? "character" : "characters"}`;
}

export function noteLine(
  view: Extract<
    EntryView,
    { kind: "compaction" | "model_change" | "thinking_level_change" | "other" }
  >,
): string {
  switch (view.kind) {
    case "compaction":
      return "Context compacted";
    case "model_change":
      return view.model === null ? "Model changed" : `Model changed to ${view.model}`;
    case "thinking_level_change":
      return view.level === null
        ? "Thinking level changed"
        : `Thinking level changed to ${view.level}`;
    case "other":
      return view.type;
  }
}
