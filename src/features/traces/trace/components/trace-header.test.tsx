import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import type { TraceSummary } from "@/api/types";

import { TraceHeader } from "./trace-header";

const SUMMARY = {
  trace_id: "trace-1",
  project_id: "project_1",
  execution_id: "execution_1",
  node_id: "node_1",
  attempt: 1,
  state: "ok",
  started_at: null,
  duration_ms: 1000,
  stop_reason: null,
  worker_name: null,
  input_tokens: 0,
  output_tokens: 0,
  cache_read_tokens: 0,
  cache_creation_tokens: 0,
  total_tokens: 0,
  cost_usd: 0,
} as TraceSummary;

function mount(nodeName: string | null) {
  return render(
    <MemoryRouter>
      <TraceHeader
        summary={SUMMARY}
        title="Investigate its cause"
        nodeName={nodeName}
        projectName="kanthord"
        live={false}
        paused={false}
        onTogglePaused={vi.fn()}
      />
    </MemoryRouter>,
  );
}

describe("TraceHeader", () => {
  it("wraps the title at word boundaries", () => {
    mount("Investigate");

    const title = screen.getByRole("heading", { level: 2, name: "Investigate its cause" });
    expect(title).toHaveClass("break-words");
    expect(title).not.toHaveClass("break-all");
  });
});
