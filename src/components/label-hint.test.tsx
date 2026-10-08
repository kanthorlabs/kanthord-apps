import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { LabelHint } from "./label-hint";

describe("LabelHint", () => {
  it("shows the hint of a label when the human clicks its button", async () => {
    render(<LabelHint label="SSH credential" hint="The SSH key that git uses." />);

    expect(screen.queryByText("The SSH key that git uses.")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "About SSH credential" }));

    expect(await screen.findByText("The SSH key that git uses.")).toBeTruthy();
  });

  it("shows the hint on a touch tap", async () => {
    render(<LabelHint label="GitHub credential" hint="The GitHub API token." />);

    await userEvent.pointer({
      keys: "[TouchA]",
      target: screen.getByRole("button", { name: "About GitHub credential" }),
    });

    expect(await screen.findByText("The GitHub API token.")).toBeTruthy();
  });
});
