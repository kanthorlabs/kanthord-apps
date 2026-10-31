import { BOARD_TABS, type BoardTabId } from "./board-tabs";

export const BOARD_KEYS = {
  approve: "a",
  reject: "n",
  open: "o",
  check: "c",
  verify: "c",
  rotate: "w",
  resume: "r",
  onboarding: "y",
  unblock: "u",
  override: "v",
  discard: "x",
  decide: "d",
  remove: "m",
  goto: "f",
  trace: "t",
} as const;

export type BoardActKey = keyof typeof BOARD_KEYS;

export type BoardMove = "next" | "previous" | "first" | "last";

export type BoardCommand =
  | { readonly type: "tab"; readonly tab: BoardTabId }
  | { readonly type: "move"; readonly to: BoardMove }
  | { readonly type: "step"; readonly delta: 1 | -1 }
  | { readonly type: "filter" }
  | { readonly type: "shortcuts" }
  | { readonly type: "act"; readonly key: string }
  | { readonly type: "enter" }
  | { readonly type: "escape" };

export interface BoardShortcut {
  readonly id: string;
  readonly keys: string;
  readonly meaning: string;
}

export interface BoardKeyEvent {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
}

const ACT_KEY_NAMES: ReadonlyMap<string, BoardActKey> = new Map([
  ["approve", "approve"],
  ["reject", "reject"],
  ["rotate", "rotate"],
  ["verify", "verify"],
  ["onboarding", "onboarding"],
  ["goto", "goto"],
  ["open", "open"],
  ["open_pull_request", "open"],
  ["check", "check"],
  ["unblock", "unblock"],
  ["decide", "decide"],
  ["resume", "resume"],
  ["override", "override"],
  ["discard", "discard"],
  ["remove", "remove"],
  ["last_trace", "trace"],
  ["open_chat", "open"],
  ["fix_target", "goto"],
]);

const ACT_MEANINGS: Readonly<Record<BoardActKey, string>> = {
  approve: "Approve the tool call",
  reject: "Reject the tool call",
  open: "Open the chat",
  check: "Check now",
  verify: "Verify the credential",
  rotate: "Rotate the credential",
  resume: "Resume the node",
  onboarding: "Resume onboarding",
  unblock: "Unblock the node",
  override: "Override the node",
  discard: "Discard the node",
  decide: "Decide the proposals",
  remove: "Remove the dependency",
  goto: "Go to the record to fix",
  trace: "Open the last trace",
};

const ALWAYS_ON: ReadonlyMap<string, BoardCommand> = new Map<string, BoardCommand>([
  ["ArrowDown", { type: "move", to: "next" }],
  ["ArrowUp", { type: "move", to: "previous" }],
  ["Home", { type: "move", to: "first" }],
  ["End", { type: "move", to: "last" }],
  ["Enter", { type: "enter" }],
  ["Escape", { type: "escape" }],
]);

const SINGLE_KEY: ReadonlyMap<string, BoardCommand> = new Map<string, BoardCommand>([
  ["j", { type: "step", delta: 1 }],
  ["k", { type: "step", delta: -1 }],
  ["p", { type: "filter" }],
  ["?", { type: "shortcuts" }],
  ...BOARD_TABS.map((tab): [string, BoardCommand] => [tab.key, { type: "tab", tab: tab.id }]),
  ...Object.values(BOARD_KEYS).map((key): [string, BoardCommand] => [key, { type: "act", key }]),
]);

export const BOARD_SHORTCUTS: readonly BoardShortcut[] = [
  { id: "tabs", keys: "1 to 6", meaning: "Show a tab" },
  { id: "next", keys: "j", meaning: "Select the next card" },
  { id: "previous", keys: "k", meaning: "Select the previous card" },
  { id: "filter", keys: "p", meaning: "Cycle the project filter" },
  { id: "shortcuts", keys: "?", meaning: "Show the keyboard shortcuts" },
  ...(Object.keys(BOARD_KEYS) as BoardActKey[]).map((name) => ({
    id: name,
    keys: BOARD_KEYS[name],
    meaning: ACT_MEANINGS[name],
  })),
  { id: "arrows", keys: "Arrow down, Arrow up", meaning: "Select the next or previous card" },
  { id: "ends", keys: "Home, End", meaning: "Select the first or last card" },
  { id: "enter", keys: "Enter", meaning: "Open the detail of the card" },
  { id: "escape", keys: "Esc", meaning: "Return to the card, or close the detail" },
];

export function boardKeyOf(event: BoardKeyEvent, enabled: boolean): BoardCommand | null {
  if (event.ctrlKey || event.metaKey || event.altKey) return null;
  const always = ALWAYS_ON.get(event.key);
  if (always !== undefined) return always;
  if (!enabled) return null;
  return SINGLE_KEY.get(event.key) ?? null;
}

export function actKeyOf(actId: string): string | null {
  const name = ACT_KEY_NAMES.get(actId.split(":")[0] ?? actId);
  return name === undefined ? null : BOARD_KEYS[name];
}

export function actKeysOf(actIds: readonly string[]): ReadonlyMap<string, string> {
  const taken = new Set<string>();
  const keys = new Map<string, string>();
  for (const id of actIds) {
    const key = actKeyOf(id);
    if (key === null || taken.has(key)) continue;
    taken.add(key);
    keys.set(id, key);
  }
  return keys;
}
