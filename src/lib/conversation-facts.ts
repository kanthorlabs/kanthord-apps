import type { ConversationBindingConfig, LinkTrust } from "@/api/types";

export interface ConversationFact {
  readonly label: string;
  readonly value: string;
}

export function trustedActorsText(linkTrust: LinkTrust): string {
  return linkTrust.actor_ids.length === 0 ? "none" : linkTrust.actor_ids.join(", ");
}

export function conversationTargetOf(config: ConversationBindingConfig): string {
  if (config.platform === "github") return config.repository ?? "";
  if (config.platform === "jira") {
    return [config.site, config.project_key].filter((part) => part !== undefined).join(" · ");
  }
  return config.team_id ?? "";
}

export function conversationFactsOf(
  config: ConversationBindingConfig,
): readonly ConversationFact[] {
  return [
    { label: "State", value: config.available ? "Available" : "Unavailable" },
    { label: "Platform", value: config.platform },
    { label: "Target", value: conversationTargetOf(config) },
    { label: "Credential", value: config.credential },
    ...(config.reply_policy === undefined
      ? []
      : [{ label: "Reply policy", value: `follows ${config.reply_policy.follows.type}` }]),
    ...(config.link_trust === undefined
      ? []
      : [{ label: "Trusted actors", value: trustedActorsText(config.link_trust) }]),
    ...(config.inbox === undefined
      ? []
      : [{ label: "Inbox", value: `${config.inbox.handle} (${config.inbox.actor_id})` }]),
  ];
}
