import type { ReactNode } from "react";

import { TouchTarget } from "@/components/touch-target";
import { Badge } from "@/components/ui/badge";
import { Kbd } from "@/components/ui/kbd";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BOARD_TABS, boardTabById, type BoardTabId } from "@/lib/board-tabs";
import { tabLabelOf, tabSubOf } from "@/lib/board-text";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";

import type { BoardCounts } from "../use-board";
import { useShortcutSetting } from "../use-shortcut-setting";

interface BoardTabsProps {
  readonly tab: BoardTabId;
  readonly counts: BoardCounts;
  readonly allProjects: boolean;
  readonly widthClass: BoardWidth;
  readonly onChange: (tab: BoardTabId) => void;
  readonly children: ReactNode;
}

export function BoardTabs({
  tab,
  counts,
  allProjects,
  widthClass,
  onChange,
  children,
}: BoardTabsProps) {
  const expanded = widthClass === BOARD_WIDTH.Expanded;
  const sticky = !expanded;
  const { enabled } = useShortcutSetting();
  return (
    <Tabs
      value={tab}
      className={expanded ? "flex min-h-0 min-w-0 flex-1 flex-col" : "flex min-w-0 flex-col"}
      onValueChange={(value) => {
        const next = boardTabById(value);
        if (next !== undefined) onChange(next.id);
      }}
    >
      <div
        className={sticky ? "sticky top-[var(--app-header-height)] z-10 bg-background" : undefined}
      >
        <TouchTarget>
          <TabsList
            variant="line"
            activateOnFocus
            className="w-full group-data-horizontal/tabs:h-auto @max-[760px]:grid @max-[760px]:grid-cols-6"
          >
            {BOARD_TABS.map((entry) => {
              const count = counts.tabs[entry.id];
              return (
                <TabsTrigger
                  key={entry.id}
                  value={entry.id}
                  aria-label={tabLabelOf(entry, count, allProjects)}
                  aria-keyshortcuts={enabled ? entry.key : undefined}
                  className="min-w-0"
                >
                  <span className="flex min-w-0 flex-col items-center gap-0.5">
                    <span className="flex items-center gap-1.5 @max-[760px]:flex-col-reverse">
                      <span className="@max-[760px]:hidden">{entry.name}</span>
                      <span className="text-xs @min-[760px]:hidden">{entry.short}</span>
                      <Badge variant="secondary">{count}</Badge>
                      {enabled && (
                        <span className="@max-[760px]:hidden [@media(hover:none)]:hidden">
                          <Kbd>{entry.key}</Kbd>
                        </span>
                      )}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground @max-[760px]:hidden">
                      {tabSubOf(entry, counts.held[entry.id], count, allProjects)}
                    </span>
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </TouchTarget>
      </div>
      {children}
    </Tabs>
  );
}
