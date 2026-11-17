import type { ChatItem } from "@/lib/workbench-chat";

interface GuestActionEntryProps {
  readonly item: Extract<ChatItem, { kind: "guest-action" }>;
}

export function GuestActionEntry({ item }: GuestActionEntryProps) {
  return (
    <div
      role="group"
      aria-label="Action"
      className="flex max-w-[92%] min-w-0 flex-col gap-1.5 rounded-md border border-primary bg-card px-3 py-2.5 text-card-foreground"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="rounded-full bg-primary/10 px-2 py-px text-[11.5px] text-primary">
          Action
        </span>
        <span className="min-w-0 font-mono text-[12.5px] font-medium break-all">
          {item.operation_id}
        </span>
      </div>
      <p className="text-[12.5px] wrap-anywhere">{item.target_id}</p>
      {item.result !== null && <p className="text-sm">{item.result}</p>}
    </div>
  );
}
