import { describe, expect, it } from "vitest";

import { edgePath } from "./edge-path";

describe("edgePath", () => {
  it("joins the bottom of a node to the top of a node in the next row", () => {
    expect(
      edgePath({ x: 0, y: 0, width: 100, height: 50 }, { x: 0, y: 74, width: 100, height: 50 }),
    ).toBe("M 50 50 C 50 62, 50 62, 50 74");
  });

  it("joins the side of a node to the side of a node to its right", () => {
    expect(
      edgePath({ x: 0, y: 0, width: 100, height: 50 }, { x: 140, y: 200, width: 100, height: 50 }),
    ).toBe("M 100 25 C 120 25, 120 225, 140 225");
  });

  it("routes through the left gutter when a node stands far below in the same column", () => {
    expect(
      edgePath({ x: 24, y: 0, width: 100, height: 50 }, { x: 24, y: 300, width: 100, height: 50 }),
    ).toBe("M 24 25 C 12 25, 12 325, 24 325");
  });

  it("keeps the gutter inside the container", () => {
    expect(
      edgePath({ x: 4, y: 300, width: 100, height: 50 }, { x: 4, y: 0, width: 100, height: 50 }),
    ).toBe("M 4 325 C 2 325, 2 25, 4 25");
  });
});
