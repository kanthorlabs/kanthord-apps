import type { Options } from "react-markdown";

import { MarkdownText } from "@/components/markdown-text";
import { workbenchPathsIn } from "@/lib/workbench-chat";
import { remarkWorkbenchPaths } from "@/lib/workbench-path-links";
import { openWorkbenchUrl, workbenchUrl } from "./workbench-url";

const REMARK_PLUGINS = [remarkWorkbenchPaths];

function isWorkbenchPath(href: string): boolean {
  const [match] = workbenchPathsIn(href);
  return match !== undefined && match.start === 0 && match.end === href.length;
}

const COMPONENTS: Options["components"] = {
  a({ href, children }) {
    if (href === undefined || !isWorkbenchPath(href)) return <a href={href}>{children}</a>;
    const url = workbenchUrl(href);
    return (
      <a
        href={url}
        onClick={(event) => {
          event.preventDefault();
          openWorkbenchUrl(url);
        }}
      >
        {children}
      </a>
    );
  },
};

export function AgentText({ text }: { text: string }) {
  return <MarkdownText text={text} components={COMPONENTS} remarkPlugins={REMARK_PLUGINS} />;
}
