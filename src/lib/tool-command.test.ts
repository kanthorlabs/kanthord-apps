import { describe, expect, it } from "vitest";

import { commandLineOf } from "./tool-command";

describe("commandLineOf", () => {
  it("answers the first line of a multi-line command", () => {
    expect(commandLineOf({ command: "git status\nls\npwd" })).toBe("git status");
  });

  it("answers the command of a single line", () => {
    expect(commandLineOf({ command: "ls -la" })).toBe("ls -la");
  });

  it("answers null when the arguments hold no string command", () => {
    expect(commandLineOf({ command: 3 })).toBeNull();
    expect(commandLineOf({ path: "a" })).toBeNull();
    expect(commandLineOf("ls")).toBeNull();
    expect(commandLineOf(null)).toBeNull();
  });
});
