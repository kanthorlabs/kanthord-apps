import { describe, expect, it } from "vitest";

import { NAV_ITEMS, ROUTE_LABELS } from "./app-nav";

describe("NAV_ITEMS", () => {
  it("names Scheduler once in the Work group", () => {
    const items = NAV_ITEMS.filter((item) => item.to === "/scheduler");

    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ label: "Scheduler", group: "Work" });
  });

  it("names Traces once in the Work group after Scheduler", () => {
    const work = NAV_ITEMS.filter((item) => item.group === "Work").map((item) => item.to);

    expect(NAV_ITEMS.filter((item) => item.to === "/traces")).toHaveLength(1);
    expect(NAV_ITEMS.find((item) => item.to === "/traces")).toMatchObject({ label: "Traces" });
    expect(work.indexOf("/traces")).toBe(work.indexOf("/scheduler") + 1);
  });

  it("names the git credentials Git under Credentials at /repositories", () => {
    const items = NAV_ITEMS.filter((item) => item.group === "Credentials");

    expect(items.map((item) => [item.label, item.to])).toEqual([
      ["LLM", "/llm"],
      ["Git", "/repositories"],
      ["Storage", "/storage"],
    ]);
  });

  it("labels the /repositories breadcrumb Git", () => {
    expect(ROUTE_LABELS.get("/repositories")).toBe("Git");
  });
});
