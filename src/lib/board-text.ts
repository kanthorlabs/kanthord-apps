import type {
  AttentionDetails,
  AttentionItem,
  FindingReviewItem,
  OutsideAttentionItem,
} from "./attention";
import { type BoardTab, openProposalsReadOf } from "./board-tabs";
import { counted } from "./counted";
import { codeLabel, stopLabel } from "./execution-stop";
import { inboxLineOf } from "./inbox-attention";
import { inboxReasonLabelOf } from "./inbox-reasons";
import { HUMAN_FINDING_GROUP } from "./review-findings";

const FACT_SEPARATOR = " · ";
const PAUSED_LABEL = "Paused";

function withFact(label: string, fact: string | null | undefined): string {
  return fact === null || fact === undefined ? label : `${label}${FACT_SEPARATOR}${fact}`;
}

function pullRequestNumberOf(item: OutsideAttentionItem): number | null {
  for (const asset of item.request.evidence?.assets ?? []) {
    if (asset.kind === "platform" && asset.address.kind === "pull_request") {
      return asset.address.number;
    }
  }
  return null;
}

function findingFactOf(item: FindingReviewItem): string {
  const human = item.findings.filter((finding) => finding.source === "human").length;
  const review = item.findings.length - human;
  if (review === 0) return counted(human, "finding", "findings");
  const reviewText = counted(review, "review finding", "review findings");
  return human === 0
    ? reviewText
    : `${reviewText}${FACT_SEPARATOR}${human} ${HUMAN_FINDING_GROUP.toLowerCase()}`;
}

function pausedCauseOf(item: Extract<AttentionItem, { kind: "paused" }>): string {
  return item.cause ?? PAUSED_LABEL;
}

export function cardCauseOf(item: AttentionItem): string {
  switch (item.kind) {
    case "tool_approval":
      return `Waits for approval${FACT_SEPARATOR}${item.agent}${FACT_SEPARATOR}${item.operationId}`;
    case "credential_refused":
      return withFact(item.cause, codeLabel("unauthorized"));
    case "request_rejected":
      return withFact(item.cause, codeLabel("bad_request"));
    case "environment_failed":
      return withFact(
        item.cause,
        item.failure?.exit_code == null
          ? null
          : `${item.failure.command} exits ${item.failure.exit_code}`,
      );
    case "environment_pending":
      return withFact(item.cause, item.binding);
    case "no_taker":
      return withFact(item.cause, item.state);
    case "agent_invalid":
      return withFact(item.cause, item.bindings[0]?.binding);
    case "project_paused":
      return item.cause;
    case "paused": {
      const stop = item.pause?.execution?.stop ?? null;
      return withFact(pausedCauseOf(item), stop === null ? null : stopLabel(stop));
    }
    case "blocked":
      return withFact(item.cause, `attempt ${item.node.attempt}`);
    case "dependency_discarded":
      return withFact(item.cause, item.discarded[0]?.name);
    case "finding_review":
      return withFact(item.cause, findingFactOf(item));
    case "followup_proposal":
      return withFact(item.cause, counted(item.proposals.length, "proposal", "proposals"));
    case "merge_wait":
    case "delivery_unconfirmed": {
      const number = pullRequestNumberOf(item);
      return withFact(item.cause, number === null ? null : `pull request #${number}`);
    }
    case "inbox_item":
      return withFact(inboxReasonLabelOf(item.inbox.reason), inboxLineOf(item));
  }
}

export function cardLabelOf(item: AttentionItem): string | null {
  return item.kind === "inbox_item" && !item.inbox.trusted ? "not trusted" : null;
}

export function heldText(count: number): string {
  if (count === 0) return "No node waits";
  return counted(count, "node waits", "nodes wait");
}

export function workforceText(running: number, waiting: number): string {
  return `${counted(running, "execution runs", "executions run")}${FACT_SEPARATOR}${counted(waiting, "job waits", "jobs wait")}`;
}

export interface BoardSummaryInput {
  readonly count: number;
  readonly held: number;
  readonly start: { readonly subject: string; readonly tab: BoardTab } | null;
  readonly readFault: boolean;
  readonly inbox: number;
}

export interface BoardSummary {
  readonly long: string;
}

function emptySummaryTextOf(input: BoardSummaryInput): string {
  if (input.readFault) return "No act found. Some records could not be read.";
  return "No decision waits for you.";
}

export function boardSummaryOf(input: BoardSummaryInput): BoardSummary {
  const { count, held, start } = input;
  if (start === null) return { long: emptySummaryTextOf(input) };
  const acts = counted(count, "act waits", "acts wait");
  const nodes = counted(held, "node waits", "nodes wait");
  const threads =
    input.inbox > 0 ? ` ${counted(input.inbox, "thread waits", "threads wait")} in Inbox.` : "";
  return {
    long: `${acts} for you. ${nodes} on them. Start here: ${start.subject} in ${start.tab.name}.${threads}`,
  };
}

function lowerCauseOf(
  item: Exclude<AttentionItem, { kind: "tool_approval" | "inbox_item" }>,
): string {
  const cause = item.kind === "paused" ? pausedCauseOf(item) : item.cause;
  return cause.toLowerCase();
}

export function detailTitleOf(item: AttentionItem, details: AttentionDetails): string {
  if (item.kind === "tool_approval") return `${item.agent} asks to run ${item.operationId}`;
  if (item.kind === "inbox_item") return item.subject;
  if (item.kind === "credential_refused") return `Provider refuses credential ${item.credential}`;
  if (item.kind === "environment_failed") return `Environment ${item.binding} failed`;
  if (item.kind === "merge_wait") {
    const number = pullRequestNumberOf(item);
    if (number !== null) return `PR #${number} waits for your merge`;
  }
  const title = `${item.subject}: ${lowerCauseOf(item)}`;
  if (item.kind !== "blocked") return title;
  const open = openProposalsReadOf(item, details)?.length ?? 0;
  return open === 0 ? title : `${title}, ${counted(open, "proposal", "proposals")}`;
}
