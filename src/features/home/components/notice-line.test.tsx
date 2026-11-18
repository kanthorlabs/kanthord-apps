import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { NoticeLine } from "./notice-line";

describe("NoticeLine", () => {
  it("shows the notice text and the Open chat link", () => {
    render(
      <MemoryRouter>
        <NoticeLine
          notice={{ sessionId: "session_1", text: "Release plan: atlas · 3 Completed" }}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText("Release plan: atlas · 3 Completed")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open chat" })).toHaveAttribute(
      "href",
      "/workbench/session_1",
    );
  });
});
