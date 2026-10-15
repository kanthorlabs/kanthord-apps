import { describe, expect, it } from "vitest";

import { nodePath } from "./node-path";

describe("nodePath", () => {
  it("opens the node detail of a project", () => {
    expect(nodePath("prj-1", "node_1")).toBe("/projects/prj-1?node=node_1");
  });

  it("encodes both identities", () => {
    expect(nodePath("a b", "c/d")).toBe("/projects/a%20b?node=c%2Fd");
  });
});
