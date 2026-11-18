import { describe, expect, it } from "vitest";

import type { WorkbenchNoticeNode, WorkbenchNoticeProject } from "@/api/types";
import { noticeHeader, noticeStats } from "./workbench-notice";

function node(id: string, state: WorkbenchNoticeNode["state"]): WorkbenchNoticeNode {
  return { node_id: id, name: `Node ${id}`, state, ended_at: 1_700_000_000_000 };
}

function project(nodes: readonly WorkbenchNoticeNode[]): WorkbenchNoticeProject {
  return { project_id: "project_1", name: "shop", nodes };
}

describe("noticeHeader", () => {
  it("lists Completed before Discarded", () => {
    const shop = project([node("a", "Discarded"), node("b", "Completed"), node("c", "Completed")]);
    expect(noticeHeader(shop)).toBe("shop · 2 Completed, 1 Discarded");
  });

  it("leaves out a state with a count of zero", () => {
    const shop = project([node("a", "Completed"), node("b", "Completed"), node("c", "Completed")]);
    expect(noticeHeader(shop)).toBe("shop · 3 Completed");
  });
});

describe("noticeStats", () => {
  it("answers one Discarded", () => {
    expect(noticeStats(project([node("a", "Discarded")]))).toBe("1 Discarded");
  });
});
