import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import type { FlowDayCell, FlowDayStrip } from "@/lib/flow-stages";

import { DayAxis, DayStrip } from "./day-strip";

function cellOf(day: string, patch: Partial<FlowDayCell> = {}): FlowDayCell {
  return {
    day,
    severity: "ok",
    partial: false,
    underSettled: false,
    changed: false,
    label: `${day}: leak rate 10.0 %, within`,
    target: `/traces?day=${day.replace(" ", "")}`,
    ...patch,
  };
}

const STRIP: FlowDayStrip = {
  metric: "leak rate",
  cells: [
    cellOf("Oct 28"),
    cellOf("Oct 29", { changed: true }),
    cellOf("Oct 30", { partial: true }),
  ],
};

describe("DayStrip", () => {
  it("names the grid with the metric and gives each cell its label and link", () => {
    render(
      <MemoryRouter>
        <DayStrip strip={STRIP} />
      </MemoryRouter>,
    );

    const grid = screen.getByRole("grid", { name: "leak rate" });
    expect(within(grid).getAllByRole("gridcell")).toHaveLength(3);
    expect(screen.getByRole("link", { name: "Oct 29: leak rate 10.0 %, within" })).toHaveAttribute(
      "href",
      "/traces?day=Oct29",
    );
  });

  it("keeps the focus on the last cell when the right arrow key repeats", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DayStrip strip={STRIP} />
      </MemoryRouter>,
    );
    const cells = screen.getAllByRole("link");

    await user.tab();
    expect(cells[0]).toHaveFocus();
    await user.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");

    expect(cells[2]).toHaveFocus();
  });

  it("leaves the strip with one Tab and returns to the focused cell", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <DayStrip strip={STRIP} />
        <a href="/after">After</a>
      </MemoryRouter>,
    );

    await user.tab();
    await user.keyboard("{ArrowRight}");
    await user.tab();
    expect(screen.getByRole("link", { name: "After" })).toHaveFocus();
    await user.tab({ shift: true });

    expect(screen.getAllByRole("link")[1]).toHaveFocus();
  });
});

describe("DayAxis", () => {
  it("shows the first day and the last day number with the partial mark", () => {
    render(<DayAxis cells={STRIP.cells} />);

    expect(screen.getByText("Oct 28")).toBeInTheDocument();
    expect(screen.getByText("30 ◔")).toBeInTheDocument();
  });

  it("shows no partial mark for a full last bucket", () => {
    render(<DayAxis cells={[cellOf("Oct 28"), cellOf("Oct 29")]} />);

    expect(screen.getByText("29")).toBeInTheDocument();
  });

  it("shows nothing without a cell", () => {
    const { container } = render(<DayAxis cells={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
