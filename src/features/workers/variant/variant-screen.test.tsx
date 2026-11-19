import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as agentApi from "@/api/resources/agent";
import type { AgentDeclaration, AgentVariant, PromptPart } from "@/api/types";

vi.mock("@/api/resources/agent");

import { VariantScreen } from "./variant-screen";

const VARIANT: AgentVariant = {
  id: "agent_variant_1",
  agent_name: "swe@1",
  display_name: "Software Architecture",
  instruction: "Weigh each change against the structure.",
  revision: 1,
};

function part(kind: PromptPart["part"], name: string, origin: PromptPart["origin"]): PromptPart {
  return {
    layer: kind === "framing" ? null : 1,
    part: kind,
    name,
    origin,
    path: null,
    binding_id: null,
    commit: null,
    digest: `digest-${name}`,
    heading: null,
    state: "resolved",
    text: `Text of ${name}.`,
  };
}

const DECLARATION: AgentDeclaration = {
  agent_name: "swe@1",
  configuration_schema: {},
  overridable_fields: [],
  enablement: null,
  prompt: {
    parts: [
      part("standard", "base.md", "binary"),
      part("identity", "identity.md", "binary"),
      part("role", "swe@1.md", "binary"),
      part("variant", "Software Architecture", "database"),
      part("workbench", "workbench.md", "binary"),
      part("framing", "framing-workbench", "binary"),
    ],
    final: null,
  },
  tools: [],
  chain: [],
  active_position: null,
  cooling: null,
  pinned_model_identifier: null,
};

const INSTRUCTION_ISSUE = [{ path: ["body", "instruction"], code: "custom" }];

function AgentsRoute() {
  const { pathname } = useLocation();
  return <p>Page {pathname}</p>;
}

function mount(path = "/agents/swe%401/variants/agent_variant_1") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/agents" element={<AgentsRoute />} />
        <Route path="/agents/:agentName" element={<AgentsRoute />} />
        <Route path="/agents/:agentName/variants/:variantId" element={<VariantScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function openEditor() {
  await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
  return screen.findByRole("dialog");
}

describe("VariantScreen", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(agentApi.readAgentVariant).mockResolvedValue(VARIANT);
    vi.mocked(agentApi.readAgentVariantPrompt).mockResolvedValue(DECLARATION);
  });

  it("shows the name, the instruction, the base agent link and the prompt parts in order", async () => {
    mount();

    expect(await screen.findByText("Software Architecture (v1)")).toBeTruthy();
    expect(screen.getByText("Weigh each change against the structure.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "swe@1" })).toHaveAttribute("href", "/agents/swe%401");
    const parts = within(screen.getByRole("list", { name: "Prompt parts" })).getAllByRole(
      "listitem",
    );
    expect(
      parts.map((item) => within(item).getAllByRole("button")[0]!.getAttribute("aria-label")),
    ).toEqual([
      "base.md",
      "identity.md",
      "swe@1.md",
      "Software Architecture",
      "workbench.md",
      "framing-workbench",
    ]);
    expect(within(parts[3]!).getByText("Set in KanthorD")).toBeTruthy();
    expect(agentApi.readAgentVariantPrompt).toHaveBeenCalledWith("swe@1", "agent_variant_1");
  });

  it("saves a changed name and instruction with the current revision and shows the notice", async () => {
    vi.mocked(agentApi.updateAgentVariant).mockResolvedValue({ ...VARIANT, revision: 2 });
    mount();

    const sheet = await openEditor();
    const name = within(sheet).getByLabelText("Display name");
    const instruction = within(sheet).getByLabelText("Instruction");
    expect(name).toHaveValue("Software Architecture");
    expect(within(sheet).getByText(/1 to 40 letters, digits, spaces, _ or -/)).toBeTruthy();
    await userEvent.clear(name);
    await userEvent.type(name, "Architecture");
    await userEvent.clear(instruction);
    await userEvent.type(instruction, "Name the owner.");
    await userEvent.click(within(sheet).getByRole("button", { name: "Save variant" }));

    expect(agentApi.updateAgentVariant).toHaveBeenCalledWith("agent_variant_1", {
      display_name: "Architecture",
      instruction: "Name the owner.",
      expected_revision: 1,
    });
    expect(await screen.findByText("Takes effect at the next agent session")).toBeTruthy();
    expect(agentApi.readAgentVariant).toHaveBeenCalledTimes(2);
  });

  it("refuses a name that breaks the rule under the name field before any call", async () => {
    mount();

    const sheet = await openEditor();
    const name = within(sheet).getByLabelText("Display name");
    await userEvent.clear(name);
    await userEvent.type(name, "1st");
    await userEvent.click(within(sheet).getByRole("button", { name: "Save variant" }));

    expect(await within(sheet).findByRole("alert")).toHaveTextContent(
      "1 to 40 letters, digits, spaces, _ or -, starting with a letter.",
    );
    expect(agentApi.updateAgentVariant).not.toHaveBeenCalled();
  });

  it("keeps the draft on a revision conflict, shows the current row and saves over its revision", async () => {
    const current = { ...VARIANT, display_name: "Other", instruction: "Their text.", revision: 3 };
    vi.mocked(agentApi.updateAgentVariant)
      .mockRejectedValueOnce(
        new ApiError("conflict", "The variant changed.", 409, "agent.variant.revision_conflict", {
          current,
        }),
      )
      .mockResolvedValueOnce({ ...current, revision: 4 });
    mount();

    const sheet = await openEditor();
    await userEvent.type(within(sheet).getByLabelText("Instruction"), " More.");
    await userEvent.click(within(sheet).getByRole("button", { name: "Save variant" }));

    const line = await within(sheet).findByRole("alert");
    expect(line).toHaveTextContent("agent.variant.revision_conflict The variant changed.");
    const row = within(sheet).getByRole("region", { name: "Current variant" });
    expect(row).toHaveTextContent("Other (v3)");
    expect(row).toHaveTextContent("Their text.");
    expect(within(sheet).getByLabelText("Instruction")).toHaveValue(
      "Weigh each change against the structure. More.",
    );
    expect(within(sheet).getByLabelText("Display name")).toHaveValue("Software Architecture");

    await userEvent.click(within(sheet).getByRole("button", { name: "Save variant" }));

    expect(agentApi.updateAgentVariant).toHaveBeenLastCalledWith("agent_variant_1", {
      display_name: "Software Architecture",
      instruction: "Weigh each change against the structure. More.",
      expected_revision: 3,
    });
    expect(await screen.findByText("Takes effect at the next agent session")).toBeTruthy();
  });

  it("shows the instruction line under the editor for a validation answer and keeps the draft", async () => {
    vi.mocked(agentApi.updateAgentVariant).mockRejectedValue(
      new ApiError(
        "malformed",
        "Request validation failed.",
        400,
        "gateway.request.validation_failed",
        INSTRUCTION_ISSUE,
      ),
    );
    mount();

    const sheet = await openEditor();
    await userEvent.type(within(sheet).getByLabelText("Instruction"), " More.");
    await userEvent.click(within(sheet).getByRole("button", { name: "Save variant" }));

    const line = await within(sheet).findByRole("alert");
    expect(line).toHaveTextContent(
      "gateway.request.validation_failed The instruction is blank or above 32768 bytes.",
    );
    expect(
      within(sheet).getByRole("textbox", {
        name: "Instruction",
        description: /gateway\.request\.validation_failed The instruction is blank/,
      }),
    ).toHaveValue("Weigh each change against the structure. More.");
    expect(screen.queryByText("Takes effect at the next agent session")).toBeNull();
  });

  it.each([
    ["a blank instruction", "   "],
    ["an instruction above 32768 bytes", "é".repeat(16385)],
  ])("shows the instruction line and sends no request for %s", async (_label, instruction) => {
    mount();

    const sheet = await openEditor();
    await userEvent.clear(within(sheet).getByLabelText("Instruction"));
    await userEvent.click(within(sheet).getByLabelText("Instruction"));
    await userEvent.paste(instruction);
    await userEvent.click(within(sheet).getByRole("button", { name: "Save variant" }));

    expect(await within(sheet).findByRole("alert")).toHaveTextContent(
      "gateway.request.validation_failed The instruction is blank or above 32768 bytes.",
    );
    expect(
      within(sheet).getByRole("textbox", {
        name: "Instruction",
        description: /gateway\.request\.validation_failed The instruction is blank/,
      }),
    ).toHaveValue(instruction);
    expect(agentApi.updateAgentVariant).not.toHaveBeenCalled();
  });

  it.each(["Café", "a  b"])(
    "shows the name line and sends no request for the name %j",
    async (value) => {
      mount();

      const sheet = await openEditor();
      const name = within(sheet).getByLabelText("Display name");
      await userEvent.clear(name);
      await userEvent.type(name, value);
      await userEvent.click(within(sheet).getByRole("button", { name: "Save variant" }));

      expect(await within(sheet).findByRole("alert")).toHaveTextContent(
        "1 to 40 letters, digits, spaces, _ or -, starting with a letter.",
      );
      expect(agentApi.updateAgentVariant).not.toHaveBeenCalled();
    },
  );

  it("deletes behind a confirmation with the current revision and opens the agents page", async () => {
    vi.mocked(agentApi.deleteAgentVariant).mockResolvedValue(undefined);
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
    expect(agentApi.deleteAgentVariant).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete Software Architecture" }),
    );

    expect(agentApi.deleteAgentVariant).toHaveBeenCalledWith("agent_variant_1", 1);
    expect(await screen.findByText("Page /agents")).toBeTruthy();
  });

  it("shows the in-use line and keeps the variant when the delete is refused", async () => {
    vi.mocked(agentApi.deleteAgentVariant).mockRejectedValue(
      new ApiError("conflict", "A session uses it.", 409, "agent.variant.in_use"),
    );
    mount();

    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
    const dialog = await screen.findByRole("alertdialog");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Delete Software Architecture" }),
    );

    const line = await within(dialog).findByRole("alert");
    expect(line).toHaveTextContent(
      "agent.variant.in_use This variant has sessions. Rename it or change its instruction.",
    );
    expect(screen.queryByText("Page /agents")).toBeNull();
    expect(screen.getByText("Software Architecture (v1)")).toBeTruthy();
  });

  it("shows the not-found state for an unknown variant", async () => {
    vi.mocked(agentApi.readAgentVariant).mockRejectedValue(
      new ApiError("not_found", "The variant does not exist.", 404, "agent.variant.not_found"),
    );
    mount();

    expect(await screen.findByText("Variant not found.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Back to agents" })).toHaveAttribute(
      "href",
      "/agents",
    );
    expect(agentApi.readAgentVariantPrompt).not.toHaveBeenCalled();
  });

  it("shows the not-found state for a malformed variant id", async () => {
    vi.mocked(agentApi.readAgentVariant).mockRejectedValue(
      new ApiError(
        "malformed",
        "Request validation failed.",
        400,
        "gateway.request.validation_failed",
        [{ path: ["params", "variant_id"], code: "custom" }],
      ),
    );
    mount();

    expect(await screen.findByText("Variant not found.")).toBeTruthy();
    expect(agentApi.readAgentVariantPrompt).not.toHaveBeenCalled();
  });

  it("shows the not-found state for a variant of another agent", async () => {
    mount("/agents/re%401/variants/agent_variant_1");

    expect(await screen.findByText("Variant not found.")).toBeTruthy();
    expect(agentApi.readAgentVariantPrompt).not.toHaveBeenCalled();
  });

  it("reports another failed read with a retry", async () => {
    vi.mocked(agentApi.readAgentVariant).mockRejectedValue(
      new ApiError("unavailable", "The daemon did not answer.", 503),
    );
    mount();

    expect(await screen.findByText("The daemon did not answer.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});
