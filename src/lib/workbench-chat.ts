import type { WorkbenchRunSnapshot, WorkbenchSessionEntry } from "@/api/types";

export type ChatItem =
  | {
      readonly kind: "user";
      readonly id: string;
      readonly text: string;
      readonly timestamp: number;
    }
  | {
      readonly kind: "assistant";
      readonly id: string;
      readonly text: string;
      readonly streaming: boolean;
      readonly timestamp: number | null;
    }
  | {
      readonly kind: "tool-call";
      readonly id: string;
      readonly name: string;
      readonly input: string;
      readonly state: "done" | "running" | "awaiting-approval" | "no-result";
    }
  | {
      readonly kind: "tool-result";
      readonly id: string;
      readonly name: string;
      readonly text: string;
      readonly isError: boolean;
    };

type Block = Readonly<Record<string, unknown>>;

const SUMMARY_LIMIT = 80;

function isRecord(value: unknown): value is Block {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function blocksOf(content: unknown): readonly Block[] {
  if (typeof content === "string") return [{ type: "text", text: content }];
  return Array.isArray(content) ? content.filter(isRecord) : [];
}

function textOf(blocks: readonly Block[]): string {
  return blocks
    .map((block) =>
      block["type"] === "text" && typeof block["text"] === "string" ? block["text"] : "",
    )
    .join("");
}

function stringOf(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function summaryOf(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  return line.length > SUMMARY_LIMIT ? `${line.slice(0, SUMMARY_LIMIT)}…` : line;
}

interface ResultContext {
  readonly resultIds: ReadonlySet<string>;
  readonly lastUserIndex: number;
}

function callState(
  callId: string,
  index: number,
  snapshot: WorkbenchRunSnapshot,
  streaming: boolean,
  context: ResultContext,
): Extract<ChatItem, { kind: "tool-call" }>["state"] {
  if (snapshot.pending_approval?.tool_call_id === callId) return "awaiting-approval";
  if (streaming || snapshot.pending_tool_calls.includes(callId)) return "running";
  if (context.resultIds.has(callId)) return "done";
  if (!snapshot.run_active || context.lastUserIndex > index) return "no-result";
  return "done";
}

function assistantItems(
  id: string,
  message: Block,
  snapshot: WorkbenchRunSnapshot,
  streaming: boolean,
  timestamp: number | null,
  index: number,
  context: ResultContext,
): readonly ChatItem[] {
  const blocks = blocksOf(message["content"]);
  const text = textOf(blocks);
  const items: ChatItem[] =
    text === "" ? [] : [{ kind: "assistant", id, text, streaming, timestamp }];
  for (const block of blocks) {
    if (block["type"] !== "toolCall") continue;
    const callId = stringOf(block["id"]);
    items.push({
      kind: "tool-call",
      id: `${id}:${callId}`,
      name: stringOf(block["name"]),
      input: JSON.stringify(block["arguments"] ?? {}, null, 2),
      state: callState(callId, index, snapshot, streaming, context),
    });
  }
  return items;
}

function entryItems(
  entry: WorkbenchSessionEntry,
  index: number,
  snapshot: WorkbenchRunSnapshot,
  context: ResultContext,
): readonly ChatItem[] {
  const message = entry["message"];
  if (entry.type !== "message" || !isRecord(message)) return [];
  const role = message["role"];
  if (role === "user") {
    return [
      {
        kind: "user",
        id: entry.id,
        text: textOf(blocksOf(message["content"])),
        timestamp: Date.parse(entry.timestamp),
      },
    ];
  }
  if (role === "assistant") {
    return assistantItems(
      entry.id,
      message,
      snapshot,
      false,
      Date.parse(entry.timestamp),
      index,
      context,
    );
  }
  if (role === "toolResult") {
    return [
      {
        kind: "tool-result",
        id: entry.id,
        name: stringOf(message["toolName"]),
        text: textOf(blocksOf(message["content"])),
        isError: message["isError"] === true,
      },
    ];
  }
  return [];
}

function resultContextOf(entries: readonly WorkbenchSessionEntry[]): ResultContext {
  const resultIds = new Set<string>();
  let lastUserIndex = -1;
  entries.forEach((entry, index) => {
    const message = entry["message"];
    if (entry.type !== "message" || !isRecord(message)) return;
    if (message["role"] === "user") lastUserIndex = index;
    if (message["role"] === "toolResult") resultIds.add(stringOf(message["toolCallId"]));
  });
  return { resultIds, lastUserIndex };
}

export function chatItemsOf(
  entries: readonly WorkbenchSessionEntry[],
  snapshot: WorkbenchRunSnapshot,
): readonly ChatItem[] {
  const context = resultContextOf(entries);
  const items = entries.flatMap((entry, index) => entryItems(entry, index, snapshot, context));
  const streaming = snapshot.streaming_message;
  if (streaming === null || streaming["role"] !== "assistant") return items;
  return [
    ...items,
    ...assistantItems("streaming", streaming, snapshot, true, null, entries.length, context),
  ];
}

export function agentWorking(items: readonly ChatItem[], snapshot: WorkbenchRunSnapshot): boolean {
  if (!snapshot.run_active || snapshot.pending_approval !== null) return false;
  const last = items.at(-1);
  return !(last?.kind === "assistant" && last.streaming);
}

export interface WorkbenchPathMatch {
  readonly start: number;
  readonly end: number;
  readonly path: string;
}

const PATH_SEGMENT = String.raw`[\w~-]+(?:\.[\w~-]+)*`;
const WORKBENCH_PATH = new RegExp(
  String.raw`(?<![\w/:.~-])/${PATH_SEGMENT}(?:/${PATH_SEGMENT})+`,
  "g",
);

export function workbenchPathsIn(text: string): readonly WorkbenchPathMatch[] {
  return [...text.matchAll(WORKBENCH_PATH)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    path: match[0],
  }));
}

export function runErrorTargetId(items: readonly ChatItem[]): string | null {
  return items.filter((item) => item.kind === "user").at(-1)?.id ?? null;
}
