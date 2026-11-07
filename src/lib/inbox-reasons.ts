import type { InboxReason } from "@/api/types";

export interface InboxReasonEntry {
  readonly reason: InboxReason;
  readonly label: string;
  readonly cause: string;
}

export const INBOX_REASONS: readonly InboxReasonEntry[] = [
  {
    reason: "linked",
    label: "Linked to your nodes",
    cause: "A thread that a linked node follows got a new update.",
  },
  {
    reason: "review_requested",
    label: "Review requested",
    cause: "Someone asks you for a review.",
  },
  { reason: "assigned", label: "Assigned to you", cause: "Someone assigned the thread to you." },
  {
    reason: "direct",
    label: "Direct messages",
    cause: "Someone wrote to you in a direct message.",
  },
  { reason: "mentioned", label: "Mentions you", cause: "Someone mentioned you in a thread." },
  {
    reason: "participating",
    label: "Replies in your threads",
    cause: "A thread that you took part in got a new reply.",
  },
];

export function inboxReasonRankOf(reason: InboxReason): number {
  return INBOX_REASONS.findIndex((entry) => entry.reason === reason);
}

export function inboxReasonLabelOf(reason: InboxReason): string {
  return INBOX_REASONS[inboxReasonRankOf(reason)]?.label ?? reason;
}

export function inboxReasonCauseOf(reason: InboxReason): string {
  return INBOX_REASONS[inboxReasonRankOf(reason)]?.cause ?? reason;
}
