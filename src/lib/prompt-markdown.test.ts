import { describe, expect, it } from "vitest";

import { promptMarkdown } from "./prompt-markdown";

describe("promptMarkdown", () => {
  it("shows each layer tag line as inline code in its own paragraph", () => {
    const text =
      'Framing.\n<prompt-layer name="system layer" owner="o" source="s">\n# Rules\nBe brief.\n</prompt-layer>';
    expect(promptMarkdown(text)).toBe(
      'Framing.\n\n`<prompt-layer name="system layer" owner="o" source="s">`\n\n# Rules\nBe brief.\n\n`</prompt-layer>`\n',
    );
  });

  it("keeps a tag inside a line of prose", () => {
    const text = "Use the <prompt-layer> tag.";
    expect(promptMarkdown(text)).toBe(text);
  });
});
