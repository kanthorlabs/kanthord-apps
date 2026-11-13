import Markdown, { type Options } from "react-markdown";

type MarkdownTextProps = Pick<Options, "components" | "remarkPlugins"> & { readonly text: string };

export function MarkdownText({ text, components, remarkPlugins }: MarkdownTextProps) {
  return (
    <div className="prose prose-sm prose-zinc dark:prose-invert max-w-full min-w-0 prose-code:before:content-none prose-code:after:content-none">
      <Markdown components={components} remarkPlugins={remarkPlugins}>
        {text}
      </Markdown>
    </div>
  );
}
