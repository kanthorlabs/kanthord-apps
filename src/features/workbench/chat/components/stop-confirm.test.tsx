import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StopConfirm, type StopConfirmProps } from "./stop-confirm";

function mount(props: Partial<StopConfirmProps> = {}) {
  const handlers = { onStop: vi.fn(), onStopAndSend: vi.fn(), onCancel: vi.fn() };
  render(<StopConfirm count={2} hasDraft={false} busy={false} {...handlers} {...props} />);
  return { ...handlers, dialog: screen.getByRole("alertdialog", { name: "Stop the run?" }) };
}

describe("StopConfirm", () => {
  it("names the queued count in the plural and offers Stop and Cancel", async () => {
    const { dialog, onStop, onCancel } = mount();

    expect(within(dialog).getByText("Stop the run?")).toBeInTheDocument();
    expect(
      within(dialog).getByText("Your 2 queued messages return to the composer."),
    ).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Stop & send draft" })).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Stop" }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("names one queued message in the singular", () => {
    const { dialog } = mount({ count: 1 });

    expect(
      within(dialog).getByText("Your 1 queued message returns to the composer."),
    ).toBeInTheDocument();
  });

  it("adds the draft line and Stop & send draft with a draft", async () => {
    const { dialog, onStopAndSend } = mount({ hasDraft: true });

    expect(within(dialog).getByText("Your draft sends next.")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Stop & send draft" }));

    expect(onStopAndSend).toHaveBeenCalledTimes(1);
  });

  it("disables both stop buttons while an action is in flight", () => {
    const { dialog } = mount({ hasDraft: true, busy: true });

    expect(within(dialog).getByRole("button", { name: "Stop" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Stop & send draft" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeEnabled();
  });
});
