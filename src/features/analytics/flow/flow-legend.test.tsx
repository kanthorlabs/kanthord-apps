import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

  it("lists one minimum entry with both nouns and no duplicate key warning", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <FlowLegend
        entries={[
          { glyph: "▢", label: "within" },
          { glyph: "┄", label: "under 5 settled · under 5 runs" },
        ]}
      />,
    );

    const items = within(screen.getByRole("list", { name: "Legend" })).getAllByRole("listitem");
    expect(items.filter((item) => item.textContent?.startsWith("┄"))).toHaveLength(1);
    expect(screen.getByText("under 5 settled · under 5 runs")).toBeInTheDocument();
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it("lists nothing for no entry", () => {
    render(<FlowLegend entries={[]} />);

    expect(within(screen.getByRole("list", { name: "Legend" })).queryAllByRole("listitem")).toEqual(
      [],
    );
  });
});
