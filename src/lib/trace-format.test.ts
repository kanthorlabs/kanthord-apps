import { describe, expect, it } from "vitest";

import type { TraceSummary } from "@/api/types";

import { cacheShareText, costText, tokenText } from "./trace-format";

describe("tokenText", () => {
  it("shows the integer below 1000", () => {
    expect(tokenText(0)).toBe("0");
    expect(tokenText(950)).toBe("950");
    expect(tokenText(999)).toBe("999");
  });

  it("shows one decimal and k below 1000000", () => {
    expect(tokenText(1000)).toBe("1.0k");
    expect(tokenText(12345)).toBe("12.3k");
  });

  it("shows one decimal and M from 1000000", () => {
    expect(tokenText(1000000)).toBe("1.0M");
    expect(tokenText(1234567)).toBe("1.2M");
  });
});

describe("costText", () => {
  it("shows $0 for 0", () => {
    expect(costText(0)).toBe("$0");
  });

  it("shows four decimals below 1 dollar", () => {
    expect(costText(0.01234)).toBe("$0.0123");
    expect(costText(0.99999)).toBe("$1.0000");
  });

  it("shows two decimals from 1 dollar", () => {
    expect(costText(1)).toBe("$1.00");
    expect(costText(4.5612)).toBe("$4.56");
  });
});

describe("cacheShareText", () => {
  function tokens(input: number, read: number, creation: number): TraceSummary {
    return {
      input_tokens: input,
      cache_read_tokens: read,
      cache_creation_tokens: creation,
    } as TraceSummary;
  }

  it("shows the cache read share of all input tokens", () => {
    expect(cacheShareText(tokens(200, 700, 100))).toBe("70%");
  });

  it("shows 0% when no input token exists", () => {
    expect(cacheShareText(tokens(0, 0, 0))).toBe("0%");
  });
});
