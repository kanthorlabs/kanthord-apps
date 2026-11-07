import type {
  ExternalLink,
  MissionNodeRecord,
  MissionNodeUpdate,
  MissionRevision,
} from "@/api/types";

import { isTerminal } from "./node-state";

export function linkableNodesOf(nodes: readonly MissionNodeRecord[]): readonly MissionNodeRecord[] {
  return nodes.filter((node) => node.retired_at === null && !isTerminal(node.state));
}

function sameLink(left: ExternalLink, right: ExternalLink): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function withLink(
  links: readonly ExternalLink[] | undefined,
  link: ExternalLink,
): readonly ExternalLink[] {
  const current = links ?? [];
  return current.some((entry) => sameLink(entry, link)) ? current : [...current, link];
}

function withBinding(bindings: readonly string[], binding: string): readonly string[] {
  return bindings.includes(binding) ? bindings : [...bindings, binding];
}

export function nodeLinkUpdateOf(
  revision: MissionRevision,
  link: ExternalLink,
  binding: string,
  missionVersion: number,
  reason: string,
): MissionNodeUpdate {
  return {
    expected_mission_version: missionVersion,
    content: {
      ...revision.content,
      bindings: withBinding(revision.content.bindings, binding),
      external_links: withLink(revision.content.external_links, link),
    },
    tasks: revision.tasks,
    reason,
  };
}
