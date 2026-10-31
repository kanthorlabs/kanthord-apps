import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FlowLegend } from "./flow-legend";

describe("FlowLegend", () => {
  it("lists each entry with its glyph and label", () => {
    render(
      <FlowLegend
        entries={[
          { glyph: "▢", label: "within" },
          { glyph: "■", label: "bad" },
        ]}
      />,
    );

    const items = within(screen.getByRole("list", { name: "Legend" })).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual(["▢within", "■bad"]);
  });

  it("lists nothing for no entry", () => {
    render(<FlowLegend entries={[]} />);

    expect(within(screen.getByRole("list", { name: "Legend" })).queryAllByRole("listitem")).toEqual(
      [],
    );
  });
});
