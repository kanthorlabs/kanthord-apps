import type { AttentionDetails, AttentionItem, OutsideAttentionItem } from "./attention";
import { BOARD_TAB, type BoardTab, boardTabOf, openProposalsReadOf } from "./board-tabs";
import { counted } from "./counted";
import { codeLabel, stopLabel } from "./execution-stop";
import { fixTargetOf } from "./fix-attention";

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
    case "merge_wait":
    case "delivery_unconfirmed": {
      const number = pullRequestNumberOf(item);
      return withFact(item.cause, number === null ? null : `pull request #${number}`);
    }
  }
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
  readonly projectName: string | null;
  readonly readFault: boolean;
}

export interface BoardSummary {
  readonly long: string;
  readonly short: string;
}

function emptySummaryTextOf(input: BoardSummaryInput): string {
  if (input.projectName !== null) return `Nothing waits for you in ${input.projectName}.`;
  if (input.readFault) return "No act found. Some records could not be read.";
  return "No decision waits for you.";
}

export function boardSummaryOf(input: BoardSummaryInput): BoardSummary {
  const { count, held, start, projectName } = input;
  if (start === null) {
    const text = emptySummaryTextOf(input);
    return { long: text, short: text };
  }
  const scope = projectName === null ? "" : ` in ${projectName}`;
  const acts = counted(count, "act waits", "acts wait");
  const nodes = counted(held, "node waits", "nodes wait");
  return {
    long: `${acts} for you${scope}. ${nodes} on them. Start here: ${start.subject} in ${start.tab.name}.`,
    short: `${counted(count, "act", "acts")}${FACT_SEPARATOR}${nodes}${FACT_SEPARATOR}Start: ${start.subject}`,
  };
}

function isAllProjectsTab(tab: BoardTab, allProjects: boolean): boolean {
  return allProjects && tab.id === BOARD_TAB.Tool;
}

export function tabLabelOf(tab: BoardTab, count: number, allProjects: boolean): string {
  const scope = isAllProjectsTab(tab, allProjects) ? ", all projects" : "";
  const clear = count === 0 ? ", clear" : "";
  return `${tab.name}, ${counted(count, "act", "acts")}${scope}${clear}`;
}

export function tabSubOf(tab: BoardTab, held: number, count: number, allProjects: boolean): string {
  const text = count === 0 ? "clear" : heldText(held);
  return isAllProjectsTab(tab, allProjects) ? `all projects${FACT_SEPARATOR}${text}` : text;
}

export function positionText(index: number, total: number): string {
  return `${index + 1} of ${total}`;
}

const GONE_ANNOUNCEMENT = "The selected item no longer waits.";

export interface AnnouncementInput {
  readonly gone: boolean;
  readonly expanded: boolean;
  readonly open: boolean;
  readonly subject: string | null;
  readonly position: number | null;
  readonly total: number;
}

export function announcementOf(input: AnnouncementInput): string {
  if (input.gone) return GONE_ANNOUNCEMENT;
  const { expanded, open, subject, position, total } = input;
  if (expanded || !open || subject === null || position === null) return "";
  return `${subject}, ${positionText(position, total)}.`;
}

export function leadLabelOf(item: AttentionItem, details: AttentionDetails): string | null {
  switch (item.kind) {
    case "paused":
      return "Resume";
    case "blocked":
      return boardTabOf(item, details) === BOARD_TAB.Proposal ? "Decide" : "Unblock";
    case "dependency_discarded":
      return "Remove dependency";
    case "merge_wait":
    case "delivery_unconfirmed":
      return "Check now";
    case "tool_approval":
      return "Open chat";
    case "project_paused":
      return "Resume project";
    default:
      return fixTargetOf(item).label;
  }
}

function lowerCauseOf(item: Exclude<AttentionItem, { kind: "tool_approval" }>): string {
  const cause = item.kind === "paused" ? pausedCauseOf(item) : item.cause;
  return cause.toLowerCase();
}

export function detailTitleOf(item: AttentionItem, details: AttentionDetails): string {
  if (item.kind === "tool_approval") return `${item.agent} asks to run ${item.operationId}`;
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
