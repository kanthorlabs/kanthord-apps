import { utcDateTime } from "@/lib/format";

interface BubbleAuthorProps {
  readonly name: string;
  readonly timestamp: number | null;
}

export function BubbleAuthor({ name, timestamp }: BubbleAuthorProps) {
  return (
    <div className="flex min-w-0 items-baseline gap-2 text-xs">
      <span className="font-medium break-words">{name}</span>
      {timestamp !== null && (
        <time dateTime={new Date(timestamp).toISOString()} className="text-muted-foreground">
          {utcDateTime(timestamp)}
        </time>
      )}
    </div>
  );
}
