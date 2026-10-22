import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

import { TIMELINE_GROUPS, type Timeline } from "../use-timeline";

const GROUP_LABELS: Readonly<Record<(typeof TIMELINE_GROUPS)[number], string>> = {
  all: "All",
  agent: "Agent",
  tools: "Tools",
  checks: "Checks",
  git: "Git",
};

interface TimelineToolbarProps {
  readonly timeline: Timeline;
}

export function TimelineToolbar({ timeline }: TimelineToolbarProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
      <div className="w-full md:w-64">
        <Input
          aria-label="Search spans"
          placeholder="Search spans"
          value={timeline.search}
          onChange={(event) => timeline.setSearch(event.target.value)}
        />
      </div>
      <Toggle
        variant="outline"
        className="w-full md:w-auto"
        pressed={timeline.errorsOnly}
        onPressedChange={timeline.setErrorsOnly}
      >
        Errors only
      </Toggle>
      <ToggleGroup
        variant="outline"
        spacing={0}
        className="flex-wrap"
        value={[timeline.group]}
        onValueChange={(values) =>
          timeline.setGroup(TIMELINE_GROUPS.find((group) => group === values[0]) ?? "all")
        }
      >
        {TIMELINE_GROUPS.map((group) => (
          <ToggleGroupItem key={group} value={group}>
            {GROUP_LABELS[group]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <Button variant="outline" className="w-full md:w-auto" onClick={timeline.expandAll}>
        Expand all
      </Button>
      <Button variant="outline" className="w-full md:w-auto" onClick={timeline.collapseAll}>
        Collapse all
      </Button>
    </div>
  );
}
