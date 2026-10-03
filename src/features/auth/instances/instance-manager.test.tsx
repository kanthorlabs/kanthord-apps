import { useEffect } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { readLiveness } from "@/api/resources/gateway";
import type { LivenessReport } from "@/api/types";
import { InstanceManager } from "./instance-manager";
import { useInstanceManager } from "./use-instance-manager";
import { useInstances } from "./use-instances";

vi.mock("@/api/resources/gateway", () => ({
  readLiveness: vi.fn(),
  verifyHumanToken: vi.fn(),
}));

const readLivenessMock = vi.mocked(readLiveness);

const LOCAL = { id: "i-local", name: "local", baseUrl: "http://localhost:31415" };
const STAGING = { id: "i-staging", name: "staging", baseUrl: "https://kd.example.com" };

function seed(instances: readonly object[], defaultId: string | null) {
  window.localStorage.setItem("kanthord.instances", JSON.stringify({ instances, defaultId }));
}

function Harness({ opening = "list" }: { readonly opening?: "list" | "add" | "none" }) {
  const store = useInstances();
  const manager = useInstanceManager(store);
  const { openList, openAdd } = manager;
  useEffect(() => {
    if (opening === "list") openList();
    if (opening === "add") openAdd();
  }, [opening, openList, openAdd]);
  return (
    <>
      <button type="button" onClick={openAdd}>
        Add from outside
      </button>
      <InstanceManager store={store} manager={manager} />
    </>
  );
}

function row(name: string) {
  return screen.getByRole("listitem", { name });
}

async function fillForm(name: string, baseUrl: string) {
  const nameInput = screen.getByLabelText("Name");
  const urlInput = screen.getByLabelText("Base URL");
  await userEvent.clear(nameInput);
  if (name !== "") await userEvent.type(nameInput, name);
  await userEvent.clear(urlInput);
  if (baseUrl !== "") await userEvent.type(urlInput, baseUrl);
}

describe("InstanceManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("offers to add an instance when the list is empty", async () => {
    render(<Harness />);

    expect(screen.getByText("No instances")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Add instance" }));

    expect(screen.getByLabelText("Name")).toBeTruthy();
  });

  it("adds an instance, normalizes its URL and makes the first one the default", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Add instance" }));
    await fillForm("local", "http://localhost:31415/");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    const added = row("local");
    expect(within(added).getByText("http://localhost:31415")).toBeTruthy();
    expect(within(added).getByText("Default")).toBeTruthy();
  });

  it("names the errors of an empty name and a bad URL", async () => {
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Add instance" }));
    await fillForm("", "localhost:31415");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Type a name.")).toBeTruthy();
    expect(
      screen.getByText("Type an absolute http or https URL, for example http://localhost:31415."),
    ).toBeTruthy();
    expect(screen.queryByRole("listitem")).toBeNull();
  });

  it("refuses a duplicate name and a duplicate URL", async () => {
    seed([LOCAL], LOCAL.id);
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Add instance" }));
    await fillForm("LOCAL", "http://localhost:31415/");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText("Another instance is already named LOCAL.")).toBeTruthy();
    expect(screen.getByText("The instance local already uses this URL.")).toBeTruthy();
  });

  it("edits an instance", async () => {
    seed([LOCAL, STAGING], LOCAL.id);
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Edit: staging" }));
    expect(screen.getByLabelText("Name")).toHaveValue("staging");
    await fillForm("production", "https://prod.example.com");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.queryByRole("listitem", { name: "staging" })).toBeNull();
    expect(within(row("production")).getByText("https://prod.example.com")).toBeTruthy();
  });

  it("keeps the instance when the human cancels the removal", async () => {
    seed([LOCAL, STAGING], LOCAL.id);
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Remove: staging" }));
    const guard = await screen.findByRole("alertdialog");
    expect(within(guard).getByText("Remove staging?")).toBeTruthy();
    expect(
      within(guard).getByText("This browser forgets its URL. The instance itself is not changed."),
    ).toBeTruthy();
    expect(within(guard).queryByText("No instance is the default after you remove it.")).toBeNull();
    await userEvent.click(within(guard).getByRole("button", { name: "Keep instance" }));

    expect(row("staging")).toBeTruthy();
  });

  it("removes the instance on confirm and warns when it is the default", async () => {
    seed([LOCAL, STAGING], LOCAL.id);
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Remove: local" }));
    const guard = await screen.findByRole("alertdialog");
    expect(within(guard).getByText("No instance is the default after you remove it.")).toBeTruthy();
    await userEvent.click(within(guard).getByRole("button", { name: "Remove instance" }));

    expect(screen.queryByRole("listitem", { name: "local" })).toBeNull();
    expect(within(row("staging")).queryByText("Default")).toBeNull();
  });

  it("sets another instance as the default", async () => {
    seed([LOCAL, STAGING], LOCAL.id);
    render(<Harness />);

    expect(screen.queryByRole("button", { name: "Set as default: local" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Set as default: staging" }));

    expect(within(row("staging")).getByText("Default")).toBeTruthy();
    expect(within(row("local")).queryByText("Default")).toBeNull();
  });

  it("applies each row action to the instance it names", async () => {
    seed([LOCAL, STAGING], LOCAL.id);
    readLivenessMock.mockResolvedValue({ healthy: true, services: {} });
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Verify: staging" }));
    expect(await within(row("staging")).findByText("Reachable")).toBeTruthy();
    expect(within(row("local")).queryByText("Reachable")).toBeNull();
    expect(readLivenessMock).toHaveBeenCalledTimes(1);
    expect(readLivenessMock).toHaveBeenCalledWith(STAGING.baseUrl);

    await userEvent.click(screen.getByRole("button", { name: "Set as default: staging" }));
    expect(within(row("staging")).getByText("Default")).toBeTruthy();
    expect(within(row("local")).queryByText("Default")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Edit: staging" }));
    expect(screen.getByLabelText("Name")).toHaveValue("staging");
    await fillForm("production", "https://prod.example.com");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(within(row("local")).getByText(LOCAL.baseUrl)).toBeTruthy();
    expect(within(row("production")).getByText("https://prod.example.com")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: "Remove: production" }));
    const guard = await screen.findByRole("alertdialog");
    await userEvent.click(within(guard).getByRole("button", { name: "Remove instance" }));
    expect(row("local")).toBeTruthy();
    expect(screen.queryByRole("listitem", { name: "production" })).toBeNull();
  });

  it("opens straight in add mode with openAdd", async () => {
    render(<Harness opening="add" />);

    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByRole("heading", { name: "Add instance" })).toBeTruthy();
    expect(screen.queryByText("No instances")).toBeNull();
  });

  it("returns to the list on cancel and reopens add with an empty draft", async () => {
    render(<Harness opening="add" />);

    await fillForm("half", "http://half");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("No instances")).toBeTruthy();

    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await userEvent.click(screen.getByRole("button", { name: "Add from outside" }));

    expect(screen.getByLabelText("Name")).toHaveValue("");
    expect(screen.getByLabelText("Base URL")).toHaveValue("");
  });

  it("clears stale errors when openAdd reopens the form", async () => {
    render(<Harness opening="add" />);

    await fillForm("", "");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Type a name.")).toBeTruthy();
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await userEvent.click(screen.getByRole("button", { name: "Add from outside" }));

    expect(screen.queryByText("Type a name.")).toBeNull();
  });

  it("keeps focus in the dialog after the first save from add mode", async () => {
    render(<Harness opening="add" />);

    await fillForm("local", "http://localhost:31415");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(row("local")).toBeTruthy();
    await waitFor(() =>
      expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true),
    );
  });

  it("keeps the instances and the default after a remount", async () => {
    const { unmount } = render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Add instance" }));
    await fillForm("local", "http://localhost:31415");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.click(screen.getByRole("button", { name: "Add instance" }));
    await fillForm("staging", "https://kd.example.com");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await userEvent.click(screen.getByRole("button", { name: "Set as default: staging" }));

    unmount();
    render(<Harness />);

    expect(within(row("staging")).getByText("Default")).toBeTruthy();
    expect(within(row("local")).getByText("http://localhost:31415")).toBeTruthy();
    expect(within(row("local")).queryByText("Default")).toBeNull();
  });

  it("shows Checking… and then Reachable for a healthy instance", async () => {
    seed([LOCAL], LOCAL.id);
    let answer: (value: LivenessReport) => void = () => undefined;
    readLivenessMock.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Verify: local" }));
    expect(within(row("local")).getByText("Checking…")).toBeTruthy();
    answer({ healthy: true, services: {} });

    expect(await within(row("local")).findByText("Reachable")).toBeTruthy();
    expect(readLivenessMock).toHaveBeenCalledWith("http://localhost:31415");
  });

  it("lists the failing components of an unhealthy instance", async () => {
    seed([LOCAL], LOCAL.id);
    readLivenessMock.mockResolvedValue({
      healthy: false,
      services: { storage: { database: 503, cache: 200 }, worker: { queue: 503 } },
    });
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Verify: local" }));

    expect(await within(row("local")).findByText("Unhealthy")).toBeTruthy();
    expect(within(row("local")).getByText("storage.database")).toBeTruthy();
    expect(within(row("local")).getByText("worker.queue")).toBeTruthy();
    expect(within(row("local")).queryByText("storage.cache")).toBeNull();
  });

  it("explains an unreachable instance with the dashboard origin", async () => {
    seed([LOCAL], LOCAL.id);
    readLivenessMock.mockRejectedValue(
      new ApiError("unreachable", "The daemon did not answer.", 0),
    );
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Verify: local" }));

    expect(await within(row("local")).findByText("Unreachable")).toBeTruthy();
    expect(
      within(row("local")).getByText(
        `The instance did not answer. Its configured origins may not include this dashboard origin, ${window.location.origin}.`,
      ),
    ).toBeTruthy();
  });

  it("verifies the typed URL before the human saves it", async () => {
    readLivenessMock.mockResolvedValue({ healthy: true, services: {} });
    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Add instance" }));
    await fillForm("local", "http://localhost:31415/");
    await userEvent.click(screen.getByRole("button", { name: "Verify" }));

    expect(await screen.findByText("Reachable")).toBeTruthy();
    expect(readLivenessMock).toHaveBeenCalledWith("http://localhost:31415");
    expect(screen.queryByRole("listitem")).toBeNull();
  });
});
