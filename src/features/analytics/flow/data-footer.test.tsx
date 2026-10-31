import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { FlowRead } from "@/api/types";

import flowRead from "../../../../test/flow-read.json";
import { DataFooter } from "./data-footer";

const FLOW_READ = flowRead as unknown as FlowRead;

function renderFooter(read: FlowRead = FLOW_READ) {
  return render(
    <MemoryRouter>
      <DataFooter read={read} filters={{ range: "7d" }} />
    </MemoryRouter>,
  );
}

function withoutAwaiting(): FlowRead {
  return { ...FLOW_READ, completeness: { ...FLOW_READ.completeness, awaiting_ingestion: [] } };
}

describe("DataFooter", () => {
  it("is a definition list that takes the anchor flow-data and a programmatic focus", () => {
    const { container } = renderFooter();
    const list = container.querySelector("dl");

    expect(list).toHaveAttribute("id", "flow-data");
    expect(list).toHaveAttribute("tabindex", "-1");
  });

  it("reads the completeness group", () => {
    const { container } = renderFooter();
    const text = container.textContent;

    expect(text).toContain("Completeness 98.4 %");
    expect(text).toContain("no root 2");
    expect(text).toContain("exit unknown 0");
    expect(text).toContain("awaiting ingestion 9 →");
  });

  it("reads the open and late groups", () => {
    const { container } = renderFooter();

    expect(container.textContent).toContain("open 11");
    expect(container.textContent).toContain("late records 1,412");
  });

  it("states the counting rule", () => {
    renderFooter();

    expect(
      screen.getByText(
        "counted on claim day (UTC); Traces counts by overlap, so a drill count can differ · ◔ partial day · drops not shown",
      ),
    ).toBeInTheDocument();
  });

  it("links the awaiting count to the traces of the window with a warning", () => {
    renderFooter();

    expect(screen.getByRole("link", { name: "9 →" })).toHaveAttribute(
      "href",
      "/traces?state=ok&from=1792800000000&to=1793369520000",
    );
    expect(screen.getByRole("img", { name: "warning" })).toBeInTheDocument();
  });

  it("shows the awaiting count without link or warning when nothing awaits", () => {
    renderFooter(withoutAwaiting());

    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.queryByRole("img", { name: "warning" })).toBeNull();
  });
});
