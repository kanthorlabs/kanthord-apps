import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { FlowRead } from "@/api/types";
import { unattributedOf } from "@/lib/flow-causes";
import { frameOf } from "@/lib/flow-status";

import { textContent } from "../../../../test/text-content";
import flowRead from "../../../../test/flow-read.json";
import { UnattributedPanel } from "./unattributed-panel";

const FLOW_READ = flowRead as unknown as FlowRead;

function renderPanel(read: FlowRead = FLOW_READ) {
  return render(
    <MemoryRouter>
      <UnattributedPanel model={unattributedOf(read, frameOf(read, "7d"))} />
    </MemoryRouter>,
  );
}

describe("UnattributedPanel", () => {
  it("reads the label, the share with the bad icon and the comparison", () => {
    renderPanel();

    expect(screen.getByRole("heading", { name: "Unattributed" })).toBeInTheDocument();
    expect(screen.getByText(textContent("✕ 43.1 %"))).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Unattributed status bad" })).toBeInTheDocument();
    expect(screen.getByText("▲ from 39 % · warn 25 % · bad 40 %")).toBeInTheDocument();
  });

  it("names the daily series with its range and the bad line", () => {
    renderPanel();

    expect(
      screen.getByRole("img", {
        name: "Daily unattributed share from 38 % to 47 %, bad line 40 %",
      }),
    ).toBeInTheDocument();
  });

  it("reads the counts and the manual labels", () => {
    renderPanel();

    expect(screen.getByText("81 of 188 caused")).toBeInTheDocument();
    expect(screen.getByText("Manual labels: 8 of 188 (4 %)")).toBeInTheDocument();
  });

  it("links the label action to the unattributed traces of the window", () => {
    renderPanel();

    expect(screen.getByRole("link", { name: "Label unattributed traces →" })).toHaveAttribute(
      "href",
      "/traces?cause_category=unattributed&sort=cost_usd&from=1792800000000&to=1793369520000",
    );
  });

  it("shows no icon when the share is below the warn bound", () => {
    const read = {
      ...FLOW_READ,
      causes: {
        ...FLOW_READ.causes,
        rows: FLOW_READ.causes.rows.filter((row) => row.category !== "unattributed"),
      },
    };
    renderPanel(read);

    expect(screen.queryByRole("img", { name: /status/ })).toBeNull();
    expect(screen.getByText("0.0 %")).toBeInTheDocument();
  });
});
