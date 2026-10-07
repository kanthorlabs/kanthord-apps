import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as promptsApi from "@/api/resources/prompts";
import type { PromptSettings } from "@/api/types";

vi.mock("@/api/resources/prompts");

import { PromptsScreen } from "./prompts-screen";

const SYSTEM: PromptSettings = {
  scope: "system",
  agent_name: "",
  switches: { host_file: true, base: true, custom: false, layer: true },
  locked_switches: [],
  custom_text: "",
  system_layer: null,
  revision: 4,
};

function mount() {
  return render(
    <MemoryRouter>
      <PromptsScreen />
    </MemoryRouter>,
  );
}

describe("PromptsScreen", () => {
  it("turns the system layer off for every agent that follows the server", async () => {
    vi.mocked(promptsApi.readPromptSettings).mockResolvedValue(SYSTEM);
    vi.mocked(promptsApi.switchPromptSource).mockResolvedValue({
      ...SYSTEM,
      switches: { ...SYSTEM.switches, layer: false },
      revision: 5,
    });
    mount();

    const master = await screen.findByRole("switch", { name: "System layer" });
    expect(master).toBeChecked();
    await userEvent.click(master);

    expect(promptsApi.switchPromptSource).toHaveBeenCalledWith(
      { scope: "system" },
      4,
      "layer",
      false,
    );
  });

  it("holds one switch per system source", async () => {
    vi.mocked(promptsApi.readPromptSettings).mockResolvedValue(SYSTEM);
    mount();

    const list = within(await screen.findByRole("list", { name: "System layer sources" }));
    expect(list.getByRole("switch", { name: "Host agent file switch" })).toBeChecked();
    expect(list.getByRole("switch", { name: "Custom system prompt switch" })).not.toBeChecked();
    await userEvent.click(list.getByRole("switch", { name: "Custom system prompt switch" }));
    await waitFor(() =>
      expect(promptsApi.switchPromptSource).toHaveBeenCalledWith(
        { scope: "system" },
        4,
        "custom",
        true,
      ),
    );
  });

  it("shows the host agent file as off and locked while the configuration locks it", async () => {
    vi.mocked(promptsApi.readPromptSettings).mockResolvedValue({
      ...SYSTEM,
      locked_switches: ["host_file"],
    });
    mount();

    const list = within(await screen.findByRole("list", { name: "System layer sources" }));
    const host = list.getByRole("switch", { name: "Host agent file switch" });
    expect(host).not.toBeChecked();
    expect(host).toHaveAttribute("aria-disabled", "true");
    expect(host).toHaveAccessibleDescription("kanthord.yaml turns the host agent file off.");
    expect(list.getByRole("switch", { name: "Shipped base prompt switch" })).toBeChecked();
    expect(list.getByRole("switch", { name: "Shipped base prompt switch" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("gives the host agent file no reason while nothing is locked", async () => {
    vi.mocked(promptsApi.readPromptSettings).mockResolvedValue(SYSTEM);
    mount();

    const list = within(await screen.findByRole("list", { name: "System layer sources" }));
    const host = list.getByRole("switch", { name: "Host agent file switch" });
    expect(host).not.toHaveAttribute("aria-disabled", "true");
    expect(host).toHaveAccessibleDescription("");
    expect(screen.queryByText("kanthord.yaml turns the host agent file off.")).toBeNull();
  });

  it("saves the custom system prompt from the editor at the revision of the scope", async () => {
    vi.mocked(promptsApi.readPromptSettings).mockResolvedValue({ ...SYSTEM, custom_text: "Old" });
    vi.mocked(promptsApi.putPromptText).mockResolvedValue({ ...SYSTEM, revision: 5 });
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit Custom system prompt" }));
    const text = await screen.findByRole("textbox", { name: "Custom prompt markdown" });
    expect(text).toHaveValue("Old");
    const save = screen.getByRole("button", { name: "Save custom prompt" });
    expect(save).toBeDisabled();
    await userEvent.clear(text);
    await userEvent.type(text, "# Rules");
    expect(screen.getByText("7 / 32,768 bytes")).toBeTruthy();
    await userEvent.click(save);

    expect(promptsApi.putPromptText).toHaveBeenCalledWith({ scope: "system" }, 4, "# Rules");
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "Custom prompt markdown" })).toBeNull(),
    );
  });

  it("asks before it discards an unsaved draft and keeps the draft on a conflict", async () => {
    vi.mocked(promptsApi.readPromptSettings).mockResolvedValue(SYSTEM);
    vi.mocked(promptsApi.putPromptText).mockRejectedValue(
      new ApiError("conflict", "Prompt settings revision conflict.", 409),
    );
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Edit Custom system prompt" }));
    const text = await screen.findByRole("textbox", { name: "Custom prompt markdown" });
    await userEvent.type(text, "Draft");
    await userEvent.click(screen.getByRole("button", { name: "Save custom prompt" }));
    expect(await screen.findByText("The prompt changed elsewhere.")).toBeTruthy();
    expect(text).toHaveValue("Draft");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByText("Discard the unsaved changes?")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(screen.getByRole("textbox", { name: "Custom prompt markdown" })).toHaveValue("Draft");
  });
});
