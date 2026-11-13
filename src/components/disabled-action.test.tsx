import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { DisabledAction } from "./disabled-action";

describe("DisabledAction", () => {
  it("shows a disabled button that stays focusable", () => {
    render(<DisabledAction label="Check now" reason="The read is running." />);

    const button = screen.getByRole("button", { name: "Check now" });

    expect(button).toHaveAttribute("aria-disabled", "true");
  });

  it("shows the reason after a press", async () => {
    render(<DisabledAction label="Check now" reason="The read is running." />);

    await userEvent.click(screen.getByRole("button", { name: "Check now" }));

    expect(await screen.findByText("The read is running.")).toBeVisible();
  });

  it("sets describedBy as aria-describedby on the button", () => {
    render(
      <>
        <DisabledAction label="Check now" reason="Wait." describedBy="need-line" />
        <p id="need-line">Check now needs: the read.</p>
      </>,
    );

    const button = screen.getByRole("button", { name: "Check now" });

    expect(button).toHaveAttribute("aria-describedby", "need-line");
    expect(button).toHaveAccessibleDescription("Check now needs: the read.");
  });

  it("sets no aria-describedby without describedBy", () => {
    render(<DisabledAction label="Check now" reason="Wait." />);

    expect(screen.getByRole("button", { name: "Check now" })).not.toHaveAttribute(
      "aria-describedby",
    );
  });
});
