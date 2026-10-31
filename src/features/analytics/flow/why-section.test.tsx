import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { FlowRead } from "@/api/types";
import { flowFiltersOf } from "@/lib/flow-query";

import flowRead from "../../../../test/flow-read.json";
import { WhySection, WhySkeleton } from "./why-section";

const FLOW_READ = flowRead as unknown as FlowRead;

function Search() {
  return <output aria-label="Search">{useLocation().search}</output>;
}

function renderWhy(search = "") {
  return render(
    <MemoryRouter initialEntries={[`/analytics${search}`]}>
      <WhySection read={FLOW_READ} filters={flowFiltersOf(new URLSearchParams(search))} />
      <Search />
    </MemoryRouter>,
  );
}

function rowNames(): readonly (string | null)[] {
  return screen.getAllByRole("rowheader").map((header) => header.textContent);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WhySection", () => {
  it("reads the heading with the number of caused executions", () => {
    renderWhy();

    expect(screen.getByRole("heading", { name: "Why 188 caused executions" })).toBeInTheDocument();
  });

  it("lists the categories with the unattributed row last", () => {
    renderWhy();

    expect(rowNames()).toEqual([
      "▸ llm_provider",
      "▸ model",
      "▸ environment",
      "▸ infrastructure",
      "▸ human",
      "▸ plan",
      "worker_action",
      "unattributed",
    ]);
  });

  it("shows the Unattributed panel", () => {
    renderWhy();

    expect(screen.getByRole("region", { name: "Unattributed" })).toBeInTheDocument();
    expect(screen.getByText("81 of 188 caused")).toBeInTheDocument();
  });

  it("adds the budget exits with Include budget ends", async () => {
    renderWhy();

    await userEvent.setup().click(screen.getByRole("checkbox", { name: "Include budget ends" }));

    expect(screen.getByRole("heading", { name: "Why 211 caused executions" })).toBeInTheDocument();
    expect(screen.getByText("81 of 188 caused")).toBeInTheDocument();
  });

  it("keeps only the rows of the stage of the URL", () => {
    renderWhy("?stage=verification");

    expect(screen.getByRole("heading", { name: "Why 7 caused executions" })).toBeInTheDocument();
    expect(rowNames()).toEqual(["▸ environment", "▸ infrastructure"]);
    expect(screen.getByText("81 of 188 caused")).toBeInTheDocument();
  });

  it("writes the stage with the Stage toggle group on a wide screen", async () => {
    renderWhy();
    const group = screen.getByRole("group", { name: "Stage" });
    expect(
      within(group)
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["All", "Executing", "Verification", "Release gate", "Evaluation", "Outcome"]);

    await userEvent.setup().click(within(group).getByRole("button", { name: "Verification" }));

    expect(screen.getByRole("status", { name: "Search" })).toHaveTextContent("?stage=verification");
  });

  it("removes the stage with All", async () => {
    renderWhy("?stage=verification&range=7d");

    await userEvent
      .setup()
      .click(
        within(screen.getByRole("group", { name: "Stage" })).getByRole("button", { name: "All" }),
      );

    expect(screen.getByRole("status", { name: "Search" })).toHaveTextContent(/^\?range=7d$/);
  });

  it("opens a category with its button and writes the cause", async () => {
    renderWhy();

    await userEvent.setup().click(screen.getByRole("button", { name: "▸ model" }));

    expect(screen.getByRole("status", { name: "Search" })).toHaveTextContent("?cause=model");
  });

  it("shows the details of the cause of the URL and closes it with the same button", async () => {
    renderWhy("?cause=model");
    const button = screen.getByRole("button", { name: "▸ model" });

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("list", { name: "Details of model" })).toBeInTheDocument();

    await userEvent.setup().click(button);

    expect(screen.getByRole("status", { name: "Search" })).toHaveTextContent(/^$/);
  });

  it("replaces the toggle group with a Stage select below 768 px", async () => {
    vi.stubGlobal("innerWidth", 390);
    renderWhy();

    expect(screen.queryByRole("group", { name: "Stage" })).toBeNull();
    await userEvent.setup().click(screen.getByRole("combobox", { name: "Stage" }));
    await userEvent.setup().click(await screen.findByRole("option", { name: "Outcome" }));

    expect(screen.getByRole("status", { name: "Search" })).toHaveTextContent("?stage=outcome");
  });

  it("puts the panel before the Pareto below 768 px", () => {
    vi.stubGlobal("innerWidth", 390);
    renderWhy();

    const panel = screen.getByRole("region", { name: "Unattributed" });
    const table = screen.getByRole("table", { name: "Causes" });
    expect(panel.compareDocumentPosition(table)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it("puts the Pareto before the panel on a wide screen", () => {
    renderWhy();

    const panel = screen.getByRole("region", { name: "Unattributed" });
    const table = screen.getByRole("table", { name: "Causes" });
    expect(table.compareDocumentPosition(panel)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});

describe("WhySkeleton", () => {
  it("announces the loading state", () => {
    render(<WhySkeleton />);

    expect(screen.getByRole("status", { name: "Loading the causes" })).toBeInTheDocument();
  });
});
