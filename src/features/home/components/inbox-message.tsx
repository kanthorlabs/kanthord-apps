import { type InboxAttentionItem, inboxHrefOf, NO_TEXT } from "@/lib/inbox-attention";
import { utcDateTime } from "@/lib/format";

const TEXT_WIDTH = "max-w-[80ch] break-words";

export function InboxMessage({ item }: { readonly item: InboxAttentionItem }) {
  const { content } = item.inbox;
  if (content === null)
    return <p className={`text-sm text-muted-foreground ${TEXT_WIDTH}`}>{NO_TEXT}</p>;
  const href = inboxHrefOf(content.url);
  return (
    <>
      <p className="text-sm font-medium break-words">
        {content.author} · {utcDateTime(content.occurred_at)}
      </p>
      <p className={`text-sm whitespace-pre-wrap ${TEXT_WIDTH}`}>{content.body}</p>
      {href === null ? (
        <p className={`text-sm text-muted-foreground ${TEXT_WIDTH}`}>{content.url}</p>
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-sm break-all underline underline-offset-4"
        >
          {content.url}
        </a>
      )}
    </>
  );
}
