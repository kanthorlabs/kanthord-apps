import { describe, expect, it } from "vitest";

import type { PromptSource } from "@/api/types";
import { hiddenSourcesLabel, isInactiveSource, sourceKey } from "./prompt-visibility";

function sourceOf(source: string, state: PromptSource["state"]): PromptSource {
  return { source, origin: "file", path: null, enabled: true, state, digest: null, text: null };
}

describe("prompt visibility", () => {
  it("treats an absent or an off source as inactive", () => {
    expect(isInactiveSource(sourceOf("agents_md", "absent"))).toBe(true);
    expect(isInactiveSource(sourceOf("agents_md", "off"))).toBe(true);
    expect(isInactiveSource(sourceOf("agents_md", "present"))).toBe(false);
    expect(isInactiveSource(sourceOf("agents_md", "deferred"))).toBe(false);
  });

  it("keeps an invalid source active, because it needs attention", () => {
    expect(isInactiveSource(sourceOf("agents_md", "invalid"))).toBe(false);
  });

  it("keeps the custom source active, because its row holds the editor of its text", () => {
    expect(isInactiveSource(sourceOf("custom", "absent"))).toBe(false);
    expect(isInactiveSource(sourceOf("custom", "off"))).toBe(false);
  });

  it("keys a source by its layer", () => {
    expect(sourceKey("working", sourceOf("shipped", "present"))).toBe("working:shipped");
  });

  it("names the count of hidden sources", () => {
    expect(hiddenSourcesLabel(1)).toBe("1 inactive source hidden");
    expect(hiddenSourcesLabel(2)).toBe("2 inactive sources hidden");
  });
});
