import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { StopConfirm, type StopConfirmProps } from "./stop-confirm";

function mount(props: Partial<StopConfirmProps> = {}) {
  const handlers = { onStop: vi.fn(), onStopAndSend: vi.fn(), onCancel: vi.fn() };
  const count = props.count ?? 2;
  render(<StopConfirm count={count} hasDraft={false} busy={false} {...handlers} {...props} />);
  return {
    ...handlers,
    dialog: screen.getByRole("alertdialog", { name: `Stop the run and clear ${count} queued?` }),
  };
}

describe("StopConfirm", () => {
  it("names the queued count in the plural and offers Stop and Cancel", async () => {
    const { dialog, onStop, onCancel } = mount();

    expect(within(dialog).getByText("Stop the run and clear 2 queued?")).toBeInTheDocument();
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

  it("shows the draft line and one Stop & send draft button instead of Stop with a draft", async () => {
    const { dialog, onStop, onStopAndSend } = mount({ hasDraft: true });

    expect(within(dialog).getByText("Your draft sends next.")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Stop" })).toBeNull();
    await userEvent.click(within(dialog).getByRole("button", { name: "Stop & send draft" }));

    expect(onStopAndSend).toHaveBeenCalledTimes(1);
    expect(onStop).not.toHaveBeenCalled();
  });

  it("disables the stop button while an action is in flight", () => {
    const { dialog } = mount({ busy: true });

    expect(within(dialog).getByRole("button", { name: "Stop" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeEnabled();
  });

  it("fills the confirm button with the destructive color", () => {
    const { dialog } = mount();

    const stop = within(dialog).getByRole("button", { name: "Stop" });
    expect(stop).toHaveClass("bg-destructive", "border-destructive", "text-white");
    expect(stop).not.toHaveClass("bg-destructive/10", "text-destructive");
    expect(dialog).toHaveClass("border-destructive", "bg-destructive/10");
  });
});
