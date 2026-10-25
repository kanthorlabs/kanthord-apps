import { useState } from "react";

import { Reveal } from "@/components/reveal";
import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toggle } from "@/components/ui/toggle";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { StepPill } from "@/lib/step-tree";

import type { Timeline } from "../use-timeline";

const OTHER_PILLS: readonly { readonly pill: StepPill; readonly label: string }[] = [
  { pill: StepPill.Slow, label: "Slow" },
  { pill: StepPill.Agent, label: "Agent" },
  { pill: StepPill.Checks, label: "Checks" },
  { pill: StepPill.Git, label: "Git" },
];

interface TimelineToolbarProps {
  readonly timeline: Timeline;
}

export function TimelineToolbar({ timeline }: TimelineToolbarProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const pills = [{ pill: StepPill.Errors, label: `Errors ${timeline.errorCount}` }, ...OTHER_PILLS];
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="-m-1 min-w-0 overflow-x-auto p-1">
        <ToggleGroup
          variant="outline"
          aria-label="Step filters"
          value={timeline.pill === null ? [] : [timeline.pill]}
          onValueChange={(values) =>
            timeline.setPill(pills.find((entry) => entry.pill === values[0])?.pill ?? null)
          }
        >
          {pills.map((entry) => (
            <TouchTarget key={entry.pill}>
              <ToggleGroupItem value={entry.pill}>{entry.label}</ToggleGroupItem>
            </TouchTarget>
          ))}
        </ToggleGroup>
      </div>
      <div className="flex min-w-0 items-center gap-2">
        <div className="min-w-0 flex-1 md:max-w-64">
          <TouchTarget>
            <Input
              aria-label="Search spans"
              placeholder="Search spans"
              value={timeline.search}
              onChange={(event) => timeline.setSearch(event.target.value)}
            />
          </TouchTarget>
        </div>
        <TouchTarget>
          <Button
            variant="outline"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((open) => !open)}
          >
            More
          </Button>
        </TouchTarget>
      </div>
      <Reveal open={moreOpen}>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <TouchTarget>
            <Button variant="outline" onClick={timeline.expandAll}>
              Expand all
            </Button>
          </TouchTarget>
          <TouchTarget>
            <Button variant="outline" onClick={timeline.collapseAll}>
              Collapse all
            </Button>
          </TouchTarget>
          <TouchTarget>
            <Toggle
              variant="outline"
              disabled={timeline.pill !== StepPill.Errors}
              pressed={timeline.allErrors}
              onPressedChange={timeline.setAllErrors}
            >
              All errors
            </Toggle>
          </TouchTarget>
        </div>
      </Reveal>
    </div>
  );
}
