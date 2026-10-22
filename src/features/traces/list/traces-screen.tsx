import { useState } from "react";

import { DataList } from "@/components/data-list";
import { ProjectFilter } from "@/components/project-filter";
import { Reveal } from "@/components/reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TIME_RANGE_LABELS, DEFAULT_TIME_RANGE } from "@/lib/trace-query";

import { FilterSelect, type FilterOption } from "./components/filter-select";
import { MoreFilters } from "./components/more-filters";
import { TraceRow } from "./components/trace-row";
import { useTraceList } from "./use-trace-list";

const STATE_OPTIONS: readonly FilterOption[] = [
  { value: "open", label: "Open" },
  { value: "ok", label: "OK" },
  { value: "error", label: "Error" },
];

const RANGE_OPTIONS: readonly FilterOption[] = Object.entries(TIME_RANGE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

export function TracesScreen() {
  const list = useTraceList();
  const { pages, setters, params } = list;
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">Traces</h2>
      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <div className="w-full md:w-56">
          <ProjectFilter
            projects={list.projects.data ?? []}
            value={list.projectId}
            onChange={setters.project_id}
          />
        </div>
        <div className="w-full md:w-40">
          <FilterSelect
            label="State"
            allLabel="All states"
            options={STATE_OPTIONS}
            value={params.get("state")}
            onChange={setters.state}
          />
        </div>
        <div className="w-full md:w-44">
          <FilterSelect
            label="Time range"
            allLabel={null}
            options={RANGE_OPTIONS}
            value={params.get("range") ?? DEFAULT_TIME_RANGE}
            onChange={setters.range}
          />
        </div>
        <div className="w-full md:w-64">
          <Input
            aria-label="Search traces"
            placeholder="Search traces"
            value={list.search}
            onChange={(event) => list.changeSearch(event.target.value)}
          />
        </div>
        <Button
          variant="outline"
          aria-expanded={moreOpen}
          className="w-full md:w-auto"
          onClick={() => setMoreOpen((open) => !open)}
        >
          More filters
        </Button>
      </div>
      <Reveal open={moreOpen}>
        <MoreFilters
          facets={list.facets.data}
          params={params}
          setters={setters}
          durationSeconds={list.durationSeconds}
          onDurationSeconds={list.changeDurationSeconds}
        />
      </Reveal>
      <DataList
        label="Traces"
        items={pages.items}
        getKey={(trace) => trace.trace_id}
        renderItem={(trace) => <TraceRow trace={trace} title={list.titleOf(trace)} />}
        status={pages.status}
        error={pages.error?.message ?? null}
        pending={pages.pending}
        onRetry={pages.retry}
        emptyText={
          list.filtered
            ? "No traces match these filters."
            : "No traces yet. A trace opens when a worker claims a node."
        }
        pager={{
          hasPrevious: pages.hasPrevious,
          hasNext: pages.hasNext,
          position: pages.position,
          onPrevious: pages.previous,
          onNext: pages.next,
        }}
      />
    </div>
  );
}
