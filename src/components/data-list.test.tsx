import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { DataList, type DataListPager, type DataListProps } from "./data-list";

const PAGER: DataListPager = {
  hasPrevious: false,
  hasNext: true,
  position: 0,
  onPrevious: () => undefined,
  onNext: () => undefined,
};

function props(overrides: Partial<DataListProps<string>> = {}): DataListProps<string> {
  return {
    label: "Executions",
    items: ["alpha", "beta"],
    getKey: (item) => item,
    renderItem: (item) => <div role="listitem">{item}</div>,
    status: "ready",
    error: null,
    pending: false,
    onRetry: () => undefined,
    emptyText: "No executions found.",
    pager: PAGER,
    ...overrides,
  };
}

describe("DataList", () => {
  it("renders no list and no pager while the first page loads", () => {
    render(<DataList {...props({ status: "loading", items: [] })} />);

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("offers Retry when the first page fails", async () => {
    const onRetry = vi.fn();
    render(
      <DataList
        {...props({ status: "error", items: [], error: "The daemon is unavailable.", onRetry })}
      />,
    );

    expect(screen.getByText("The daemon is unavailable.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("renders the items and pages with Previous and Next only", async () => {
    const onNext = vi.fn();
    render(<DataList {...props({ pager: { ...PAGER, onNext } })} />);

    const list = screen.getByRole("list", { name: "Executions" });
    expect(list).toHaveTextContent("alpha");
    expect(list).toHaveTextContent("beta");
    const pages = screen.getByRole("navigation", { name: "Executions pages" });
    expect(within(pages).getAllByRole("button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(onNext).toHaveBeenCalledOnce();
  });

  it("keeps the rows and the pager when a transition fails", () => {
    render(<DataList {...props({ error: "The daemon is unavailable." })} />);

    expect(screen.getByRole("alert")).toHaveTextContent("The daemon is unavailable.");
    expect(screen.getByRole("list", { name: "Executions" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("disables both page buttons and Retry while a transition is pending", () => {
    render(<DataList {...props({ pending: true, error: "The daemon is unavailable." })} />);

    expect(screen.getByRole("button", { name: "Next" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();
    expect(screen.getByRole("list", { name: "Executions" })).toHaveAttribute("aria-busy", "true");
  });

  it("shows the empty text on an empty first page", () => {
    render(<DataList {...props({ items: [], pager: { ...PAGER, hasNext: false } })} />);

    expect(screen.getByText("No executions found.")).toBeInTheDocument();
  });

  it("keeps Previous on an empty later page", () => {
    render(
      <DataList
        {...props({ items: [], pager: { ...PAGER, hasPrevious: true, hasNext: false } })}
      />,
    );

    expect(screen.getByText("No more items.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous" })).toBeEnabled();
  });

  it("renders no pager for a complete collection", () => {
    render(<DataList {...props({ pager: undefined })} />);

    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
  });

  it("moves focus to the list region only after a page move", () => {
    const { rerender } = render(<DataList {...props()} />);
    const region = screen.getByRole("region", { name: "Executions" });
    expect(region).not.toHaveFocus();

    rerender(<DataList {...props({ items: ["gamma"], pager: { ...PAGER, position: 1 } })} />);

    expect(region).toHaveFocus();
  });
});
