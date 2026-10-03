import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataListItem } from "./data-list-item";

describe("DataListItem", () => {
  it("renders the title, the status, the fields and the actions of one item", () => {
    render(
      <DataListItem
        title="Write the release notes"
        status={<Badge variant="secondary">Running</Badge>}
        description="Execution exe_01J"
        fields={[
          { label: "Attempt", value: "att_01J" },
          { label: "Deadline", value: "in 5 minutes" },
        ]}
        actions={<Button size="sm">Open</Button>}
      />,
    );

    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("Write the release notes");
    expect(item).toHaveTextContent("Running");
    expect(item).toHaveTextContent("Execution exe_01J");
    expect(screen.getAllByRole("term").map((term) => term.textContent)).toEqual([
      "Attempt",
      "Deadline",
    ]);
    expect(screen.getAllByRole("definition").map((value) => value.textContent)).toEqual([
      "att_01J",
      "in 5 minutes",
    ]);
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
  });

  it("renders only the title when no other slot is given", () => {
    render(<DataListItem title="Write the release notes" />);

    expect(screen.getByRole("listitem")).toHaveTextContent("Write the release notes");
    expect(screen.queryByRole("term")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the notice inside the item", () => {
    render(<DataListItem title="local" notice={<p>The instance did not answer.</p>} />);

    expect(screen.getByRole("listitem")).toHaveTextContent("The instance did not answer.");
  });

  it("turns the title into the select control of the item", async () => {
    const onSelect = vi.fn();
    render(
      <DataListItem
        title="local"
        select={{ label: "Sign in to local", disabled: false, onSelect }}
        actions={<Button size="sm">Edit</Button>}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Sign in to local" }));

    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Edit" })).toBeInTheDocument();
  });

  it("disables the select control on request", () => {
    render(
      <DataListItem
        title="local"
        select={{ label: "Sign in to local", disabled: true, onSelect: () => undefined }}
      />,
    );

    expect(screen.getByRole("button", { name: "Sign in to local" })).toBeDisabled();
  });
});
