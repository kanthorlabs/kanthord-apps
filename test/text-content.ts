import type { MatcherFunction } from "@testing-library/react";

export function textContent(text: string | RegExp): MatcherFunction {
  const matches = (value: string | null) =>
    value !== null && (typeof text === "string" ? value === text : text.test(value));
  return (_content, element) =>
    element !== null &&
    matches(element.textContent) &&
    !Array.from(element.children).some((child) => matches(child.textContent));
}
