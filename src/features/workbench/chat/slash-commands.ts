import { YUMI_AGENT } from "@/lib/workbench-sessions";

export type SlashCommandId = "brief" | "health" | "new";

export interface SlashCommand {
  readonly id: SlashCommandId;
  readonly name: string;
  readonly description: string;
  readonly text: string | null;
  readonly agent: string | null;
}

export interface ParsedSlashCommand {
  readonly command: SlashCommandId;
  readonly text: string | null;
}

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    id: "brief",
    name: "/brief",
    description: "Report status and the actions that need you",
    text: "Report the system status and the actions that need me.",
    agent: YUMI_AGENT,
  },
  {
    id: "health",
    name: "/health",
    description: "Check provider health (slow probe)",
    text: "Check the health of the gateway and the providers.",
    agent: YUMI_AGENT,
  },
  {
    id: "new",
    name: "/new",
    description: "New conversation",
    text: null,
    agent: null,
  },
];

const NEW_PATTERN = /^\/new(?:\s+([\s\S]+))?$/;

export function parseSlashCommand(draft: string): ParsedSlashCommand | null {
  const trimmed = draft.trim();
  if (trimmed === "/brief") return { command: "brief", text: null };
  if (trimmed === "/health") return { command: "health", text: null };
  const match = NEW_PATTERN.exec(trimmed);
  if (match === null) return null;
  return { command: "new", text: match[1]?.trim() ?? null };
}

export function isCommandAvailable(command: SlashCommand, agentName: string): boolean {
  return command.agent === null || command.agent === agentName;
}

export function commandListOf(draft: string, agentName: string): readonly SlashCommand[] {
  const shows = draft === "" || (draft.startsWith("/") && !/\s/.test(draft));
  if (!shows) return [];
  return SLASH_COMMANDS.filter(
    (command) => command.name.startsWith(draft) && isCommandAvailable(command, agentName),
  );
}

export function commandOfText(text: string): SlashCommand | null {
  return SLASH_COMMANDS.find((command) => command.text === text) ?? null;
}
