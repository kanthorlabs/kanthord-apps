import { describe, expect, it } from "vitest";

import { agentLabel } from "./agent-label";

describe("agentLabel", () => {
  it("joins the display name with the agent name", () => {
    expect(agentLabel({ displayName: "Yumi", agentName: "ops@1" })).toBe("Yumi (ops@1)");
  });
});
