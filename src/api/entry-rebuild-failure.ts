import { byteText } from "@/lib/format";

import type { ApiError } from "./errors";
import type { SessionEntryAbsentReason, SessionEntryUnreachableReason } from "./types";

const UNREACHABLE = "tracking.entry.unreachable";
const UNREADABLE = "tracking.entry.unreadable";
const TOO_LARGE = "tracking.entry.too_large";
const SESSION_ABSENT = "tracking.entry.session_absent";
const ENTRY_ABSENT = "tracking.entry.entry_absent";

export interface EntryRebuildFailure {
  readonly lead: string;
  readonly instance: string | null;
  readonly tail: string;
}

type InstanceText = (instance: string) => EntryRebuildFailure;

function named(lead: string, tail: string): InstanceText {
  return (instance) => ({ lead, instance, tail });
}

function plain(text: string): EntryRebuildFailure {
  return { lead: text, instance: null, tail: "" };
}

const UNREACHABLE_TEXTS: Readonly<Record<SessionEntryUnreachableReason, InstanceText>> = {
  offline: named(
    "The worker instance ",
    " holds no connection. KanthorD reads its sessions only while it runs. Start it, then try again.",
  ),
  timeout: named(
    "The worker instance ",
    " did not answer within 25 s. A large entry over a slow link cannot finish in time.",
  ),
  busy: named("The worker instance ", " serves 8 reads now. Try again."),
};

const SESSION_ABSENT_TEXTS: Readonly<
  Record<Exclude<SessionEntryAbsentReason, "instance_unknown">, InstanceText>
> = {
  not_kept: named("The host of ", " holds no file of this session."),
  archived: named("The worker instance ", " is archived. KanthorD no longer reads its sessions."),
};

const UNREADABLE_TEXT = named("KanthorD could not read the session file of ", ". Try again.");

const ENTRY_ABSENT_TEXT = named("The session file on ", " holds no entry with this identity.");

const INSTANCE_UNKNOWN_TEXT = plain("No worker instance of KanthorD ran this session.");

function field(details: unknown, key: string): unknown {
  if (typeof details !== "object" || details === null) return null;
  return Reflect.get(details, key);
}

function stringField(details: unknown, key: string): string | null {
  const value = field(details, key);
  return typeof value === "string" ? value : null;
}

function numberField(details: unknown, key: string): number | null {
  const value = field(details, key);
  return typeof value === "number" ? value : null;
}

function isKey<K extends string>(
  texts: Readonly<Record<K, unknown>>,
  key: string | null,
): key is K {
  return key !== null && Object.hasOwn(texts, key);
}

function textOf(error: ApiError): EntryRebuildFailure | null {
  const instance = stringField(error.details, "instance");
  const reason = stringField(error.details, "reason");
  if (error.detail === SESSION_ABSENT && reason === "instance_unknown")
    return INSTANCE_UNKNOWN_TEXT;
  if (instance === null) return null;
  switch (error.detail) {
    case UNREACHABLE:
      return isKey(UNREACHABLE_TEXTS, reason) ? UNREACHABLE_TEXTS[reason](instance) : null;
    case SESSION_ABSENT:
      return isKey(SESSION_ABSENT_TEXTS, reason) ? SESSION_ABSENT_TEXTS[reason](instance) : null;
    case UNREADABLE:
      return UNREADABLE_TEXT(instance);
    case ENTRY_ABSENT:
      return ENTRY_ABSENT_TEXT(instance);
    case TOO_LARGE: {
      const bytes = numberField(error.details, "bytes");
      const limit = numberField(error.details, "limit");
      if (bytes === null || limit === null) return null;
      return plain(
        `The full entry holds ${byteText(bytes)}. KanthorD rebuilds an entry of at most ${byteText(limit)}.`,
      );
    }
    default:
      return null;
  }
}

export function entryRebuildFailure(error: ApiError): EntryRebuildFailure {
  return textOf(error) ?? plain(error.message);
}
