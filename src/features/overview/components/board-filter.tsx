import { useState } from "react";

import { TouchTarget } from "@/components/touch-target";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { Project } from "@/api/types";
import type { BoardTab } from "@/lib/board-tabs";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";
import { counted } from "@/lib/counted";

import type { BoardCounts } from "../use-board";

const ALL = "all";
const ALL_PROJECTS = "All projects";

interface BoardFilterProps {
  readonly projects: readonly Project[];
  readonly counts: BoardCounts;
  readonly projectId: string | null;
  readonly tab: BoardTab;
  readonly widthClass: BoardWidth;
  readonly onChange: (projectId: string | null) => void;
}

function messageOf(name: string, tab: BoardTab, tabCount: number, viewCount: number): string {
  return `${name}: ${counted(tabCount, "act", "acts")} in ${tab.name}, ${counted(viewCount, "act", "acts")} in all tabs.`;
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
  const name = projects.find((project) => project.id === projectId)?.name ?? ALL_PROJECTS;
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
              const picked = projects.find((project) => project.id === next[0]);
              setChanged(true);
              onChange(picked?.id ?? null);
            }}
          >
            <ToggleGroupItem value={ALL}>All · {counts.all}</ToggleGroupItem>
            {projects.map((project) => (
              <ToggleGroupItem key={project.id} value={project.id}>
                {project.name} · {counts.projects[project.id] ?? 0}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </TouchTarget>
      </div>
      <p role="status" className="sr-only">
        {changed ? messageOf(name, tab, counts.tabs[tab.id], counts.view) : ""}
      </p>
    </div>
  );
}
