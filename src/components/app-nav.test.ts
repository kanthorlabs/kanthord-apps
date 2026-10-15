import { describe, expect, it } from "vitest";

import { NAV_ITEMS } from "./app-nav";

describe("NAV_ITEMS", () => {
  it("names Scheduler once in the Work group", () => {
    const items = NAV_ITEMS.filter((item) => item.to === "/scheduler");

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ label: "Scheduler", group: "Work" });
  });
});
