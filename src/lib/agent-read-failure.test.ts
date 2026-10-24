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

  it("keeps the message of any other failure", () => {
    const error = new ApiError("not_found", "No such agent.", 404, "agent.catalog.not_found");
    expect(agentReadFailure(error)).toBe("No such agent.");
  });

  it("keeps the message when the details name no file", () => {
    const error = new ApiError("conflict", "Invalid.", 409, "agent.prompt.template_invalid", {});
    expect(agentReadFailure(error)).toBe("Invalid.");
  });
});
