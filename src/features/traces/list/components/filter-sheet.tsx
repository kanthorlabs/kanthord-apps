import { useState } from "react";

import type { Project, TraceFacets } from "@/api/types";
import { ProjectFilter } from "@/components/project-filter";
import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

import { timeWindowOf } from "@/lib/trace-query";

import { useFilterDraft } from "../use-filter-draft";
import { MoreFilters } from "./more-filters";
import { RangeFilter } from "./range-filter";

interface DraftFiltersProps {
  readonly projects: readonly Project[];
  readonly facets: TraceFacets | null;
  readonly params: URLSearchParams;
  readonly durationSeconds: string;
  readonly onApply: (draft: URLSearchParams, durationSeconds: string) => void;
}

function DraftFilters({ projects, facets, params, durationSeconds, onApply }: DraftFiltersProps) {
  const draft = useFilterDraft(params, durationSeconds);
  return (
    <>
      <div className="flex flex-col gap-3 px-4">
        <TouchTarget>
          <ProjectFilter
            projects={projects}
            value={draft.params.get("project_id")}
            onChange={draft.setters.project_id}
          />
        </TouchTarget>
        <RangeFilter
          value={draft.params.get("range")}
          window={timeWindowOf(draft.params)}
          onChange={draft.setters.range}
        />
        <MoreFilters
          facets={facets}
          params={draft.params}
          setters={draft.setters}
          durationSeconds={draft.durationSeconds}
          onDurationSeconds={draft.setDurationSeconds}
        />
      </div>
      <SheetFooter>
        <TouchTarget>
          <Button onClick={() => onApply(draft.params, draft.durationSeconds)}>Apply</Button>
        </TouchTarget>
      </SheetFooter>
    </>
  );
}

export function FilterSheet({ onApply, ...rest }: DraftFiltersProps) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <TouchTarget>
        <SheetTrigger render={<Button variant="outline" className="w-full" />}>
          Filters
        </SheetTrigger>
      </TouchTarget>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Choose the filters, then apply them together.</SheetDescription>
        </SheetHeader>
        <DraftFilters
          {...rest}
          onApply={(draft, seconds) => {
            onApply(draft, seconds);
            setOpen(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
