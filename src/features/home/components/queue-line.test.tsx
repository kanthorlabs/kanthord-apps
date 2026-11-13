import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { QueueLine } from "./queue-line";

describe("QueueLine", () => {
  it("reads the subject and the rank as one line", () => {
    render(
      <QueueLine
        entry={{ id: "tool_approval:s1", subject: "Create it", rank: 2 }}
        onShow={vi.fn()}
      />,
    );

    expect(screen.getByText("Create it is").parentElement).toHaveTextContent(
      "Create it is #2 in your queue.",
    );
  });

  it("shows the item in the deck from the rank link", async () => {
    const onShow = vi.fn();
    render(
      <QueueLine
        entry={{ id: "tool_approval:s1", subject: "Create it", rank: 2 }}
        onShow={onShow}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Show #2 in the deck" }));

    expect(onShow).toHaveBeenCalledWith("tool_approval:s1");
  });
});
