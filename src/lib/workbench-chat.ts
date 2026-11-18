import {
  NODE_STATES,
  WORKBENCH_FORK_FRAME,
  WORKBENCH_FORK_PREFIX,
  WORKBENCH_PLAN_ENTRY,
  type WorkbenchActionOffer,
  type WorkbenchActionOperation,
  type WorkbenchActionResult,
  type WorkbenchAuthorRecord,
  type WorkbenchForkRecord,
  type WorkbenchGuardRecord,
  type WorkbenchMember,
  type WorkbenchNoteRecord,
  type WorkbenchPlanDetails,
  type WorkbenchQueueClearRecord,
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
  "llm.credential.rotate": "Rotate",
  "project.bindingSet.write": "Edit bindings of",
  "agent.enablement.put": "Edit default of",
};

export type ActionCardState = "done" | "superseded" | "unknown" | "waiting" | "live";

export interface EvidenceReadFacts {
  readonly asset_id: string;
  readonly node_id: string;
  readonly attempt: number;
  readonly media_type: string;
  readonly size: number;
  readonly offset: number;
  readonly length: number;
  readonly truncated: boolean;
}

export interface ChatItemOrigin {
  readonly session_id: string;
  readonly agent_name: string;
  readonly display_name: string;
}

type ChatItemBody =
  | {
      readonly kind: "user";
      readonly id: string;
      readonly text: string;
      readonly timestamp: number;
      readonly guest?: string;
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
      readonly guard: WorkbenchGuardRecord | null;
    }
  | {
      readonly kind: "tool-result";
      readonly id: string;
      readonly name: string;
      readonly text: string;
      readonly isError: boolean;
    }
  | {
      readonly kind: "evidence-row";
      readonly id: string;
      readonly facts: EvidenceReadFacts;
    }
  | {
      readonly kind: "action-card";
      readonly id: string;
      readonly offer: WorkbenchActionOffer;
      readonly results: readonly WorkbenchActionResult[];
      readonly state: ActionCardState;
      readonly guest?: string;
    }
  | {
      readonly kind: "fork";
      readonly id: string;
      readonly source_title: string;
      readonly source_id: string | null;
      readonly summary: string;
    }
  | {
      readonly kind: "guest-action";
      readonly id: string;
      readonly operation_id: string;
      readonly target_id: string;
      readonly result: string | null;
    }
  | {
      readonly kind: "note";
      readonly id: string;
      readonly text: string;
      readonly author: WorkbenchNoteRecord["author"];
      readonly timestamp: number;
    }
  | {
      readonly kind: "queue-clear";
      readonly id: string;
      readonly count: number;
      readonly cause: WorkbenchQueueClearRecord["cause"];
    }
  | {
      readonly kind: "plan";
      readonly id: string;
      readonly text: string;
      readonly unresolved: WorkbenchPlanDetails["unresolved"];
      readonly author: string;
      readonly timestamp: number;
    }
  | {
      readonly kind: "phase-group";
      readonly id: string;
      readonly phase: WorkbenchPhase;
      readonly items: readonly ChatItem[];
    };

export type ChatItem = ChatItemBody & ChatItemOrigin;

type WorkbenchPhase = NonNullable<WorkbenchRunSnapshot["phase"]>;

export const PHASE_LABELS: Readonly<Record<WorkbenchPhase, string>> = {
  planner: "Planner",
  reviewer: "Reviewer",
};

export type ActionCardItem = Extract<ChatItem, { kind: "action-card" }>;

type Block = Readonly<Record<string, unknown>>;

const SUMMARY_LIMIT = 80;
const OFFER_TOOL = "offer_action";
const EVIDENCE_READ_TOOL = "evidence_read";
const RECORD_TYPE = "kanthord.workbench.record";
const RESULT_TYPE = "kanthord.workbench.action_result";
const PLAN_AGENT = "plan@1";
const FORK_ACK = "I read the summary of the earlier conversation.";
const FORK_KEYS = ["kind", "source_title"];
const NOTE_KEYS = ["kind", "text", "author"];
const NOTE_AUTHOR_KEYS = ["kind", "name"];
const AUTHOR_KEYS = ["kind", "author"];
const GUARD_KEYS = ["kind", "tool_call_id", "operation_id", "reason"];
const OFFER_KEYS = ["kind", "tool_call_id", "operation_id", "target_id", "seen"];
const NODE_SEEN_KEYS = ["name", "state", "attempt"];
const PROJECT_SEEN_KEYS = ["name", "paused"];
const REVISION_SEEN_KEYS = ["revision"];
const VERSION_SEEN_KEYS = ["version"];

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
  if (hasExactKeys(value, REVISION_SEEN_KEYS)) {
    return typeof value["revision"] === "number" ? { revision: value["revision"] } : null;
  }
  if (hasExactKeys(value, VERSION_SEEN_KEYS)) {
    return typeof value["version"] === "number" ? { version: value["version"] } : null;
  }
  const name = value["name"];
  if (typeof name !== "string") return null;
  if (hasExactKeys(value, PROJECT_SEEN_KEYS)) {
    return typeof value["paused"] === "boolean" ? { name, paused: value["paused"] } : null;
  }
  if (!hasExactKeys(value, NODE_SEEN_KEYS)) return null;
  const state = NODE_STATES.find((candidate) => candidate === value["state"]);
  const attempt = value["attempt"];
  return state !== undefined && typeof attempt === "number" ? { name, state, attempt } : null;
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

function guardRecordOf(entry: WorkbenchSessionEntry): WorkbenchGuardRecord | null {
  const data = entry["data"];
  if (entry.type !== "custom" || entry["customType"] !== RECORD_TYPE) return null;
  if (!isRecord(data) || !hasExactKeys(data, GUARD_KEYS) || data["kind"] !== "guard") return null;
  const { tool_call_id, operation_id, reason } = data;
  if (
    typeof tool_call_id !== "string" ||
    typeof operation_id !== "string" ||
    typeof reason !== "string"
  ) {
    return null;
  }
  return { kind: "guard", tool_call_id, operation_id, reason };
}

function forkRecordOf(entry: WorkbenchSessionEntry): WorkbenchForkRecord | null {
  const data = entry["data"];
  if (entry.type !== "custom" || entry["customType"] !== RECORD_TYPE) return null;
  if (!isRecord(data) || !hasExactKeys(data, FORK_KEYS) || data["kind"] !== "fork") return null;
  const { source_title } = data;
  return typeof source_title === "string" ? { kind: "fork", source_title } : null;
}

function noteRecordOf(entry: WorkbenchSessionEntry): WorkbenchNoteRecord | null {
  const data = entry["data"];
  if (entry.type !== "custom" || entry["customType"] !== RECORD_TYPE) return null;
  if (!isRecord(data) || !hasExactKeys(data, NOTE_KEYS) || data["kind"] !== "note") return null;
  const { text, author } = data;
  if (typeof text !== "string" || !isRecord(author) || !hasExactKeys(author, NOTE_AUTHOR_KEYS)) {
    return null;
  }
  const { kind, name } = author;
  if ((kind !== "owner" && kind !== "guest") || typeof name !== "string") return null;
  return { kind: "note", text, author: { kind, name } };
}

function authorRecordOf(entry: WorkbenchSessionEntry): WorkbenchAuthorRecord | null {
  const data = entry["data"];
  if (entry.type !== "custom" || entry["customType"] !== RECORD_TYPE) return null;
  if (!isRecord(data) || !hasExactKeys(data, AUTHOR_KEYS) || data["kind"] !== "author") return null;
  const { author } = data;
  if (!isRecord(author) || !hasExactKeys(author, NOTE_AUTHOR_KEYS)) return null;
  const { kind, name } = author;
  if (kind !== "guest" || typeof name !== "string") return null;
  return { kind: "author", author: { kind, name } };
}

function noteItems(entry: WorkbenchSessionEntry): readonly ChatItemBody[] {
  const note = noteRecordOf(entry);
  if (note === null) return [];
  return [
    {
      kind: "note",
      id: entry.id,
      text: note.text,
      author: note.author,
      timestamp: Date.parse(entry.timestamp),
    },
  ];
}

function userTextOf(entry: WorkbenchSessionEntry | undefined): string | null {
  const message = entry?.["message"];
  if (entry?.type !== "message" || !isRecord(message) || message["role"] !== "user") return null;
  return textOf(blocksOf(message["content"]));
}

function isForkAck(entry: WorkbenchSessionEntry | undefined): boolean {
  const message = entry?.["message"];
  if (entry?.type !== "message" || !isRecord(message) || message["role"] !== "assistant") {
    return false;
  }
  return textOf(blocksOf(message["content"])) === FORK_ACK;
}

function forkSummaryOf(text: string | null, sourceId: string | null): string | null {
  if (text === null || sourceId === null) return null;
  const opening = `${WORKBENCH_FORK_PREFIX}${sourceId}.${WORKBENCH_FORK_FRAME}`;
  return text.startsWith(opening) ? text.slice(opening.length).trim() : null;
}

export function forkSourceIdOf(entries: readonly WorkbenchSessionEntry[]): string | null {
  const index = entries.findIndex((entry) => forkRecordOf(entry) !== null);
  const text = index === -1 ? null : userTextOf(entries[index + 1]);
  if (text === null || !text.startsWith(WORKBENCH_FORK_PREFIX)) return null;
  const rest = text.slice(WORKBENCH_FORK_PREFIX.length);
  const end = rest.indexOf(".");
  return end === -1 ? null : rest.slice(0, end);
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
  readonly guards: ReadonlyMap<string, WorkbenchGuardRecord>;
  readonly forkedFrom: string | null;
  readonly forkSummaries: ReadonlyMap<number, string>;
  readonly hiddenIndexes: ReadonlySet<number>;
  readonly userGuests: ReadonlyMap<number, string>;
  readonly offerGuests: ReadonlyMap<number, string>;
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

function guestOf(name: string | undefined): { readonly guest: string } | Record<string, never> {
  return name === undefined ? {} : { guest: name };
}

function actionCardItems(
  entry: WorkbenchSessionEntry,
  index: number,
  snapshot: WorkbenchRunSnapshot,
  context: ResultContext,
): readonly ChatItemBody[] {
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
      ...guestOf(context.offerGuests.get(index)),
    },
  ];
}

function callState(
  callId: string,
  index: number,
  snapshot: WorkbenchRunSnapshot,
  streaming: boolean,
  context: ResultContext,
): Extract<ChatItemBody, { kind: "tool-call" }>["state"] {
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
): readonly ChatItemBody[] {
  const blocks = blocksOf(message["content"]);
  const text = textOf(blocks);
  const items: ChatItemBody[] =
    text === "" ? [] : [{ kind: "assistant", id, text, streaming, timestamp }];
  for (const block of blocks) {
    if (block["type"] !== "toolCall") continue;
    if (block["name"] === OFFER_TOOL || block["name"] === EVIDENCE_READ_TOOL) continue;
    const callId = stringOf(block["id"]);
    items.push({
      kind: "tool-call",
      id: `${id}:${callId}`,
      name: stringOf(block["name"]),
      input: JSON.stringify(block["arguments"] ?? {}, null, 2),
      state: callState(callId, index, snapshot, streaming, context),
      guard: context.guards.get(callId) ?? null,
    });
  }
  return items;
}

function evidenceFactsOf(value: unknown): EvidenceReadFacts | null {
  if (!isRecord(value)) return null;
  const { asset_id, node_id, attempt, media_type, size, offset, length, truncated } = value;
  if (
    typeof asset_id !== "string" ||
    typeof node_id !== "string" ||
    typeof media_type !== "string" ||
    typeof attempt !== "number" ||
    typeof size !== "number" ||
    typeof offset !== "number" ||
    typeof length !== "number" ||
    typeof truncated !== "boolean"
  ) {
    return null;
  }
  return { asset_id, node_id, attempt, media_type, size, offset, length, truncated };
}

function firstTextOf(blocks: readonly Block[]): string {
  return textOf(blocks.filter((block) => block["type"] === "text").slice(0, 1));
}

function evidenceFactsOfResult(message: Block): EvidenceReadFacts | null {
  const fromDetails = evidenceFactsOf(message["details"]);
  if (fromDetails !== null) return fromDetails;
  try {
    return evidenceFactsOf(JSON.parse(firstTextOf(blocksOf(message["content"]))));
  } catch {
    return null;
  }
}

function toolResultItems(id: string, message: Block): readonly ChatItemBody[] {
  const name = stringOf(message["toolName"]);
  const isError = message["isError"] === true;
  if (name === EVIDENCE_READ_TOOL && !isError) {
    const facts = evidenceFactsOfResult(message);
    if (facts !== null) return [{ kind: "evidence-row", id, facts }];
    return [
      { kind: "tool-result", id, name, text: firstTextOf(blocksOf(message["content"])), isError },
    ];
  }
  return [{ kind: "tool-result", id, name, text: textOf(blocksOf(message["content"])), isError }];
}

function forkItems(
  entry: WorkbenchSessionEntry,
  index: number,
  context: ResultContext,
): readonly ChatItemBody[] {
  const fork = forkRecordOf(entry);
  const summary = context.forkSummaries.get(index);
  if (fork === null || summary === undefined || context.forkedFrom === null) return [];
  return [
    {
      kind: "fork",
      id: entry.id,
      source_title: fork.source_title,
      source_id: context.forkedFrom,
      summary,
    },
  ];
}

function entryItems(
  entry: WorkbenchSessionEntry,
  index: number,
  snapshot: WorkbenchRunSnapshot,
  context: ResultContext,
): readonly ChatItemBody[] {
  if (context.hiddenIndexes.has(index)) return [];
  if (context.forkSummaries.has(index)) return forkItems(entry, index, context);
  if (noteRecordOf(entry) !== null) return noteItems(entry);
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
        ...guestOf(context.userGuests.get(index)),
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
    return toolResultItems(entry.id, message);
  }
  return [];
}

function resultContextOf(
  entries: readonly WorkbenchSessionEntry[],
  forkedFrom: string | null,
): ResultContext {
  const forkSummaries = new Map<number, string>();
  const hiddenIndexes = new Set<number>();
  const resultIds = new Set<string>();
  const actionResults = new Map<string, WorkbenchActionResult[]>();
  const guards = new Map<string, WorkbenchGuardRecord>();
  const userGuests = new Map<number, string>();
  const offerGuests = new Map<number, string>();
  const pendingAuthors = new Map<string, string>();
  const runGuests = new Map<string, string | undefined>();
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
    const guard = guardRecordOf(entry);
    if (guard !== null) guards.set(guard.tool_call_id, guard);
    const summary =
      forkRecordOf(entry) === null
        ? null
        : forkSummaryOf(userTextOf(entries[index + 1]), forkedFrom);
    if (summary !== null) {
      forkSummaries.set(index, summary);
      hiddenIndexes.add(index + 1);
      if (isForkAck(entries[index + 2])) hiddenIndexes.add(index + 2);
    }
    const author = authorRecordOf(entry);
    if (author !== null) pendingAuthors.set(entry.session_id, author.author.name);
    if (offerOf(entry) !== null) {
      lastOfferIndex = index;
      const guest = runGuests.get(entry.session_id);
      if (guest !== undefined) offerGuests.set(index, guest);
    }
    if (entry.type !== "message" || !isRecord(message)) return;
    if (message["role"] === "user") {
      lastUserIndex = index;
      const guest = pendingAuthors.get(entry.session_id);
      pendingAuthors.delete(entry.session_id);
      runGuests.set(entry.session_id, guest);
      if (guest !== undefined) userGuests.set(index, guest);
    }
    if (message["role"] === "toolResult") resultIds.add(stringOf(message["toolCallId"]));
  });
  return {
    resultIds,
    lastUserIndex,
    lastOfferIndex,
    actionResults,
    guards,
    forkedFrom,
    forkSummaries,
    hiddenIndexes,
    userGuests,
    offerGuests,
  };
}

export function memberOf(members: readonly WorkbenchMember[], sessionId: string): WorkbenchMember {
  const member = members.find((candidate) => candidate.session_id === sessionId);
  if (member === undefined) throw new Error(`The conversation has no member ${sessionId}`);
  return member;
}

function originOf(member: WorkbenchMember): ChatItemOrigin {
  return {
    session_id: member.session_id,
    agent_name: member.agent_name,
    display_name: member.display_name,
  };
}

export function unresolvedLine(unresolved: WorkbenchPlanDetails["unresolved"]): string | null {
  if (unresolved === null) return null;
  if (unresolved === "missing") return "Review unresolved: no Review section";
  return `Review unresolved: ${unresolved} open action:YES findings`;
}

function unresolvedOf(entry: WorkbenchSessionEntry): WorkbenchPlanDetails["unresolved"] {
  const details = entry["details"];
  if (!isRecord(details)) return null;
  const unresolved = details["unresolved"];
  return typeof unresolved === "number" || unresolved === "missing" ? unresolved : null;
}

function planItemOf(entry: WorkbenchSessionEntry, author: string): ChatItemBody | null {
  if (entry.type !== "custom_message" || entry["customType"] !== WORKBENCH_PLAN_ENTRY) {
    return null;
  }
  return {
    kind: "plan",
    id: entry.id,
    text: textOf(blocksOf(entry["content"])),
    unresolved: unresolvedOf(entry),
    author,
    timestamp: Date.parse(entry.timestamp),
  };
}

function phaseOf(entry: WorkbenchSessionEntry): WorkbenchPhase | null {
  return entry.phase === "planner" || entry.phase === "reviewer" ? entry.phase : null;
}

export function planMemberOf(members: readonly WorkbenchMember[]): WorkbenchMember {
  const member = members.find((candidate) => candidate.agent_name === PLAN_AGENT);
  if (member === undefined) throw new Error(`The conversation has no member ${PLAN_AGENT}`);
  return member;
}

function memberOfEntry(
  members: readonly WorkbenchMember[],
  entry: WorkbenchSessionEntry,
): WorkbenchMember {
  return phaseOf(entry) === null ? memberOf(members, entry.session_id) : planMemberOf(members);
}

function entryChatItems(
  entry: WorkbenchSessionEntry,
  index: number,
  snapshot: WorkbenchRunSnapshot,
  context: ResultContext,
  origin: ChatItemOrigin,
): readonly ChatItem[] {
  const plan = planItemOf(entry, origin.display_name);
  const bodies = plan === null ? entryItems(entry, index, snapshot, context) : [plan];
  return bodies.map((body) => ({ ...body, ...origin }));
}

export function chatItemsOf(
  entries: readonly WorkbenchSessionEntry[],
  snapshot: WorkbenchRunSnapshot,
  members: readonly WorkbenchMember[],
  forkedFrom: string | null = null,
): readonly ChatItem[] {
  const context = resultContextOf(entries, forkedFrom);
  const items: ChatItem[] = [];
  const groups = new Map<string, ChatItem[]>();
  entries.forEach((entry, index) => {
    const phase = phaseOf(entry);
    if (phase !== null && userTextOf(entry) !== null) return;
    const origin = originOf(memberOfEntry(members, entry));
    const entryItemList = entryChatItems(entry, index, snapshot, context, origin);
    if (phase === null) return void items.push(...entryItemList);
    const held = groups.get(entry.session_id);
    if (held !== undefined) return void held.push(...entryItemList);
    const groupItems = [...entryItemList];
    groups.set(entry.session_id, groupItems);
    items.push({
      kind: "phase-group",
      id: `phase:${entry.session_id}`,
      phase,
      items: groupItems,
      ...origin,
    });
  });
  const streaming = snapshot.streaming_message;
  if (streaming === null || streaming["role"] !== "assistant") return items;
  const lastEntry = entries.at(-1);
  const streamingMember = lastEntry === undefined ? members[0] : memberOfEntry(members, lastEntry);
  if (streamingMember === undefined) throw new Error("The conversation has no member");
  return [
    ...items,
    ...assistantItems("streaming", streaming, snapshot, true, null, entries.length, context).map(
      (item) => ({ ...item, ...originOf(streamingMember) }),
    ),
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
