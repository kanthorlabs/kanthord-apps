import Markdown from "react-markdown";

export function MarkdownText({ text }: { text: string }) {
  return (
    <div className="prose prose-sm prose-zinc dark:prose-invert max-w-full min-w-0">
      <Markdown>{text}</Markdown>
    </div>
  );
}
