import { describe, expect, it } from "vitest";

import { BOARD_WIDTH, boardWidthClassOf } from "./board-width";

describe("boardWidthClassOf", () => {
  it.each([
    [0, BOARD_WIDTH.Compact],
    [390, BOARD_WIDTH.Compact],
    [599, BOARD_WIDTH.Compact],
    [600, BOARD_WIDTH.Medium],
    [959, BOARD_WIDTH.Medium],
    [960, BOARD_WIDTH.Expanded],
    [1280, BOARD_WIDTH.Expanded],
  ])("answers the class of %i px", (width, expected) => {
    expect(boardWidthClassOf(width)).toBe(expected);
  });

  it("names the classes", () => {
    expect(BOARD_WIDTH).toEqual({ Compact: "compact", Medium: "medium", Expanded: "expanded" });
  });
});
