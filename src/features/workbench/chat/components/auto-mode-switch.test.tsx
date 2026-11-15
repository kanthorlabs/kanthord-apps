import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as workbenchApi from "@/api/resources/workbench";

vi.mock("@/api/resources/workbench");

import { AutoModeSwitch } from "./auto-mode-switch";

const SESSION_ID = "workbench_session_01J9ZQ4XKM3B6V8N2R5T7W0AB1";

function Harness({ initial }: { readonly initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  return <AutoModeSwitch sessionId={SESSION_ID} enabled={enabled} onEnabled={setEnabled} />;
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("AutoModeSwitch", () => {
  it("shows the switch on when auto mode is on", () => {
    render(<Harness initial />);

    expect(screen.getByRole("switch", { name: "Auto mode" })).toBeChecked();
  });

  it("shows the switch off when auto mode is off", () => {
    render(<Harness initial={false} />);

    expect(screen.getByRole("switch", { name: "Auto mode" })).not.toBeChecked();
  });

  it("calls the route with the session id and the new value, then shows the answer", async () => {
    vi.mocked(workbenchApi.setWorkbenchAutoMode).mockResolvedValue({
      session_id: SESSION_ID,
      enabled: false,
    });
    render(<Harness initial />);

    await userEvent.click(screen.getByRole("switch", { name: "Auto mode" }));

    expect(workbenchApi.setWorkbenchAutoMode).toHaveBeenCalledWith(SESSION_ID, false);
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Auto mode" })).not.toBeChecked(),
    );
  });

  it("shows the enabled value of the answer, not the clicked value", async () => {
    vi.mocked(workbenchApi.setWorkbenchAutoMode).mockResolvedValue({
      session_id: SESSION_ID,
      enabled: true,
    });
    render(<Harness initial />);

    await userEvent.click(screen.getByRole("switch", { name: "Auto mode" }));

    await waitFor(() => expect(workbenchApi.setWorkbenchAutoMode).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole("switch", { name: "Auto mode" })).toBeEnabled());
    expect(screen.getByRole("switch", { name: "Auto mode" })).toBeChecked();
  });

  it("shows the previous value and the error line when the call fails", async () => {
    vi.mocked(workbenchApi.setWorkbenchAutoMode).mockRejectedValue(
      new ApiError("unreachable", "The daemon is unreachable.", 0),
    );
    render(<Harness initial />);

    await userEvent.click(screen.getByRole("switch", { name: "Auto mode" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("The daemon is unreachable.");
    expect(screen.getByRole("switch", { name: "Auto mode" })).toBeChecked();
  });
});
