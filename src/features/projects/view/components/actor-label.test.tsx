import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ActorLabel } from "./actor-label";

describe("ActorLabel", () => {
  it("renders the name of a human in bold beside the account", () => {
    const { container } = render(
      <ActorLabel actor={{ kind: "human", account: "ulrich", name: "Ulrich" }} />,
    );

    expect(container.textContent).toBe("Ulrich (ulrich)");
    expect(screen.getByText("Ulrich").tagName).toBe("STRONG");
  });

  it("keeps an execution without a name as its regular id", () => {
    const { container } = render(
      <ActorLabel
        actor={{ kind: "execution", execution_id: "execution_1", client_id: null, name: null }}
      />,
    );

    expect(container.textContent).toBe("execution_1");
    expect(container.querySelector("strong")).toBeNull();
  });
});
