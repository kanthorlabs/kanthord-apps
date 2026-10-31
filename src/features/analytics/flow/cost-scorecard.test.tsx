import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { FlowRead } from "@/api/types";

import flowRead from "../../../../test/flow-read.json";
import { CostScorecard, CostSkeleton } from "./cost-scorecard";

const FLOW_READ = flowRead as unknown as FlowRead;
const FILTERS = { range: "7d", split: "model" } as const;
const QUALIFIER =
  "vs Oct 17 – Oct 23 to the same hour · cost: list-price estimate, excludes 9.5 % unpriced tokens";

function Probe() {
  const location = useLocation();
  return <p>{`at ${location.search}`}</p>;
}

function mount(read: FlowRead = FLOW_READ) {
  return render(
    <MemoryRouter initialEntries={["/analytics?tab=cost"]}>
      <CostScorecard read={read} filters={FILTERS} />
      <Probe />
    </MemoryRouter>,
  );
}

describe("CostScorecard", () => {
  it("shows the heading with the qualifier", () => {
    mount();

    expect(screen.getByRole("heading", { name: "Cost and tokens" })).toBeInTheDocument();
    expect(screen.getByText(QUALIFIER)).toBeInTheDocument();
  });

  it("shows no separate estimate badge", () => {
    mount();

    expect(screen.queryByText(/^estimate$/i)).toBeNull();
  });

  it("drops the same-hour part of the qualifier with null same-hour sums", () => {
    mount({
      ...FLOW_READ,
      cost: { ...FLOW_READ.cost, previous_same_hour: null },
      usage: { ...FLOW_READ.usage, previous_same_hour: null },
    });

    expect(screen.getByText("vs Oct 17 – Oct 23")).toBeInTheDocument();
  });

  it("says that no aggregates exist with a null previous window", () => {
    mount({ ...FLOW_READ, previous_window: null });

    expect(screen.getByText("no comparison: no aggregates")).toBeInTheDocument();
  });

  it("holds four tiles in each of the rows Cost and Tokens", () => {
    mount();

    for (const name of ["Cost tiles", "Tokens tiles"]) {
      const row = screen.getByRole("list", { name });
      expect(within(row).getAllByRole("link")).toHaveLength(4);
      expect(row).toHaveClass("grid-cols-2", "md:grid-cols-4");
    }
  });

  it("reads the eight tiles", () => {
    mount();

    const expected = [
      ["Total cost", "$413", "+18 %"],
      ["Cost per success", "$2.26", "+9.9 %"],
      ["Leaked cost share", "10.9 %", "+2.4 pp"],
      ["Rejected review cost", "$22.50", "+52 %"],
      ["Total tokens", "655 M", "+13 %"],
      ["Tokens per success", "3.58 M", "+5.2 %"],
      ["Cache hit ratio", "68.5 %", "−3.5 pp"],
      ["Unpriced tokens", "9.5 %", "+0.7 pp"],
    ] as const;
    for (const [label, value, delta] of expected) {
      const tile = screen.getByRole("link", { name: new RegExp(`^${label}`) });
      expect(within(tile).getByText(value)).toBeInTheDocument();
      expect(within(tile).getByText(delta)).toBeInTheDocument();
    }
  });

  it("links each tile to its target", () => {
    mount();

    const hrefs = screen.getAllByRole("link").map((link) => link.getAttribute("href"));
    expect(hrefs.filter((href) => href?.startsWith("/traces?"))).toHaveLength(8 + 3);
    expect(screen.getByRole("link", { name: /Cache hit ratio/ })).toHaveAttribute(
      "href",
      expect.stringContaining("model=gpt-5-codex"),
    );
  });

  it("shows the bad icon of the cache hit tile", () => {
    mount();

    expect(screen.getByRole("img", { name: "Cache hit ratio status bad" })).toBeInTheDocument();
  });

  it("shows the split table below the tiles", () => {
    mount();

    expect(screen.getByRole("table", { name: "Cost by model" })).toBeInTheDocument();
  });

  it("writes the split with the toggle group Split by", async () => {
    const user = userEvent.setup();
    mount();

    const group = screen.getByRole("group", { name: "Split by" });
    await user.click(within(group).getByRole("button", { name: "Project" }));

    expect(screen.getByText("at ?tab=cost&split=project_id")).toBeInTheDocument();
  });

  it("shows a notice in place of the token row and the split table with no turn", () => {
    mount({
      ...FLOW_READ,
      usage: { ...FLOW_READ.usage, current: { ...FLOW_READ.usage.current, turn_count: 0 } },
    });

    expect(screen.getByText("No LLM turns in this range.")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Cost tiles" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Tokens tiles" })).toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("CostSkeleton", () => {
  it("shows eight tiles in the grid of the scorecard", () => {
    render(<CostSkeleton />);

    const status = screen.getByRole("status", { name: "Loading the cost" });
    const list = within(status).getByRole("list");
    expect(within(list).getAllByRole("listitem")).toHaveLength(8);
    expect(list).toHaveClass("grid-cols-2", "md:grid-cols-4");
  });
});
