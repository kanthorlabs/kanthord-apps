import { describe, expect, it } from "vitest";

import { costText, tokenText } from "./trace-format";

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
