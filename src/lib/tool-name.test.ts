import { describe, expect, it } from "vitest";

import { toolNameOf } from "./tool-name";

describe("toolNameOf", () => {
  it("replaces every dot of an operation id with two dashes", () => {
    expect(toolNameOf("mission.node.pause")).toBe("mission--node--pause");
  });
});
