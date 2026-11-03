import { describe, expect, it } from "vitest";

import { lineDiff } from "./line-diff";

describe("lineDiff", () => {
  it("marks each line of two equal texts as the same", () => {
    expect(lineDiff("a\nb", "a\nb")).toEqual([
      { change: "same", text: "a" },
      { change: "same", text: "b" },
    ]);
  });

  it("marks a removed line and an added line around the common lines", () => {
    expect(lineDiff("a\nb\nc", "a\nx\nc\nd")).toEqual([
      { change: "same", text: "a" },
      { change: "removed", text: "b" },
      { change: "added", text: "x" },
      { change: "same", text: "c" },
      { change: "added", text: "d" },
    ]);
  });

  it("marks every line of an empty earlier text as added", () => {
    expect(lineDiff("", "a")).toEqual([
      { change: "removed", text: "" },
      { change: "added", text: "a" },
    ]);
  });
});
