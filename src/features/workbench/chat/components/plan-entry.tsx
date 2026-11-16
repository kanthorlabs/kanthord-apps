import { unresolvedLine } from "@/lib/workbench-chat";
import type { ChatItem } from "@/lib/workbench-chat";
import { AgentAvatar } from "./agent-avatar";
import { AgentText } from "./agent-text";
import { BubbleAuthor } from "./bubble-author";

interface PlanEntryProps {
  readonly item: Extract<ChatItem, { kind: "plan" }>;
}

export function PlanEntry({ item }: PlanEntryProps) {
  const warning = unresolvedLine(item.unresolved);
  return (
    <div className="flex min-w-0 items-start gap-2">
      <AgentAvatar agentName={item.agent_name} displayName={item.author} />
      <div className="flex min-w-0 flex-col items-start gap-1 break-words">
        <BubbleAuthor name={item.author} timestamp={item.timestamp} />
        <div
          data-slot="plan-panel"
          className="flex min-w-0 flex-col items-start gap-2 rounded-md border bg-muted/50 p-3"
        >
          <AgentText text={item.text} />
          {warning !== null && (
            <p className="text-sm text-amber-600 dark:text-amber-500">{warning}</p>
          )}
        </div>
      </div>
    </div>
  );
}
