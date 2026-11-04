import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CleanableKind, CleanupRule, WorkerPlacement } from "@/api/types";
import { selectionPlan } from "../cleanup-plan";
import type { FootprintCleanupState } from "../use-footprint-cleanup";
import { CleanupDialog } from "./cleanup-dialog";

const GIB = 1_073_741_824;

function mount(
  kind: CleanableKind,
  instanceName: string | null,
  placement: WorkerPlacement | null,
  rule: CleanupRule | null,
) {
  const keys = Array.from({ length: 640 }, (_, index) => `key-${index}`);
  const cleanup: FootprintCleanupState = {
    plan: selectionPlan({
      kind,
      instanceName,
      placement,
      rule,
      keys,
      bytes: 215 * GIB,
      estimated: false,
    }),
    sending: false,
    error: null,
    blocked: false,
    request: vi.fn(),
    cancel: vi.fn(),
    confirm: vi.fn(),
  };
  render(<CleanupDialog cleanup={cleanup} />);
  return within(screen.getByRole("alertdialog"));
}

describe("CleanupDialog", () => {
  it("states the consequence, the size and the safer path before the request", () => {
    const dialog = mount("trace", null, null, { name: "older_than", older_than_days: 30 });

    expect(dialog.getByText("Delete 640 traces?")).toBeInTheDocument();
    expect(dialog.getByText("This deletes 640 traces on the server, 215 GiB.")).toBeInTheDocument();
    expect(
      dialog.getByText(/The flow rollups, the execution rows and every Mission record stay\./),
    ).toBeInTheDocument();
    expect(
      dialog.getByText("Narrow the set with a larger age, for example 60 days."),
    ).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Delete 640 items" })).toBeInTheDocument();
    expect(dialog.getByRole("button", { name: "Keep them" })).toBeInTheDocument();
  });

  it("states the workspace loss", () => {
    const dialog = mount("workspace", "mac-studio", "worker", { name: "node_closed" });

    expect(
      dialog.getByText("This deletes 640 node workspaces on mac-studio, 215 GiB."),
    ).toBeInTheDocument();
    expect(
      dialog.getByText(
        "A later execution of the node clones again and installs its dependencies again. Uncommitted files of a closed node are lost.",
      ),
    ).toBeInTheDocument();
  });

  it("states when the instance runs the cleanup for each placement", () => {
    expect(
      mount("workspace", "mac-studio", "worker", { name: "node_closed" }).getByText(
        "The instance runs the cleanup when it reads its work, within 15 seconds while it runs.",
      ),
    ).toBeInTheDocument();
  });

  it("states the report wait at the server placement", () => {
    expect(
      mount("tool_output", "coder-1", "server", {
        name: "older_than",
        older_than_days: 30,
      }).getByText(
        "The instance runs the cleanup at its next report, within 15 minutes while it runs.",
      ),
    ).toBeInTheDocument();
  });

  it("states the immediate session delete at the container placement", () => {
    expect(
      mount("session", "builder-1", "container", null).getByText(
        "KanthorD deletes these sessions at once.",
      ),
    ).toBeInTheDocument();
  });
});
