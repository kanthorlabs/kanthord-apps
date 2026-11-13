import type { InboxReason } from "@/api/types";

interface InboxReasonEntry {
  readonly reason: InboxReason;
  readonly label: string;
}

const INBOX_REASONS: readonly InboxReasonEntry[] = [
  { reason: "linked", label: "Linked to your nodes" },
  { reason: "review_requested", label: "Review requested" },
  { reason: "assigned", label: "Assigned to you" },
  { reason: "direct", label: "Direct messages" },
  { reason: "mentioned", label: "Mentions you" },
  { reason: "participating", label: "Replies in your threads" },
];

export function inboxReasonRankOf(reason: InboxReason): number {
  return INBOX_REASONS.findIndex((entry) => entry.reason === reason);
}

export function inboxReasonLabelOf(reason: InboxReason): string {
  return INBOX_REASONS[inboxReasonRankOf(reason)]?.label ?? reason;
}
