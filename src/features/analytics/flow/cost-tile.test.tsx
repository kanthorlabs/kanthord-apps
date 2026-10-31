import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FlowRead } from "@/api/types";
import { frameOf } from "@/lib/flow-status";
import { scorecardOf, type ScorecardTile } from "@/lib/flow-tiles";

import flowRead from "../../../../test/flow-read.json";
import { CostTile } from "./cost-tile";
import { Sparkline } from "./sparkline";

vi.mock("./sparkline", () => ({ Sparkline: vi.fn(() => null) }));

const FLOW_READ = flowRead as unknown as FlowRead;
const TILES = scorecardOf(FLOW_READ, frameOf(FLOW_READ, "7d")).rows.flatMap((row) => row.tiles);

function tileOf(label: string): ScorecardTile {
  const tile = TILES.find((candidate) => candidate.label === label);
  if (tile === undefined) throw new Error(`No tile ${label}`);
  return tile;
}

function renderTile(label: string) {
  return render(
    <MemoryRouter>
      <CostTile tile={tileOf(label)} />
    </MemoryRouter>,
  );
}

function sparkProps(): Record<string, unknown> {
  const call = vi.mocked(Sparkline).mock.calls.at(-1);
  if (call === undefined) throw new Error("No Sparkline render");
  return call[0] as unknown as Record<string, unknown>;
}

beforeEach(() => {
  vi.mocked(Sparkline).mockClear();
});

describe("CostTile", () => {
  it("links to the target of the tile and shows the label, the value and the delta", () => {
    renderTile("Cost per success");

    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", tileOf("Cost per success").target);
    expect(screen.getByText("Cost per success")).toBeInTheDocument();
    expect(screen.getByText("$2.26")).toBeInTheDocument();
    expect(screen.getByText("+9.9 %")).toBeInTheDocument();
    expect(screen.getByText("ended · Oct 27 $3.01 > $2.57")).toBeInTheDocument();
  });

  it("shows the bad icon on the active cache hit tile", () => {
    renderTile("Cache hit ratio");

    expect(screen.getByRole("img", { name: "Cache hit ratio status bad" })).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      expect.stringContaining("model=gpt-5-codex"),
    );
  });

  it("shows no icon on an ended status tile", () => {
    renderTile("Cost per success");

    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows no delta when the tile has none", () => {
    const tile: ScorecardTile = { ...tileOf("Total cost"), delta: null };
    render(
      <MemoryRouter>
        <CostTile tile={tile} />
      </MemoryRouter>,
    );

    expect(screen.queryByText(/%$/)).toBeNull();
  });

  it("passes the bounds of a status tile to the Sparkline", () => {
    renderTile("Cache hit ratio");

    expect(sparkProps()).toMatchObject({ warn: 0.6, bad: 0.4, partial: true });
  });

  it("passes the slice series as the second line", () => {
    renderTile("Cache hit ratio");

    expect(sparkProps().slice).toEqual({
      key: "gpt-5-codex",
      values: [0.71, 0.7, 0.72, 0.71, 0.34, 0.32, 0.31],
      severity: "bad",
    });
  });

  it("passes no bound and no slice for a context tile", () => {
    renderTile("Total cost");

    expect(sparkProps()).toMatchObject({ warn: undefined, bad: undefined, slice: undefined });
  });
});
