import { describe, expect, it } from "vitest";

import { commandListOf, parseSlashCommand, SLASH_COMMANDS } from "./slash-commands";

const names = (draft: string, agent: string) =>
  commandListOf(draft, agent).map((command) => command.name);

describe("SLASH_COMMANDS", () => {
  it("holds the three commands with their fixed texts", () => {
    expect(
      SLASH_COMMANDS.map(({ name, description, text }) => ({ name, description, text })),
    ).toEqual([
      {
        name: "/brief",
        description: "Report status and the actions that need you",
        text: "Report the system status and the actions that need me.",
      },
      {
        name: "/health",
        description: "Check provider health (slow probe)",
        text: "Check the health of the gateway and the providers.",
      },
      { name: "/new", description: "New conversation", text: null },
    ]);
  });
});

describe("parseSlashCommand", () => {
  it("reads /new alone", () => {
    expect(parseSlashCommand("/new")).toEqual({ command: "new", text: null });
  });

  it("reads the trimmed rest of /new", () => {
    expect(parseSlashCommand("/new  next step")).toEqual({ command: "new", text: "next step" });
  });

  it("reads a blank rest of /new as no text", () => {
    expect(parseSlashCommand("/new   ")).toEqual({ command: "new", text: null });
  });

  it("reads /newx as plain text", () => {
    expect(parseSlashCommand("/newx")).toBeNull();
  });

  it("reads /brief and /health when the trimmed draft equals them", () => {
    expect(parseSlashCommand("/brief")).toEqual({ command: "brief", text: null });
    expect(parseSlashCommand(" /health ")).toEqual({ command: "health", text: null });
  });

  it("reads a longer draft of /brief and /health as plain text", () => {
    expect(parseSlashCommand("/brief now")).toBeNull();
    expect(parseSlashCommand("/briefx")).toBeNull();
    expect(parseSlashCommand("/health x")).toBeNull();
  });

  it("reads a draft with no known command as plain text", () => {
    expect(parseSlashCommand("hello")).toBeNull();
  });
});

describe("commandListOf", () => {
  it("lists three commands for an empty draft and ops@1", () => {
    expect(names("", "ops@1")).toEqual(["/brief", "/health", "/new"]);
  });

  it("lists /new only for an empty draft and swe@1", () => {
    expect(names("", "swe@1")).toEqual(["/new"]);
  });

  it("lists the commands whose name starts with the draft", () => {
    expect(names("/b", "ops@1")).toEqual(["/brief"]);
    expect(names("/", "swe@1")).toEqual(["/new"]);
  });

  it("lists nothing for a draft with whitespace or without a slash", () => {
    expect(names("/brief now", "ops@1")).toEqual([]);
    expect(names("hello", "ops@1")).toEqual([]);
  });
});
