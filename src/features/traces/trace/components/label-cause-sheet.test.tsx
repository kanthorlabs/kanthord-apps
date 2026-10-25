import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/resources/tracking", () => ({
  labelTraceCause: vi.fn(),
}));

import { labelTraceCause } from "@/api/resources/tracking";
import type { CauseLabel, EffectiveCause } from "@/api/types";

import { LabelCauseSheet } from "./label-cause-sheet";

const CAUSE: EffectiveCause = { category: "unattributed", assigner: "rule", suspects: ["model"] };

const ANSWER: CauseLabel = {
  trace_id: "trace-1",
  span_id: "root.cause_label",
  cause: { category: "model", assigner: "human", subcategory: "work_defect" },
  reason: "The model broke it.",
  created_at: 1000,
};

function matchLargeScreen(matches: boolean) {
  vi.stubGlobal("matchMedia", () => ({
    matches,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

function renderSheet() {
  const onLabeled = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <LabelCauseSheet
      traceId="trace-1"
      cause={CAUSE}
      open
      onOpenChange={onOpenChange}
      onLabeled={onLabeled}
    />,
  );
  return { onLabeled, onOpenChange };
}

beforeEach(() => {
  matchLargeScreen(true);
  vi.mocked(labelTraceCause).mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("LabelCauseSheet", () => {
  it("opens a side sheet on a large screen", () => {
    renderSheet();

    expect(document.querySelector("[data-slot='sheet-content']")).toHaveAttribute(
      "data-side",
      "right",
    );
  });

  it("opens a bottom sheet on a compact screen", () => {
    matchLargeScreen(false);
    renderSheet();

    expect(document.querySelector("[data-slot='sheet-content']")).toHaveAttribute(
      "data-side",
      "bottom",
    );
  });

  it("keeps Save label disabled until the reason is valid", async () => {
    const user = userEvent.setup();
    renderSheet();
    const save = screen.getByRole("button", { name: "Save label" });
    expect(save).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: "Reason" }), "The model broke it.");

    expect(save).toBeEnabled();
  });

  it("saves the label and closes", async () => {
    vi.mocked(labelTraceCause).mockResolvedValue(ANSWER);
    const user = userEvent.setup();
    const { onLabeled, onOpenChange } = renderSheet();

    await user.type(screen.getByRole("textbox", { name: "Reason" }), "The model broke it.");
    await user.click(screen.getByRole("button", { name: "Save label" }));

    await waitFor(() => expect(onLabeled).toHaveBeenCalledWith(ANSWER));
    expect(labelTraceCause).toHaveBeenCalledWith("trace-1", {
      category: "model",
      subcategory: "work_defect",
      reason: "The model broke it.",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("closes on Cancel", async () => {
    const user = userEvent.setup();
    const { onOpenChange } = renderSheet();

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
