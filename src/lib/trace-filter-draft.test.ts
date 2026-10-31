import { describe, expect, it } from "vitest";

import { millisecondsOf, secondsOf, sheetChangesOf } from "./trace-filter-draft";

describe("millisecondsOf", () => {
  it("converts seconds to milliseconds", () => {
    expect(millisecondsOf("1.5")).toBe("1500");
  });

  it.each(["", " ", "abc", "-1"])("answers null for %j", (text) => {
    expect(millisecondsOf(text)).toBeNull();
  });
});

describe("secondsOf", () => {
  it("converts milliseconds to seconds", () => {
    expect(secondsOf("1500")).toBe("1.5");
  });

  it("answers an empty text for null and for a non-number", () => {
    expect(secondsOf(null)).toBe("");
    expect(secondsOf("abc")).toBe("");
  });
});

describe("sheetChangesOf", () => {
  it("answers every sheet key, with null for an absent key", () => {
    const changes = sheetChangesOf(
      new URLSearchParams("cause_category=model&state=error&min_duration_ms=9"),
      "2",
    );
    expect(changes.cause_category).toBe("model");
    expect(changes.worker_name).toBeNull();
    expect(changes.min_duration_ms).toBe("2000");
    expect(changes).not.toHaveProperty("state");
  });

  it("answers from and to of the draft", () => {
    const changes = sheetChangesOf(new URLSearchParams("from=100&to=200"), "");
    expect(changes.from).toBe("100");
    expect(changes.to).toBe("200");
    expect(sheetChangesOf(new URLSearchParams(), "").from).toBeNull();
  });
});
