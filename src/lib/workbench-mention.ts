import type {
  AgentEnablement,
  AgentSummary,
  WorkbenchConfiguration,
  WorkbenchMember,
  WorkbenchSessionEntry,
} from "@/api/types";

export interface Addressee {
  readonly displayName: string;
  readonly member: WorkbenchMember | null;
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

export function mentionSuggestionsOf(draft: string, names: readonly string[]): readonly string[] {
  if (!draft.startsWith("@")) return [];
  const prefix = draft.slice(1).toLowerCase();
  return names.filter((name) => name.toLowerCase().startsWith(prefix));
}

function leadingMentionOf(draft: string, names: readonly string[]): string | null {
  const matches = names.filter(
    (name) => draft.startsWith(`@${name}`) && /^(\s|$)/.test(draft.slice(name.length + 1)),
  );
  return matches.sort((a, b) => b.length - a.length)[0] ?? null;
}

function lastResponderOf(
  members: readonly WorkbenchMember[],
  entries: readonly WorkbenchSessionEntry[],
): WorkbenchMember | null {
  const answer = entries
    .filter((entry) => {
      const message = entry["message"];
      return (
        entry.type === "message" &&
        typeof message === "object" &&
        message !== null &&
        "role" in message &&
        message.role === "assistant"
      );
    })
    .at(-1);
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
    return { displayName: mention, member };
  }
  const responder = lastResponderOf(members, entries);
  return responder === null ? null : { displayName: responder.display_name, member: responder };
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
