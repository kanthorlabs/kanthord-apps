import {
  type AgentEnablement,
  type AgentSummary,
  type AgentVariantItem,
  WORKBENCH_PLAN_ENTRY,
  type WorkbenchConfiguration,
  type WorkbenchMember,
  type WorkbenchSessionEntry,
} from "@/api/types";
import { variantLabel } from "@/lib/agent-variant";

export interface Addressee {
  readonly displayName: string;
  readonly member: WorkbenchMember | null;
  readonly source: "mention" | "last-answer";
}

export interface ConfigurationTarget {
  readonly sessionId: string | null;
  readonly agentName: string;
  readonly configuration: WorkbenchConfiguration;
  readonly enablement: AgentEnablement | null;
}

export function mentionAgentsOf(agents: readonly AgentSummary[]): readonly AgentSummary[] {
  return agents.filter(
    (agent) => agent.enablement?.state === "enabled" && agent.consumers.includes("workbench"),
  );
}

export interface MentionOption {
  readonly name: string;
  readonly label: string;
}

export function mentionOptionsOf(
  agents: readonly AgentSummary[],
  variants: readonly AgentVariantItem[],
): readonly MentionOption[] {
  return agents.flatMap((agent) => [
    { name: agent.displayName, label: agent.displayName },
    ...variants
      .filter((variant) => variant.agent_name === agent.agentName)
      .map((variant) => ({ name: variant.display_name, label: variantLabel(variant, agent) })),
  ]);
}

export function mentionSuggestionsOf(draft: string, names: readonly string[]): readonly string[] {
  if (!draft.startsWith("@")) return [];
  const prefix = draft.slice(1).toLowerCase();
  return names.filter((name) => name.toLowerCase().startsWith(prefix));
}

const NAME_CHARACTER = /[A-Za-z0-9 _-]/;

export function leadingMentionOf(draft: string, names: readonly string[]): string | null {
  if (!draft.startsWith("@")) return null;
  const text = draft.slice(1).toLowerCase();
  const byLength = [...names].sort((a, b) => b.length - a.length);
  return (
    byLength.find((name) => {
      const lowered = name.toLowerCase();
      if (!text.startsWith(lowered)) return false;
      const next = text.charAt(lowered.length);
      return next === "" || /\s/.test(next) || !NAME_CHARACTER.test(next);
    }) ?? null
  );
}

function isPlanEntry(entry: WorkbenchSessionEntry): boolean {
  return entry.type === "custom_message" && entry["customType"] === WORKBENCH_PLAN_ENTRY;
}

function isAssistantStop(entry: WorkbenchSessionEntry): boolean {
  const message = entry["message"];
  return (
    entry.type === "message" &&
    typeof message === "object" &&
    message !== null &&
    "role" in message &&
    message.role === "assistant" &&
    "stopReason" in message &&
    message.stopReason === "stop"
  );
}

function isFinalAnswer(entry: WorkbenchSessionEntry): boolean {
  if (entry.phase !== undefined) return false;
  return isPlanEntry(entry) || isAssistantStop(entry);
}

function lastResponderOf(
  members: readonly WorkbenchMember[],
  entries: readonly WorkbenchSessionEntry[],
): WorkbenchMember | null {
  const answer = entries.filter(isFinalAnswer).at(-1);
  const responder = members.find((member) => member.session_id === answer?.session_id);
  return responder ?? members[0] ?? null;
}

export function addresseeOf(
  draft: string,
  members: readonly WorkbenchMember[],
  entries: readonly WorkbenchSessionEntry[],
  names: readonly string[],
): Addressee | null {
  const memberNames = members.map((member) => member.display_name);
  const mention = leadingMentionOf(draft, [...memberNames, ...names]);
  if (mention !== null) {
    const member = members.find((candidate) => candidate.display_name === mention) ?? null;
    return { displayName: mention, member, source: "mention" };
  }
  const responder = lastResponderOf(members, entries);
  return responder === null
    ? null
    : { displayName: responder.display_name, member: responder, source: "last-answer" };
}

export function configurationTargetOf(
  addressee: Addressee | null,
  host: {
    readonly sessionId: string;
    readonly agentName: string;
    readonly configuration: WorkbenchConfiguration;
    readonly enablement: AgentEnablement | null;
  },
  agents: readonly AgentSummary[],
): ConfigurationTarget | null {
  if (addressee === null || addressee.member?.session_id === host.sessionId) return host;
  const summary =
    addressee.member === null
      ? agents.find((agent) => agent.displayName === addressee.displayName)
      : agents.find((agent) => agent.agentName === addressee.member?.agent_name);
  const enablement = summary?.enablement ?? null;
  if (summary === undefined || enablement === null) return null;
  return {
    sessionId: addressee.member?.session_id ?? null,
    agentName: summary.agentName,
    configuration: enablement.default_configuration,
    enablement,
  };
}
