import type { PromptLayerKind, PromptSource } from "@/api/types";

const SOURCE_TITLES: Readonly<Record<PromptLayerKind, Readonly<Record<string, string>>>> = {
  system: {
    host_file: "Host agent file",
    base: "Shipped base prompt",
    custom: "Custom system prompt",
  },
  agent: {
    agent_file: "Agent file",
    shipped: "Shipped agent prompt",
    custom: "Custom agent prompt",
  },
  working: {
    agents_md: "AGENTS.md",
    agents_local_md: "AGENTS.local.md",
    claude_md: "CLAUDE.md",
    claude_local_md: "CLAUDE.local.md",
    shipped: "Shipped working prompt",
    custom: "Custom working prompt",
  },
};

export function promptSourceTitle(layer: PromptLayerKind, source: PromptSource): string {
  return source.path ?? SOURCE_TITLES[layer][source.source] ?? source.source;
}
