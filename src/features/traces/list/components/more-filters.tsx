import type { TraceFacets } from "@/api/types";
import { TouchTarget } from "@/components/touch-target";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { CAUSE_CATEGORY_LABELS } from "@/lib/trace-cause";
import type { SheetKey } from "@/lib/trace-filter-draft";

import type { TraceSetter } from "../use-trace-list";
import { type FilterOption, FilterSelect } from "./filter-select";

const SORT_OPTIONS: readonly FilterOption[] = [
  { value: "started_at", label: "Newest" },
  { value: "duration_ms", label: "Longest" },
  { value: "total_tokens", label: "Most tokens" },
  { value: "cost_usd", label: "Highest est. cost" },
];

function optionsOf(values: readonly string[]): readonly FilterOption[] {
  return values.map((value) => ({ value, label: value }));
}

function causeOptionsOf(facets: TraceFacets | null): readonly FilterOption[] {
  return (facets?.cause_categories ?? []).map((category) => ({
    value: category,
    label: CAUSE_CATEGORY_LABELS[category],
  }));
}

interface MoreFiltersProps {
  readonly facets: TraceFacets | null;
  readonly params: URLSearchParams;
  readonly setters: Readonly<Record<SheetKey, TraceSetter>>;
  readonly durationSeconds: string;
  readonly onDurationSeconds: (text: string) => void;
}

export function MoreFilters({
  facets,
  params,
  setters,
  durationSeconds,
  onDurationSeconds,
}: MoreFiltersProps) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
      <FilterSelect
        label="Worker"
        allLabel="All workers"
        options={optionsOf(facets?.worker_names ?? [])}
        value={params.get("worker_name")}
        onChange={setters.worker_name}
      />
      <FilterSelect
        label="Agent"
        allLabel="All agents"
        options={optionsOf(facets?.agent_names ?? [])}
        value={params.get("agent_name")}
        onChange={setters.agent_name}
      />
      <FilterSelect
        label="Model"
        allLabel="All models"
        options={optionsOf(facets?.models ?? [])}
        value={params.get("model")}
        onChange={setters.model}
      />
      <FilterSelect
        label="Error type"
        allLabel="All error types"
        options={optionsOf(facets?.error_types ?? [])}
        value={params.get("error_type")}
        onChange={setters.error_type}
      />
      <FilterSelect
        label="Cause category"
        allLabel="All cause categories"
        options={causeOptionsOf(facets)}
        value={params.get("cause_category")}
        onChange={setters.cause_category}
      />
      <Field>
        <FieldLabel htmlFor="trace-min-duration">Min duration (s)</FieldLabel>
        <TouchTarget>
          <Input
            id="trace-min-duration"
            inputMode="decimal"
            value={durationSeconds}
            onChange={(event) => onDurationSeconds(event.target.value)}
          />
        </TouchTarget>
      </Field>
      <Field>
        <FieldLabel htmlFor="trace-min-tokens">Min tokens</FieldLabel>
        <TouchTarget>
          <Input
            id="trace-min-tokens"
            inputMode="numeric"
            value={params.get("min_total_tokens") ?? ""}
            onChange={(event) => setters.min_total_tokens(event.target.value)}
          />
        </TouchTarget>
      </Field>
      <Field>
        <FieldLabel htmlFor="trace-min-cost">Min est. cost ($)</FieldLabel>
        <TouchTarget>
          <Input
            id="trace-min-cost"
            inputMode="decimal"
            value={params.get("min_cost_usd") ?? ""}
            onChange={(event) => setters.min_cost_usd(event.target.value)}
          />
        </TouchTarget>
      </Field>
      <FilterSelect
        label="Sort"
        allLabel={null}
        options={SORT_OPTIONS}
        value={params.get("sort") ?? "started_at"}
        onChange={setters.sort}
      />
    </div>
  );
}
