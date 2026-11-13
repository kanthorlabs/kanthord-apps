import {
  NODE_STATES,
  type WorkbenchActionOffer,
  type WorkbenchActionOperation,
  type WorkbenchActionResult,
  type WorkbenchRunSnapshot,
  type WorkbenchSessionEntry,
} from "@/api/types";

export const ACTION_VERBS: Readonly<Record<WorkbenchActionOperation, string>> = {
  "mission.node.resume": "Resume",
  "mission.node.unblock": "Unblock",
  "mission.node.check": "Check",
  "mission.node.discard": "Discard",
  "mission.node.override": "Override",
  "mission.node.pause": "Pause",
  "project.pause": "Pause",
  "project.resume": "Resume",
};

export type ActionCardState = "done" | "superseded" | "unknown" | "waiting" | "live";

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
    }
  | {
      readonly kind: "action-card";
      readonly id: string;
      readonly offer: WorkbenchActionOffer;
      readonly results: readonly WorkbenchActionResult[];
      readonly state: ActionCardState;
    };

export type ActionCardItem = Extract<ChatItem, { kind: "action-card" }>;

type Block = Readonly<Record<string, unknown>>;

const SUMMARY_LIMIT = 80;
const OFFER_TOOL = "offer_action";
const RECORD_TYPE = "kanthord.workbench.record";
const RESULT_TYPE = "kanthord.workbench.action_result";
const OFFER_KEYS = ["kind", "tool_call_id", "operation_id", "target_id", "seen"];
const NODE_SEEN_KEYS = ["state", "attempt"];
const PROJECT_SEEN_KEYS = ["paused"];

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

function hasExactKeys(value: Block, keys: readonly string[]): boolean {
  const own = Object.keys(value);
  return own.length === keys.length && keys.every((key) => key in value);
}

function seenOf(value: unknown): WorkbenchActionOffer["seen"] | null {
  if (!isRecord(value)) return null;
  if (hasExactKeys(value, PROJECT_SEEN_KEYS)) {
    return typeof value["paused"] === "boolean" ? { paused: value["paused"] } : null;
  }
  if (!hasExactKeys(value, NODE_SEEN_KEYS)) return null;
  const state = NODE_STATES.find((candidate) => candidate === value["state"]);
  const attempt = value["attempt"];
  return state !== undefined && typeof attempt === "number" ? { state, attempt } : null;
}

function offerOf(entry: WorkbenchSessionEntry): WorkbenchActionOffer | null {
  const data = entry["data"];
  if (entry.type !== "custom" || entry["customType"] !== RECORD_TYPE) return null;
  if (!isRecord(data) || !hasExactKeys(data, OFFER_KEYS) || data["kind"] !== "action_offer") {
    return null;
  }
  const seen = seenOf(data["seen"]);
  const { tool_call_id, operation_id, target_id } = data;
  if (
    seen === null ||
    typeof tool_call_id !== "string" ||
    typeof operation_id !== "string" ||
    typeof target_id !== "string"
  ) {
    return null;
  }
  return { kind: "action_offer", tool_call_id, operation_id, target_id, seen };
}

function resultOf(entry: WorkbenchSessionEntry): WorkbenchActionResult | null {
  const details = entry["details"];
  if (entry.type !== "custom_message" || entry["customType"] !== RESULT_TYPE) return null;
  if (!isRecord(details)) return null;
  const { tool_call_id, operation_id, target_id, outcome, error_code } = details;
  if (
    typeof tool_call_id !== "string" ||
    typeof operation_id !== "string" ||
    typeof target_id !== "string" ||
    (outcome !== "done" && outcome !== "failed") ||
    (error_code !== null && typeof error_code !== "string")
  ) {
    return null;
  }
  return { tool_call_id, operation_id, target_id, outcome, error_code };
}

interface ResultContext {
  readonly resultIds: ReadonlySet<string>;
  readonly lastUserIndex: number;
  readonly lastOfferIndex: number;
  readonly actionResults: ReadonlyMap<string, readonly WorkbenchActionResult[]>;
}

function actionCardState(
  offer: WorkbenchActionOffer,
  results: readonly WorkbenchActionResult[],
  index: number,
  snapshot: WorkbenchRunSnapshot,
  context: ResultContext,
): ActionCardState {
  if (results.some((result) => result.outcome === "done")) return "done";
  if (context.lastUserIndex > index || context.lastOfferIndex > index) return "superseded";
  if (!Object.hasOwn(ACTION_VERBS, offer.operation_id)) return "unknown";
  return snapshot.run_active ? "waiting" : "live";
}

function actionCardItems(
  entry: WorkbenchSessionEntry,
  index: number,
  snapshot: WorkbenchRunSnapshot,
  context: ResultContext,
): readonly ChatItem[] {
  const offer = offerOf(entry);
  if (offer === null) return [];
  const results = context.actionResults.get(offer.tool_call_id) ?? [];
  return [
    {
      kind: "action-card",
      id: entry.id,
      offer,
      results,
      state: actionCardState(offer, results, index, snapshot, context),
    },
  ];
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
    if (block["name"] === OFFER_TOOL) continue;
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
  if (entry.type === "custom") return actionCardItems(entry, index, snapshot, context);
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
  if (role === "toolResult" && message["toolName"] !== OFFER_TOOL) {
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
  const actionResults = new Map<string, WorkbenchActionResult[]>();
  let lastUserIndex = -1;
  let lastOfferIndex = -1;
  entries.forEach((entry, index) => {
    const message = entry["message"];
    const result = resultOf(entry);
    if (result !== null) {
      actionResults.set(result.tool_call_id, [
        ...(actionResults.get(result.tool_call_id) ?? []),
        result,
      ]);
    }
    if (offerOf(entry) !== null) lastOfferIndex = index;
    if (entry.type !== "message" || !isRecord(message)) return;
    if (message["role"] === "user") lastUserIndex = index;
    if (message["role"] === "toolResult") resultIds.add(stringOf(message["toolCallId"]));
  });
  return { resultIds, lastUserIndex, lastOfferIndex, actionResults };
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

export function runRequestOf(
  items: readonly ChatItem[],
): Extract<ChatItem, { kind: "user" }> | null {
  return items.filter((item) => item.kind === "user").at(-1) ?? null;
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
