import { useId, useState } from "react";

import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { Reveal } from "@/components/reveal";
import { Badge } from "@/components/ui/badge";
import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";
import type { DoneEntry } from "@/lib/board-done";
import type { BoardTabId } from "@/lib/board-tabs";

interface BoardDoneProps {
  readonly entries: readonly DoneEntry[];
  readonly onGoTo: (tab: BoardTabId) => void;
}

const TITLE = "Done this session";

function GoToButton({
  goTo,
  onGoTo,
}: {
  readonly goTo: NonNullable<DoneEntry["goTo"]>;
  readonly onGoTo: (tab: BoardTabId) => void;
}) {
  return (
    <TouchTarget>
      <Button variant="outline" size="sm" onClick={() => onGoTo(goTo.tab)}>
        {goTo.label}
      </Button>
    </TouchTarget>
  );
}

export function BoardDone({ entries, onGoTo }: BoardDoneProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  if (entries.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(!open)}
        >
          {TITLE}
          <Badge variant="secondary">{entries.length}</Badge>
        </Button>
      </h3>
      <div id={panelId}>
        <Reveal open={open}>
          <DataList
            label={`${TITLE}, entries`}
            items={entries}
            getKey={(entry) => entry.itemId}
            renderItem={(entry) => (
              <DataListItem
                title={entry.text}
                description={entry.sentAt}
                notice={entry.note}
                actions={
                  entry.goTo === undefined ? undefined : (
                    <GoToButton goTo={entry.goTo} onGoTo={onGoTo} />
                  )
                }
                status={entry.projects.map((project) => (
                  <Badge key={project.id} variant="outline">
                    {project.name}
                  </Badge>
                ))}
              />
            )}
            status="ready"
            error={null}
            pending={false}
            emptyText="Nothing done this session."
          />
        </Reveal>
      </div>
    </div>
  );
}
