import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { BOARD_WIDTH } from "@/lib/board-width";

import { BoardSkeleton } from "./board-skeleton";

describe("BoardSkeleton", () => {
  it("is busy and shows no empty text", () => {
    render(<BoardSkeleton widthClass={BOARD_WIDTH.Expanded} />);

    expect(screen.getByRole("region", { name: "Loading the board" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.queryByText(/Nothing waits/)).not.toBeInTheDocument();
  });

  it("holds six tabs, three cards and a detail on expanded width", () => {
    const { container } = render(<BoardSkeleton widthClass={BOARD_WIDTH.Expanded} />);

    expect(container.querySelectorAll("[data-slot='skeleton']")).toHaveLength(10);
  });

  it("holds no detail on compact width", () => {
    const { container } = render(<BoardSkeleton widthClass={BOARD_WIDTH.Compact} />);

    expect(container.querySelectorAll("[data-slot='skeleton']")).toHaveLength(9);
  });
});
