import type {
  GrantedOperation,
  WorkbenchGuestBlock,
  WorkbenchGuestEntry,
  WorkbenchGuestQueueItem,
  WorkbenchGuestState,
  WorkbenchMember,
} from "@/api/types";
import { type ChatItem, type ChatItemOrigin, memberOf, scopeStopLineOf } from "./workbench-chat";

export const GUEST_NOTE_HINT = "Note to everyone";

export function guestQueueRowOf(item: WorkbenchGuestQueueItem): string {
  if (item.display_name === null) return item.author_name;
  return `to @${item.display_name} · ${item.author_name}`;
}

const OWNER_APPROVES_LINE = "The owner approves every act.";

export const GUEST_AUTO_MODE_OFF_LINE = "Auto mode is off: the owner approves every act.";

export function guestGrantLineOf(granted: readonly GrantedOperation[]): string {
  if (granted.length === 0) return OWNER_APPROVES_LINE;
  return `You may run without approval: ${granted.map((operation) => operation.operation_id).join(", ")}.`;
}

export function waitingToolNameOf(operationId: string): string {
  return operationId.replaceAll(".", "--");
}

const VALIDATION_FAILED = "gateway.request.validation_failed";
const NOTE_TOO_LONG = "The note is too long. Send at most 16384 bytes.";
const STREAMING_ITEM_ID = "streaming";
const HIDDEN_TOOLS: readonly string[] = ["offer_action", "evidence_read", "request_owner_act"];

interface NoteFailure {
  readonly code: string;
  readonly status: number;
  readonly message: string;
  readonly detail: string;
  readonly details?: unknown;
}

export interface GuestLine {
  readonly code: string | null;
  readonly message: string;
}

function holdsTextPath(details: unknown): boolean {
  if (!Array.isArray(details)) return false;
  return details.some((issue: unknown) => {
    if (typeof issue !== "object" || issue === null) return false;
    const path: unknown = Reflect.get(issue, "path");
    return Array.isArray(path) && path.length === 2 && path[0] === "body" && path[1] === "text";
  });
}

export function guestLineOf(error: NoteFailure): GuestLine {
  const code = error.status === 0 || error.detail === "" ? error.code : error.detail;
  if (error.detail === VALIDATION_FAILED && holdsTextPath(error.details)) {
    return { code, message: NOTE_TOO_LONG };
  }
  return { code, message: error.message };
}

function originOf(member: WorkbenchMember): ChatItemOrigin {
  return {
    session_id: member.session_id,
    agent_name: member.agent_name,
    display_name: member.display_name,
  };
}

function blockItemsOf(
  id: string,
  content: readonly WorkbenchGuestBlock[],
  streaming: boolean,
  timestamp: number | null,
  origin: ChatItemOrigin,
): readonly ChatItem[] {
  const text = content.map((block) => (block.type === "text" ? block.text : "")).join("");
  const items: ChatItem[] =
    text === "" ? [] : [{ kind: "assistant", id, text, streaming, timestamp, ...origin }];
  content.forEach((block, index) => {
    if (block.type !== "toolCall" || HIDDEN_TOOLS.includes(block.name)) return;
    items.push({
      kind: "tool-call",
      id: `${id}:${index}`,
      name: block.name,
      input: "",
      state: streaming ? "running" : "done",
      guard: null,
      result: null,
      ...origin,
    });
  });
  return items;
}

function resultsOf(entries: readonly WorkbenchGuestEntry[]): ReadonlyMap<string, string> {
  const results = new Map<string, string>();
  for (const entry of entries) {
    if (entry.kind === "action_result") results.set(entry.tool_call_id, entry.text);
  }
  return results;
}

function guestAuthorsOf(entries: readonly WorkbenchGuestEntry[]): ReadonlyMap<string, string> {
  const pending = new Map<string, string>();
  const authors = new Map<string, string>();
  for (const entry of entries) {
    if (entry.kind === "author") pending.set(entry.session_id, entry.author.name);
    if (entry.kind !== "user") continue;
    const name = pending.get(entry.session_id);
    pending.delete(entry.session_id);
    if (name !== undefined) authors.set(entry.id, name);
  }
  return authors;
}

function entryItemsOf(
  entry: WorkbenchGuestEntry,
  authors: ReadonlyMap<string, string>,
  next: WorkbenchGuestEntry | undefined,
  results: ReadonlyMap<string, string>,
  origin: ChatItemOrigin,
): readonly ChatItem[] {
  const { id } = entry;
  const guest = authors.get(id);
  const timestamp = Date.parse(entry.timestamp);
  switch (entry.kind) {
    case "user":
      return [
        {
          kind: "user",
          id,
          text: entry.text,
          timestamp,
          ...(guest === undefined ? {} : { guest }),
          ...origin,
        },
      ];
    case "scope_stop":
      return [{ kind: "scope-stop", id, text: scopeStopLineOf(entry.operation_id), ...origin }];
    case "queue_clear":
      return [{ kind: "queue-clear", id, text: entry.text, ...origin }];
    case "assistant":
      return blockItemsOf(id, entry.content, false, timestamp, origin);
    case "plan":
      return [
        {
          kind: "plan",
          id,
          text: entry.markdown,
          unresolved: null,
          author: origin.display_name,
          timestamp,
          ...origin,
        },
      ];
    case "note":
      return [{ kind: "note", id, text: entry.text, author: entry.author, timestamp, ...origin }];
    case "action_offer":
      return [
        {
          kind: "guest-action",
          id,
          operation_id: entry.operation_id,
          target_id: entry.target_id,
          result: results.get(entry.tool_call_id) ?? null,
          ...origin,
        },
      ];
    case "fork":
      if (next?.kind !== "summary") return [];
      return [
        {
          kind: "fork",
          id,
          source_title: entry.source_title,
          source_id: null,
          summary: next.text,
          ...origin,
        },
      ];
    case "summary":
    case "action_result":
    case "author":
      return [];
  }
}

export function guestItemsOf(
  entries: readonly WorkbenchGuestEntry[],
  state: WorkbenchGuestState | null,
  members: readonly WorkbenchMember[],
): readonly ChatItem[] {
  const results = resultsOf(entries);
  const authors = guestAuthorsOf(entries);
  const items = entries.flatMap((entry, index) =>
    entryItemsOf(
      entry,
      authors,
      entries[index + 1],
      results,
      originOf(memberOf(members, entry.session_id)),
    ),
  );
  if (state === null || state.streaming === null) return items;
  const lastEntry = entries.at(-1);
  const named = members.find((candidate) => candidate.display_name === state.display_name);
  const member =
    named ?? (lastEntry === undefined ? members[0] : memberOf(members, lastEntry.session_id));
  if (member === undefined) throw new Error("The conversation has no member");
  const origin = {
    ...originOf(member),
    display_name: state.display_name ?? member.display_name,
  };
  return [
    ...items,
    ...blockItemsOf(STREAMING_ITEM_ID, state.streaming.content, true, null, origin),
  ];
}
