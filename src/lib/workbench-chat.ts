import type { WorkbenchRunSnapshot, WorkbenchSessionEntry } from "@/api/types";

export type ChatItem =
  | { readonly kind: "user"; readonly id: string; readonly text: string }
  | {
      readonly kind: "assistant";
      readonly id: string;
      readonly text: string;
      readonly streaming: boolean;
    }
  | {
      readonly kind: "tool-call";
      readonly id: string;
      readonly name: string;
      readonly input: string;
      readonly state: "done" | "running" | "awaiting-approval";
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

function assistantItems(
  id: string,
  message: Block,
  snapshot: WorkbenchRunSnapshot,
  streaming: boolean,
): readonly ChatItem[] {
  const blocks = blocksOf(message["content"]);
  const text = textOf(blocks);
  const items: ChatItem[] = text === "" ? [] : [{ kind: "assistant", id, text, streaming }];
  for (const block of blocks) {
    if (block["type"] !== "toolCall") continue;
    const callId = stringOf(block["id"]);
    const awaiting = snapshot.pending_approval?.tool_call_id === callId;
    const running = streaming || snapshot.pending_tool_calls.includes(callId);
    items.push({
      kind: "tool-call",
      id: `${id}:${callId}`,
      name: stringOf(block["name"]),
      input: JSON.stringify(block["arguments"] ?? {}, null, 2),
      state: awaiting ? "awaiting-approval" : running ? "running" : "done",
    });
  }
  return items;
}

function entryItems(
  entry: WorkbenchSessionEntry,
  snapshot: WorkbenchRunSnapshot,
): readonly ChatItem[] {
  const message = entry["message"];
  if (entry.type !== "message" || !isRecord(message)) return [];
  const role = message["role"];
  if (role === "user") {
    return [{ kind: "user", id: entry.id, text: textOf(blocksOf(message["content"])) }];
  }
  if (role === "assistant") return assistantItems(entry.id, message, snapshot, false);
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

export function chatItemsOf(
  entries: readonly WorkbenchSessionEntry[],
  snapshot: WorkbenchRunSnapshot,
): readonly ChatItem[] {
  const items = entries.flatMap((entry) => entryItems(entry, snapshot));
  const streaming = snapshot.streaming_message;
  if (streaming === null || streaming["role"] !== "assistant") return items;
  return [...items, ...assistantItems("streaming", streaming, snapshot, true)];
}

export function agentWorking(items: readonly ChatItem[], snapshot: WorkbenchRunSnapshot): boolean {
  if (!snapshot.run_active || snapshot.pending_approval !== null) return false;
  const last = items.at(-1);
  return !(last?.kind === "assistant" && last.streaming);
}
