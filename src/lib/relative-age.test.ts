import { describe, expect, it } from "vitest";

import { relativeAge } from "./relative-age";

const NOW = 1_760_000_000_000;

describe("relativeAge", () => {
  it("answers just now below one minute and for a future time", () => {
    expect(relativeAge(NOW - 59_999, NOW)).toBe("just now");
    expect(relativeAge(NOW + 5_000, NOW)).toBe("just now");
  });

  it("counts minutes, hours and days with a singular unit for one", () => {
    expect(relativeAge(NOW - 60_000, NOW)).toBe("1 minute ago");
    expect(relativeAge(NOW - 120_000, NOW)).toBe("2 minutes ago");
    expect(relativeAge(NOW - 3_600_000, NOW)).toBe("1 hour ago");
    expect(relativeAge(NOW - 5 * 3_600_000, NOW)).toBe("5 hours ago");
    expect(relativeAge(NOW - 2 * 86_400_000, NOW)).toBe("2 days ago");
  });
});
