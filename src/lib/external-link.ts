import type { ExternalLink } from "@/api/types";

export interface ExternalLinkView {
  readonly text: string;
  readonly href: string | null;
}

const GITHUB_REPOSITORY = /^conversation:github:([^/\s]+\/[^/\s]+)$/;

export function externalLinkOf(link: ExternalLink): ExternalLinkView {
  if (link.kind === "jira_issue") return { text: `Jira issue ${link.key}`, href: null };
  if (link.kind === "slack_thread") {
    return { text: `Slack thread ${link.thread_ts} in ${link.channel}`, href: null };
  }
  const repository = GITHUB_REPOSITORY.exec(link.resource_identity)?.[1];
  if (repository === undefined) return { text: `GitHub issue ${link.number}`, href: null };
  return {
    text: `${repository}#${link.number}`,
    href: `https://github.com/${repository}/issues/${link.number}`,
  };
}
