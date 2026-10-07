import { describe, expect, it } from "vitest";

import type { PromptSource } from "@/api/types";
import { promptSourceTitle } from "./prompt-source-title";

const SOURCE: PromptSource = {
  source: "host_file",
  origin: "file",
  path: null,
  enabled: true,
  state: "absent",
  digest: null,
  text: null,
};

describe("promptSourceTitle", () => {
  it("names a file source by its path", () => {
    expect(promptSourceTitle("system", { ...SOURCE, path: "~/.claude/CLAUDE.md" })).toBe(
      "~/.claude/CLAUDE.md",
    );
  });

  it("names a source without a path by the title of its layer and key", () => {
    expect(promptSourceTitle("system", SOURCE)).toBe("Host agent file");
    expect(promptSourceTitle("agent", { ...SOURCE, source: "custom", origin: "database" })).toBe(
      "Custom agent prompt",
    );
    expect(promptSourceTitle("working", { ...SOURCE, source: "agents_md" })).toBe("AGENTS.md");
  });

  it("falls back to the source key", () => {
    expect(promptSourceTitle("agent", { ...SOURCE, source: "unknown" })).toBe("unknown");
  });
});
