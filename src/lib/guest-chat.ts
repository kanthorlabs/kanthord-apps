import type { WorkbenchGuestState, WorkbenchRunSnapshot } from "@/api/types";
import type { ChatItem } from "./workbench-chat";

export const GUEST_NOTE_HINT = "Note to everyone";

const VALIDATION_FAILED = "gateway.request.validation_failed";
const NOTE_TOO_LONG = "The note is too long. Send at most 16384 bytes.";
const STREAMING_ITEM_ID = "streaming";

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

export function guestSnapshotOf(state: WorkbenchGuestState): WorkbenchRunSnapshot {
  return {
    streaming_message:
      state.streaming === null || state.streaming === ""
        ? null
        : { role: "assistant", content: [{ type: "text", text: state.streaming }] },
    pending_tool_calls: [],
    pending_approval: null,
    queue: [],
    run_active: state.run_active,
    error_message: null,
    auto_mode: state.auto_mode,
    phase: null,
  };
}

function guestItemOf(item: ChatItem, streamingName: string): readonly ChatItem[] {
  if (item.kind === "tool-result" || item.kind === "evidence-row") return [];
  if (item.kind === "tool-call") return [{ ...item, input: "", guard: null }];
  if (item.kind === "phase-group") {
    return [{ ...item, items: guestItemsOf(item.items, streamingName) }];
  }
  if (item.kind === "assistant" && item.id === STREAMING_ITEM_ID) {
    return [{ ...item, display_name: streamingName }];
  }
  return [item];
}

export function guestItemsOf(
  items: readonly ChatItem[],
  streamingName: string,
): readonly ChatItem[] {
  return items.flatMap((item) => guestItemOf(item, streamingName));
}
