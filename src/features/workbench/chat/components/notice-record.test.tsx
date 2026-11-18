import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type {
  WorkbenchNoticeNode,
  WorkbenchNoticeProject,
  WorkbenchNoticeRecord,
} from "@/api/types";
import { NoticeRecord } from "./notice-record";

const ENDED_AT = Date.UTC(2026, 10, 11, 14, 5);
const ENDED_TEXT = "2026-11-11 14:05 UTC";

function node(id: string, state: WorkbenchNoticeNode["state"], name = `Node ${id}`) {
  return { node_id: id, name, state, ended_at: ENDED_AT } satisfies WorkbenchNoticeNode;
}

function notice(...projects: readonly WorkbenchNoticeProject[]): WorkbenchNoticeRecord {
  return { kind: "notice", watch_entry_id: "watch_1", projects };
}

function renderNotice(record: WorkbenchNoticeRecord) {
  return render(
    <MemoryRouter>
      <NoticeRecord notice={record} />
    </MemoryRouter>,
  );
}

describe("NoticeRecord", () => {
  it("shows the header, one row per node and the Open project link", () => {
    renderNotice(
      notice({
        project_id: "project_1",
        name: "shop",
        nodes: [node("a", "Completed"), node("b", "Completed"), node("c", "Discarded")],
      }),
    );

    const block = screen.getByRole("group", { name: "shop · 2 Completed, 1 Discarded" });
    const rows = within(block).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent("Node a");
    expect(rows[0]).toHaveTextContent("Completed");
    expect(rows[0]).toHaveTextContent(ENDED_TEXT);
    expect(rows[2]).toHaveTextContent("Node c");
    expect(rows[2]).toHaveTextContent("Discarded");
    expect(within(block).getByRole("link", { name: "Open project" })).toHaveAttribute(
      "href",
      "/projects/project_1",
    );
  });

  it("leaves out a state with a count of zero", () => {
    renderNotice(
      notice({
        project_id: "project_1",
        name: "shop",
        nodes: [node("a", "Completed"), node("b", "Completed"), node("c", "Completed")],
      }),
    );

    expect(screen.getByText("shop · 3 Completed")).toBeInTheDocument();
  });

  it("shows two headers, each with its own Open project link", () => {
    renderNotice(
      notice(
        { project_id: "project_1", name: "shop", nodes: [node("a", "Completed")] },
        { project_id: "project_2", name: "blog", nodes: [node("b", "Discarded")] },
      ),
    );

    const shop = screen.getByRole("group", { name: "shop · 1 Completed" });
    const blog = screen.getByRole("group", { name: "blog · 1 Discarded" });
    expect(within(shop).getByRole("link", { name: "Open project" })).toHaveAttribute(
      "href",
      "/projects/project_1",
    );
    expect(within(blog).getByRole("link", { name: "Open project" })).toHaveAttribute(
      "href",
      "/projects/project_2",
    );
  });

  it("renders a node name as literal text", () => {
    renderNotice(
      notice({
        project_id: "project_1",
        name: "shop",
        nodes: [node("a", "Completed", "**x**")],
      }),
    );

    expect(screen.getByText("**x**")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "**x**" })).not.toBeInTheDocument();
  });

  it("shows no Open project link for a block with no project_id", () => {
    renderNotice(notice({ name: "shop", nodes: [node("a", "Completed")] }));

    expect(screen.getByText("shop · 1 Completed")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Open project" })).not.toBeInTheDocument();
  });
});
