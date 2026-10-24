import { describe, expect, it } from "vitest";

import { ApiError } from "@/api/errors";
import { agentReadFailure } from "./agent-read-failure";

describe("agentReadFailure", () => {
  it("names the file, the reason and the path of an invalid prompt file", () => {
    const error = new ApiError(
      "conflict",
      "Prompt file swe@1.md is invalid: too_large",
      409,
      "agent.prompt.template_invalid",
      { file: "swe@1.md", path: "/data/agents/swe@1.md", reason: "too_large" },
    );
    expect(agentReadFailure(error)).toBe(
      "The prompt file swe@1.md is invalid: it is larger than 32768 bytes. Path: /data/agents/swe@1.md. Fix or remove the file on the server host, then retry.",
    );
  });

  it("adds the parser message for a template syntax error", () => {
    const error = new ApiError(
      "conflict",
      "Prompt template work is invalid: Parse error on line 3\n  Expecting ID\n",
      409,
      "agent.prompt.template_invalid",
      {
        template: "work",
        file: "prompts/work.md",
        path: "/data/agents/prompts/work.md",
        reason: "syntax",
      },
    );
    expect(agentReadFailure(error)).toBe(
      "The prompt file prompts/work.md is invalid: it holds a template syntax error. Parse error on line 3 Expecting ID. Path: /data/agents/prompts/work.md. Fix or remove the file on the server host, then retry.",
    );
  });

  it("keeps the message of any other failure", () => {
    const error = new ApiError("not_found", "No such agent.", 404, "agent.catalog.not_found");
    expect(agentReadFailure(error)).toBe("No such agent.");
  });

  it("keeps the message when the details name no file", () => {
    const error = new ApiError("conflict", "Invalid.", 409, "agent.prompt.template_invalid", {});
    expect(agentReadFailure(error)).toBe("Invalid.");
  });
});
