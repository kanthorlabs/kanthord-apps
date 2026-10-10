import { render, type MatcherFunction } from "@testing-library/react";
import type { ReactNode } from "react";

export function textContent(text: string | RegExp): MatcherFunction {
  const matches = (value: string | null) =>
    value !== null && (typeof text === "string" ? value === text : text.test(value));
  return (_content, element) =>
    element !== null &&
    matches(element.textContent) &&
    !Array.from(element.children).some((child) => matches(child.textContent));
}

export function renderedText(node: ReactNode): { text: string; bold: readonly string[] } {
  const { container, unmount } = render(node);
  const text = container.textContent;
  const bold = Array.from(container.querySelectorAll("strong"), (element) => element.textContent);
  unmount();
  return { text, bold };
}
