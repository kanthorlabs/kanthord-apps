import { describe, expect, it } from "vitest";

import type { TraceSummary } from "@/api/types";

import {
  cacheFacts,
  cacheShareText,
  costText,
  PRICE_LABEL,
  PRICE_NOTE,
  tokenText,
} from "./trace-format";

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

  it("shows the cache read share of the input tokens", () => {
    expect(cacheShareText(tokens(1000, 700, 100))).toBe("70%");
  });

  it("keeps read over input when the cache write is large", () => {
    expect(cacheShareText(tokens(1000, 100, 800))).toBe("10%");
  });

  it("shows 0% when no input token exists", () => {
    expect(cacheShareText(tokens(0, 0, 0))).toBe("0%");
  });
});

describe("cacheFacts", () => {
  it("splits the input into uncached, read and write and answers the hit ratio", () => {
    expect(cacheFacts(1000, 700, 100)).toEqual({
      uncached: 200,
      read: 700,
      write: 100,
      hitRatio: 0.7,
    });
  });

  it("keeps the hit ratio at read over input when the write is large", () => {
    expect(cacheFacts(1000, 100, 800)).toEqual({
      uncached: 100,
      read: 100,
      write: 800,
      hitRatio: 0.1,
    });
  });

  it("clamps the uncached input at 0 and the hit ratio at 1", () => {
    expect(cacheFacts(100, 150, 50)).toEqual({ uncached: 0, read: 150, write: 50, hitRatio: 1 });
  });

  it("answers a hit ratio of 0 when the input is 0", () => {
    expect(cacheFacts(0, 0, 0)).toEqual({ uncached: 0, read: 0, write: 0, hitRatio: 0 });
  });
});

describe("price texts", () => {
  it("names the API price and states what it means", () => {
    expect(PRICE_LABEL).toBe("API price");
    expect(PRICE_NOTE).toBe(
      "API price is the list price of these tokens at the provider. A subscription does not pay this amount.",
    );
  });
});
