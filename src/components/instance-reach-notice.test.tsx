import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { InstanceReachNotice } from "./instance-reach-notice";

describe("InstanceReachNotice", () => {
  it("names both projects of an instance that serves two projects", () => {
    render(<InstanceReachNotice instance="mac-studio" projects={["kanthord", "atlas"]} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "mac-studio serves kanthord and atlas. A tool of either project can read its key and its workspaces.",
    );
  });

  it("names every project of an instance that serves three projects", () => {
    render(<InstanceReachNotice instance="mac-studio" projects={["a", "b", "c"]} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "mac-studio serves a, b and c. A tool of any of these projects can read its key and its workspaces.",
    );
  });

  it("renders nothing for one project", () => {
    const { container } = render(<InstanceReachNotice instance="mac-studio" projects={["a"]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
