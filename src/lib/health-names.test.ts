import { describe, expect, it } from "vitest";

import { healthNameLabel, toolResultText } from "./health-names";

const REPORT = {
  services: {
    project: { global: {}, projects: { "todo-app": { "todo%2Frepo": { status: "healthy" } } } },
  },
  shared: {
    agent: { global: { "swe%401/codex": { status: "healthy" } }, projects: {} },
  },
};

describe("healthNameLabel", () => {
  it("decodes each segment and keeps a segment that is not valid encoding", () => {
    expect(healthNameLabel("swe%401/codex")).toBe("swe@1/codex");
    expect(healthNameLabel("100%/x")).toBe("100%/x");
  });
});

describe("toolResultText", () => {
  it("decodes the resource names of the health report and nothing else", () => {
    expect(JSON.parse(toolResultText("gateway--healthcheck", JSON.stringify(REPORT)))).toEqual({
      services: {
        project: { global: {}, projects: { "todo-app": { "todo/repo": { status: "healthy" } } } },
      },
      shared: { agent: { global: { "swe@1/codex": { status: "healthy" } }, projects: {} } },
    });
  });

  it("keeps the encoded names when two of them decode to the same label", () => {
    const report = { shared: { agent: { global: { "a%2Fb/c": 1, "a/b%2Fc": 2 }, projects: {} } } };
    expect(JSON.parse(toolResultText("gateway--healthcheck", JSON.stringify(report)))).toEqual(
      report,
    );
  });

  it("leaves another tool and a text that is not JSON unchanged", () => {
    const text = JSON.stringify({ "swe%401/codex": 1 });
    expect(toolResultText("mission--node--list", text)).toBe(text);
    expect(toolResultText("gateway--healthcheck", "not json")).toBe("not json");
  });
});
