import { describe, expect, it } from "vitest";

import { counted } from "./counted";

describe("counted", () => {
  it("uses the singular noun for one", () => {
    expect(counted(1, "node", "nodes")).toBe("1 node");
  });

  it("uses the plural noun for zero and for more than one", () => {
    expect(counted(0, "node", "nodes")).toBe("0 nodes");
    expect(counted(2, "node", "nodes")).toBe("2 nodes");
  });
});
