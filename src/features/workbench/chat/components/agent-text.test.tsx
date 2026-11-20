import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AgentText } from "./agent-text";

describe("AgentText", () => {
  it("renders a Markdown table as a table", () => {
    render(<AgentText text={"| a | b |\n|---|---|\n| 1 | 2 |"} />);

    const table = screen.getByRole("table");
    expect(within(table).getByRole("cell", { name: "1" })).toBeVisible();
    expect(within(table).getByRole("cell", { name: "2" })).toBeVisible();
  });
});
