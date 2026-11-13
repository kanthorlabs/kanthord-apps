import { workbenchPathsIn } from "./workbench-chat";

export interface MarkdownNode {
  type: string;
  value?: string;
  url?: string;
  children?: MarkdownNode[];
}

function linkedNodes(text: string): MarkdownNode[] {
  const nodes: MarkdownNode[] = [];
  let cursor = 0;
  for (const match of workbenchPathsIn(text)) {
    if (match.start > cursor) nodes.push({ type: "text", value: text.slice(cursor, match.start) });
    nodes.push({
      type: "link",
      url: match.path,
      children: [{ type: "text", value: match.path }],
    });
    cursor = match.end;
  }
  if (cursor < text.length) nodes.push({ type: "text", value: text.slice(cursor) });
  return nodes;
}

function linkPaths(parent: MarkdownNode): void {
  if (parent.type === "link" || parent.children === undefined) return;
  parent.children = parent.children.flatMap((child) => {
    if (child.type !== "text" || child.value === undefined) {
      linkPaths(child);
      return [child];
    }
    return linkedNodes(child.value);
  });
}

export function remarkWorkbenchPaths() {
  return linkPaths;
}
