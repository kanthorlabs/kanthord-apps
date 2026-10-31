import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DisabledAction } from "./disabled-action";

describe("DisabledAction", () => {
  it("shows a disabled button that stays focusable", () => {
    render(<DisabledAction label="Check now" reason="The read is running." />);

    const button = screen.getByRole("button", { name: "Check now" });

    expect(button).toHaveAttribute("aria-disabled", "true");
    expect(button).not.toHaveAttribute("aria-keyshortcuts");
  });

  it("shows the reason after a press", async () => {
    render(<DisabledAction label="Check now" reason="The read is running." />);

    await userEvent.click(screen.getByRole("button", { name: "Check now" }));

    expect(await screen.findByText("The read is running.")).toBeVisible();
  });

  it("sets keyShortcuts as aria-keyshortcuts on the button", () => {
    render(<DisabledAction label="Check now" reason="Wait." keyShortcuts="c" />);

    expect(screen.getByRole("button", { name: "Check now" })).toHaveAttribute(
      "aria-keyshortcuts",
      "c",
    );
  });

  it("renders the hint after the label", () => {
    render(<DisabledAction label="Check now" reason="Wait." hint={<kbd>c</kbd>} />);

    const button = screen.getByRole("button");

    expect(button.textContent).toBe("Check nowc");
    expect(button.lastElementChild).toHaveTextContent("c");
  });
});
