import { describe, expect, it } from "vitest";

import { NAV_ITEMS, ROUTE_LABELS } from "./app-nav";

describe("NAV_ITEMS", () => {
  it("names Scheduler once in the Work group", () => {
    const items = NAV_ITEMS.filter((item) => item.to === "/scheduler");

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ label: "Scheduler", group: "Work" });
  });

  it("holds no Executions item", () => {
    expect(NAV_ITEMS.some((item) => item.label === "Executions")).toBe(false);
    expect(NAV_ITEMS.some((item) => item.to === "/executions")).toBe(false);
    expect(ROUTE_LABELS.has("/executions")).toBe(false);
  });
});
