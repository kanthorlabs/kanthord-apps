import { useState } from "react";

import { TouchTarget } from "@/components/touch-target";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Project } from "@/api/types";
import { filterMessageOf, filterNameOf, pickedProjectIdOf } from "@/lib/board-filter";
import type { BoardTab } from "@/lib/board-tabs";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";

import type { BoardCounts } from "../use-board";

const ALL = "all";
const ITEM_TOUCH = "min-h-11 lg:min-h-0";

interface BoardFilterProps {
  readonly projects: readonly Project[];
  readonly counts: BoardCounts;
  readonly projectId: string | null;
  readonly tab: BoardTab;
  readonly widthClass: BoardWidth;
  readonly onChange: (projectId: string | null) => void;
}

export function BoardFilter({
  projects,
  counts,
  projectId,
  tab,
  widthClass,
  onChange,
}: BoardFilterProps) {
  const [changed, setChanged] = useState(false);
  const name = filterNameOf(projects, projectId);
  const compact = widthClass === BOARD_WIDTH.Compact;

  return (
    <div className="flex min-w-0 flex-col">
      <div className={compact ? "max-w-full overflow-x-auto" : undefined}>
        <TouchTarget>
          <ToggleGroup
            variant="outline"
            size="sm"
            aria-label="Show the acts of"
            className={compact ? undefined : "flex-wrap"}
            value={[projectId ?? ALL]}
            onValueChange={(next: string[]) => {
              setChanged(true);
              onChange(pickedProjectIdOf(projects, next[0]));
            }}
          >
            <ToggleGroupItem value={ALL} className={ITEM_TOUCH}>
              All · {counts.all}
            </ToggleGroupItem>
            {projects.map((project) => (
              <ToggleGroupItem key={project.id} value={project.id} className={ITEM_TOUCH}>
                {project.name} · {counts.projects[project.id] ?? 0}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </TouchTarget>
      </div>
      <p role="status" className="sr-only">
        {changed ? filterMessageOf(name, tab, counts.tabs[tab.id], counts.view) : ""}
      </p>
    </div>
  );
}
