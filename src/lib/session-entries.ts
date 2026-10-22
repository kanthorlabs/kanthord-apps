import type { TraceSessionEntry } from "@/api/types";

export interface EntryToolCall {
  readonly id: string;
  readonly name: string;
  readonly arguments: unknown;
}

export interface EntrySection {
  readonly name: string;
  readonly text: string;
}

export type EntryView =
  | { readonly kind: "user"; readonly text: string }
  | {
      readonly kind: "assistant";
      readonly text: string;
      readonly thinking: readonly string[];
      readonly toolCalls: readonly EntryToolCall[];
      readonly model: string | null;
      readonly inputTokens: number | null;
      readonly outputTokens: number | null;
      readonly costUsd: number | null;
    }
  | {
      readonly kind: "tool_result";
      readonly toolCallId: string;
      readonly toolName: string;
      readonly isError: boolean;
      readonly text: string;
      readonly firstLine: string;
    }
  | {
      readonly kind: "system";
      readonly source: "pinned" | "pi";
      readonly text: string;
      readonly sections: readonly EntrySection[];
    }
  | { readonly kind: "compaction" }
  | { readonly kind: "model_change"; readonly model: string | null }
  | { readonly kind: "thinking_level_change"; readonly level: string | null }
  | { readonly kind: "other"; readonly type: string };

type Json = Readonly<Record<string, unknown>>;

const TYPE_MESSAGE = "message";
const TYPE_CUSTOM = "custom";
const TYPE_COMPACTION = "compaction";
const TYPE_MODEL_CHANGE = "model_change";
const TYPE_THINKING_LEVEL_CHANGE = "thinking_level_change";

const ROLE_USER = "user";
const ROLE_ASSISTANT = "assistant";
const ROLE_TOOL_RESULT = "toolResult";
const ROLE_SYSTEM = "system";

const PART_TEXT = "text";
const PART_THINKING = "thinking";
const PART_TOOL_CALL = "toolCall";

const CUSTOM_PINNED_CONTEXT = "kanthord.pinned_context";
const PINNED_PART_SYSTEM_PROMPT = "system_prompt";
const PINNED_PART_LAYER = "layer";
const SYSTEM_PROMPT_NAME = "System prompt";

const TEXT_SEPARATOR = "\n";
const LINE_BREAK = /\r?\n/;

function isRecord(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringOf(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function numberOf(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function partsOf(content: unknown, type: string): readonly Json[] {
  if (!Array.isArray(content)) return [];
  return content.filter((part: unknown): part is Json => isRecord(part) && part.type === type);
}

function contentText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return null;
  return partsOf(content, PART_TEXT)
    .flatMap((part) => stringOf(part.text) ?? [])
    .join(TEXT_SEPARATOR);
}

function other(entry: TraceSessionEntry): EntryView {
  return { kind: "other", type: entry.entry_type };
}

function assistantView(message: Json): EntryView | null {
  const text = contentText(message.content);
  if (text === null) return null;
  const usage = isRecord(message.usage) ? message.usage : null;
  const input = numberOf(usage?.input);
  const cost = isRecord(usage?.cost) ? numberOf(usage.cost.total) : null;
  return {
    kind: "assistant",
    text,
    thinking: partsOf(message.content, PART_THINKING).flatMap(
      (part) => stringOf(part.thinking) ?? [],
    ),
    toolCalls: partsOf(message.content, PART_TOOL_CALL).flatMap((part) => {
      const id = stringOf(part.id);
      const name = stringOf(part.name);
      return id === null || name === null ? [] : [{ id, name, arguments: part.arguments }];
    }),
    model: stringOf(message.model),
    inputTokens:
      input === null
        ? null
        : input + (numberOf(usage?.cacheRead) ?? 0) + (numberOf(usage?.cacheWrite) ?? 0),
    outputTokens: numberOf(usage?.output),
    costUsd: cost,
  };
}

function toolResultView(message: Json): EntryView | null {
  const text = contentText(message.content);
  if (text === null) return null;
  return {
    kind: "tool_result",
    toolCallId: stringOf(message.toolCallId) ?? "",
    toolName: stringOf(message.toolName) ?? "",
    isError: message.isError === true,
    text,
    firstLine: text.split(LINE_BREAK)[0] ?? "",
  };
}

function sectionsOf(value: unknown): readonly EntrySection[] {
  if (!isRecord(value)) return [];
  return Object.entries(value).flatMap(([name, section]) => {
    if (section === null || section === undefined) return [];
    return [{ name, text: typeof section === "string" ? section : JSON.stringify(section) }];
  });
}

function systemView(message: Json): EntryView {
  return {
    kind: "system",
    source: "pi",
    text: contentText(message.content) ?? "",
    sections: sectionsOf(message.sections),
  };
}

function messageView(message: unknown): EntryView | null {
  if (!isRecord(message)) return null;
  switch (message.role) {
    case ROLE_USER: {
      const text = contentText(message.content);
      return text === null ? null : { kind: "user", text };
    }
    case ROLE_ASSISTANT:
      return assistantView(message);
    case ROLE_TOOL_RESULT:
      return toolResultView(message);
    case ROLE_SYSTEM:
      return systemView(message);
    default:
      return null;
  }
}

function pinnedName(data: Json): string | null {
  if (data.part === PINNED_PART_SYSTEM_PROMPT) return SYSTEM_PROMPT_NAME;
  if (data.part !== PINNED_PART_LAYER) return null;
  const index = data.index;
  return typeof index === "number" || typeof index === "string" ? `Layer ${index}` : "Layer";
}

function pinnedView(data: unknown): EntryView | null {
  if (!isRecord(data)) return null;
  const name = pinnedName(data);
  const text = stringOf(data.text);
  if (name === null || text === null) return null;
  return { kind: "system", source: "pinned", text: "", sections: [{ name, text }] };
}

function viewOf(raw: Json): EntryView | null {
  switch (raw.type) {
    case TYPE_MESSAGE:
      return messageView(raw.message);
    case TYPE_CUSTOM:
      return raw.customType === CUSTOM_PINNED_CONTEXT ? pinnedView(raw.data) : null;
    case TYPE_COMPACTION:
      return { kind: "compaction" };
    case TYPE_MODEL_CHANGE:
      return { kind: "model_change", model: stringOf(raw.modelId) };
    case TYPE_THINKING_LEVEL_CHANGE:
      return { kind: "thinking_level_change", level: stringOf(raw.thinkingLevel) };
    default:
      return null;
  }
}

export function entryView(entry: TraceSessionEntry): EntryView {
  return (isRecord(entry.entry) ? viewOf(entry.entry) : null) ?? other(entry);
}

export function toolCallIn(view: EntryView, toolCallId: string): EntryToolCall | null {
  if (view.kind !== "assistant") return null;
  return view.toolCalls.find((call) => call.id === toolCallId) ?? null;
}
