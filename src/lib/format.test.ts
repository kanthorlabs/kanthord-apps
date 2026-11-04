import { describe, expect, it } from "vitest";

import { byteText, durationText, utcDateTime, utcShortDateTime } from "./format";

describe("utcDateTime", () => {
  it("renders a millisecond time as a UTC minute", () => {
    expect(utcDateTime(Date.UTC(2026, 9, 3, 14, 5, 59))).toBe("2026-10-03 14:05 UTC");
  });
});

describe("utcShortDateTime", () => {
  it("renders a millisecond time as a UTC month, day and minute", () => {
    expect(utcShortDateTime(Date.UTC(2026, 9, 3, 14, 5, 59))).toBe("10-03 14:05");
  });
});

describe("durationText", () => {
  it("counts seconds, minutes and hours", () => {
    expect(durationText(45_000)).toBe("45 s");
    expect(durationText(20 * 60_000)).toBe("20 min");
    expect(durationText(3_600_000)).toBe("1 h");
    expect(durationText(3_600_000 + 5 * 60_000)).toBe("1 h 5 min");
  });

  it("counts milliseconds under one second", () => {
    expect(durationText(0)).toBe("0 ms");
    expect(durationText(2)).toBe("2 ms");
    expect(durationText(2.5)).toBe("2.5 ms");
    expect(durationText(2.34)).toBe("2.3 ms");
    expect(durationText(999)).toBe("999 ms");
    expect(durationText(999.96)).toBe("1 s");
    expect(durationText(1_000)).toBe("1 s");
  });

  it("moves a value that rounds up to the next unit", () => {
    expect(durationText(59_999.96)).toBe("1 min");
    expect(durationText(3_599_999.96)).toBe("1 h");
  });

  it("answers zero milliseconds for a negative span", () => {
    expect(durationText(-5)).toBe("0 ms");
  });
});

describe("byteText", () => {
  it("renders a size in KiB under one MiB and in MiB above", () => {
    expect(byteText(61_440)).toBe("60 KiB");
    expect(byteText(65_600)).toBe("64.1 KiB");
    expect(byteText(1_048_575)).toBe("1 MiB");
    expect(byteText(1_048_576)).toBe("1 MiB");
    expect(byteText(33_488_896)).toBe("31.9 MiB");
    expect(byteText(41_943_040)).toBe("40 MiB");
  });

  it("renders a size in GiB and in TiB above", () => {
    expect(byteText(1_073_741_824)).toBe("1 GiB");
    expect(byteText(230_854_492_160)).toBe("215 GiB");
    expect(byteText(1_099_511_627_776)).toBe("1 TiB");
  });
});
