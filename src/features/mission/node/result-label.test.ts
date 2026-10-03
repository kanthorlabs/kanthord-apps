import { describe, expect, it } from "vitest";

import { assertedResult, verdictResult } from "./result-label";

describe("result-label", () => {
  it("names an assessment verdict with the CLI result vocabulary", () => {
    expect(verdictResult("meets")).toBe("success");
    expect(verdictResult("does not meet")).toBe("criterion-not-met");
    expect(verdictResult("neither established")).toBe("undetermined");
  });

  it("names an outcome result with the CLI result vocabulary", () => {
    expect(assertedResult("success")).toBe("success");
    expect(assertedResult("criteria not met")).toBe("criterion-not-met");
    expect(assertedResult("nothing established")).toBe("undetermined");
  });
});
