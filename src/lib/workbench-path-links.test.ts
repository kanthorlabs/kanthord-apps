import { describe, expect, it } from "vitest";

import { type MarkdownNode, remarkWorkbenchPaths } from "./workbench-path-links";

function paragraph(...children: MarkdownNode[]): MarkdownNode {
  return { type: "root", children: [{ type: "paragraph", children }] };
}

describe("remarkWorkbenchPaths", () => {
  it("splits a text node into text and a link at the exact bounds of a path", () => {
    const tree = paragraph({ type: "text", value: "Open /missions/checkout/nodes/node_42 now." });

    remarkWorkbenchPaths()(tree);

    expect(tree.children?.[0]?.children).toEqual([
      { type: "text", value: "Open " },
      {
        type: "link",
        url: "/missions/checkout/nodes/node_42",
        children: [{ type: "text", value: "/missions/checkout/nodes/node_42" }],
      },
      { type: "text", value: " now." },
    ]);
  });

  it("keeps a text node with a slash command", () => {
    const tree = paragraph({ type: "text", value: "Run /brief or /health." });

    remarkWorkbenchPaths()(tree);

    expect(tree.children?.[0]?.children).toEqual([
      { type: "text", value: "Run /brief or /health." },
    ]);
  });

  it("leaves inline code and the text of an existing link alone", () => {
    const code = { type: "inlineCode", value: "/missions/a/b" };
    const link = {
      type: "link",
      url: "https://example.com",
      children: [{ type: "text", value: "/missions/a/b" }],
    };
    const tree = paragraph(code, link);

    remarkWorkbenchPaths()(tree);

    expect(tree.children?.[0]?.children).toEqual([code, link]);
  });
});
