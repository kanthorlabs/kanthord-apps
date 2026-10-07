import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import * as promptsApi from "@/api/resources/prompts";
import type { PromptSettings } from "@/api/types";

vi.mock("@/api/resources/prompts");

import { PromptsScreen } from "./prompts-screen";

const SYSTEM: PromptSettings = {
  scope: "system",
  agentName: "",
  switches: { host_file: true, base: true, custom: false, layer: true },
  customText: "",
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
});
