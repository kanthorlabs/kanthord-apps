import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { TouchTarget } from "@/components/touch-target";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { AttentionDetails } from "@/lib/attention";
import { BOARD_TABS, type BoardTabId } from "@/lib/board-tabs";
import { deckRowTextOf } from "@/lib/deck-card";
import { DECK_PAGE_SIZE } from "@/lib/home-deck";

import type { DeckListView } from "../use-home-deck";

const ALL = "all";

interface DeckListProps {
  readonly id: string;
  readonly list: DeckListView;
  readonly details: AttentionDetails;
  readonly now: number;
  readonly onQuery: (query: string) => void;
  readonly onTab: (tab: BoardTabId | null) => void;
  readonly onMore: () => void;
  readonly onSelect: (itemId: string) => void;
}

function tabOfValues(values: readonly string[]): BoardTabId | null {
  return BOARD_TABS.find((tab) => tab.id === values[0])?.id ?? null;
}

export function DeckList({
  id,
  list,
  details,
  now,
  onQuery,
  onTab,
  onMore,
  onSelect,
}: DeckListProps) {
  return (
    <div id={id} className="flex min-w-0 flex-col gap-3">
      <Input
        type="search"
        aria-label="Search the waiting items"
        placeholder="Search subject, cause, author or project"
        value={list.query}
        onChange={(event) => onQuery(event.target.value)}
      />
      <ToggleGroup
        aria-label="Filter by tab"
        variant="outline"
        size="sm"
        className="flex-wrap"
        value={[list.tab ?? ALL]}
        onValueChange={(values) => onTab(tabOfValues(values))}
      >
        <TouchTarget>
          <ToggleGroupItem value={ALL}>All {list.total}</ToggleGroupItem>
        </TouchTarget>
        {list.tabs.map(({ tab, count }) => (
          <TouchTarget key={tab.id}>
            <ToggleGroupItem value={tab.id}>
              {tab.short} {count}
            </ToggleGroupItem>
          </TouchTarget>
        ))}
      </ToggleGroup>
      <DataList
        label="Waiting items"
        items={list.rows}
        getKey={({ item }) => item.id}
        status="ready"
        error={null}
        pending={false}
        emptyText="No waiting item matches."
        renderItem={({ item, rank }) => {
          const text = deckRowTextOf(item, details, now);
          return (
            <DataListItem
              title={item.subject}
              status={<Badge variant="secondary">#{rank}</Badge>}
              description={text.cause}
              notice={
                <p className="text-sm text-muted-foreground">
                  {text.tab} {text.waiting}
                </p>
              }
              select={{
                label: item.subject,
                disabled: false,
                onSelect: () => onSelect(item.id),
              }}
            />
          );
        }}
      />
      {list.hasMore && (
        <div>
          <TouchTarget>
            <Button variant="outline" size="sm" onClick={onMore}>
              Show {DECK_PAGE_SIZE} more
            </Button>
          </TouchTarget>
        </div>
      )}
    </div>
  );
}
