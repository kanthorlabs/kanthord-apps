import { OctagonAlert, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";

import type { FlowRead } from "@/api/types";
import { TouchTarget } from "@/components/touch-target";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { rateText } from "@/lib/flow-format";
import { FLOW_SPLITS, type FlowSplit } from "@/lib/flow-query";
import {
  type SplitBar,
  type SplitCache,
  splitOf,
  type StageSplit,
  type StageSplitRow,
  type UsageSplit,
  type UsageSplitRow,
} from "@/lib/flow-split";
import type { FlowFrame, FlowSeverity } from "@/lib/flow-status";
import { withParam } from "@/lib/trace-query";

import { DayBars } from "./day-bars";
import { Sparkline } from "./sparkline";

interface SplitTableProps {
  readonly read: FlowRead;
  readonly frame: FlowFrame;
  readonly split: FlowSplit;
}

const SPLIT_NAMES: Readonly<Record<FlowSplit, string>> = {
  model: "Model",
  worker_name: "Worker",
  project_id: "Project",
  stage: "Stage",
};

const USAGE_ROW =
  "grid w-max min-w-full grid-cols-[8rem_5rem_6rem_6rem_6rem_14rem_5rem_11rem_5rem_6rem] items-center gap-x-3 border-b py-2";
const STAGE_ROW =
  "grid w-max min-w-full grid-cols-[8rem_6rem_7rem_6rem_6rem] items-center gap-x-3 border-b py-2";
const KEY_CELL = "sticky left-0 z-10 bg-background text-sm font-medium break-words";
const HEAD_CELL = "text-xs font-medium text-muted-foreground";
const USAGE_HEADS = [
  "Cost",
  "Share",
  "Δ cost",
  "Cost by day",
  "Cache hit",
  "$ / 1M",
  "In (cache) / out",
  "Turns",
  "Unpriced",
] as const;
const STAGE_HEADS = ["Ended here", "Share", "Leaked", "Handed on"] as const;

const TEXT_TONE: Readonly<Record<FlowSeverity, string>> = {
  ok: "",
  warn: "text-flow-warn",
  bad: "text-flow-bad",
};

function ShareBar({ bar }: { readonly bar: SplitBar }) {
  const width = `${Math.min(1, Math.max(0, bar.fraction)) * 100}%`;
  return (
    <div aria-hidden="true" className="h-1.5 w-full rounded-full bg-muted">
      <div className="h-full rounded-full bg-foreground" style={{ width }} />
    </div>
  );
}

function DeltaBar({ bar }: { readonly bar: SplitBar }) {
  const half = Math.min(1, Math.abs(bar.fraction)) * 50;
  const left = bar.fraction < 0 ? 50 - half : 50;
  return (
    <div aria-hidden="true" className="relative h-1.5 w-full rounded-full bg-muted">
      <div
        className={`absolute h-full ${bar.fraction < 0 ? "bg-muted-foreground" : "bg-foreground"}`}
        style={{ left: `${left}%`, width: `${half}%` }}
      />
    </div>
  );
}

function BarCell({
  bar,
  kind,
}: {
  readonly bar: SplitBar | null;
  readonly kind: "share" | "delta";
}) {
  if (bar === null) return <div role="cell">—</div>;
  return (
    <div role="cell" className="flex flex-col gap-1 text-sm">
      <span>{bar.text}</span>
      {kind === "share" ? <ShareBar bar={bar} /> : <DeltaBar bar={bar} />}
    </div>
  );
}

function CacheStatus({ name, status }: { readonly name: string; readonly status: FlowSeverity }) {
  if (status === "ok") return null;
  const Icon = status === "bad" ? OctagonAlert : TriangleAlert;
  return (
    <Icon
      role="img"
      aria-label={`${name} cache hit status ${status}`}
      className={`size-4 ${TEXT_TONE[status]}`}
    />
  );
}

function CacheCell({
  name,
  cache,
  partial,
}: {
  readonly name: string;
  readonly cache: SplitCache;
  readonly partial: boolean;
}) {
  return (
    <div role="cell" className="flex flex-col gap-1 text-sm">
      <span className="flex items-center gap-1">
        {cache.text}
        <CacheStatus name={name} status={cache.status} />
      </span>
      <Sparkline
        values={cache.series}
        partial={partial}
        warn={cache.warn}
        bad={cache.bad}
        label={`${name} cache hit`}
        format={rateText}
      />
    </div>
  );
}

function UsageRow({
  row,
  scale,
  partial,
}: {
  readonly row: UsageSplitRow;
  readonly scale: number;
  readonly partial: boolean;
}) {
  return (
    <div role="row" className={`${USAGE_ROW} ${row.all ? "font-semibold" : ""}`}>
      <div role="rowheader" className={KEY_CELL}>
        {row.target === null ? (
          row.key
        ) : (
          <Link to={row.target} className="underline underline-offset-4">
            {row.key}
          </Link>
        )}
      </div>
      <div role="cell" className="text-sm">
        {row.cost}
      </div>
      <BarCell bar={row.share} kind="share" />
      <BarCell bar={row.delta} kind="delta" />
      <div role="cell">
        <DayBars values={row.days} scale={scale} partial={partial} label={row.key} />
      </div>
      <CacheCell name={row.key} cache={row.cache} partial={partial} />
      <div role="cell" className="text-sm">
        {row.perMillion}
      </div>
      <div role="cell" className="text-sm">
        {row.tokens}
      </div>
      <div role="cell" className="text-sm">
        {row.turns}
      </div>
      <div role="cell" className="text-sm">
        {row.unpriced}
      </div>
    </div>
  );
}

function UsageGrid({ model, name }: { readonly model: UsageSplit; readonly name: string }) {
  return (
    <div role="table" aria-label={`Cost by ${name}`} className="w-max min-w-full">
      <div role="row" className={USAGE_ROW}>
        <div role="columnheader" className={`${HEAD_CELL} ${KEY_CELL}`}>
          Key
        </div>
        {USAGE_HEADS.map((head) => (
          <div key={head} role="columnheader" className={HEAD_CELL}>
            {head}
          </div>
        ))}
      </div>
      {model.rows.map((row) => (
        <UsageRow key={row.key} row={row} scale={model.dayScale} partial={model.partial} />
      ))}
    </div>
  );
}

function StageRowView({ row }: { readonly row: StageSplitRow }) {
  return (
    <div role="row" className={`${STAGE_ROW} ${row.all ? "font-semibold" : ""}`}>
      <div role="rowheader" className={KEY_CELL}>
        {row.key}
      </div>
      <div role="cell" className="text-sm">
        {row.ended}
      </div>
      <BarCell bar={row.share} kind="share" />
      <div role="cell" className="text-sm">
        {row.leaked}
      </div>
      <div role="cell" className="text-sm">
        {row.handedOn}
      </div>
    </div>
  );
}

function StageGrid({ model }: { readonly model: StageSplit }) {
  return (
    <div role="table" aria-label="Cost by stage" className="w-max min-w-full">
      <div role="row" className={STAGE_ROW}>
        <div role="columnheader" className={`${HEAD_CELL} ${KEY_CELL}`}>
          Key
        </div>
        {STAGE_HEADS.map((head) => (
          <div key={head} role="columnheader" className={HEAD_CELL}>
            {head}
          </div>
        ))}
      </div>
      {model.rows.map((row) => (
        <StageRowView key={row.key} row={row} />
      ))}
    </div>
  );
}

export function SplitTable({ read, frame, split }: SplitTableProps) {
  const [, setParams] = useSearchParams();
  const model = useMemo(() => splitOf(read, frame, split), [read, frame, split]);
  return (
    <div className="flex flex-col gap-3">
      <ToggleGroup
        aria-label="Split by"
        variant="outline"
        value={[split]}
        onValueChange={(next) => {
          const [chosen] = next;
          if (chosen === undefined) return;
          setParams((current) => withParam(current, "split", chosen), {
            replace: true,
            preventScrollReset: true,
          });
        }}
      >
        {FLOW_SPLITS.map((value) => (
          <TouchTarget key={value}>
            <ToggleGroupItem value={value}>{SPLIT_NAMES[value]}</ToggleGroupItem>
          </TouchTarget>
        ))}
      </ToggleGroup>
      <div className="overflow-x-auto">
        {model.kind === "stage" ? (
          <StageGrid model={model} />
        ) : (
          <UsageGrid model={model} name={SPLIT_NAMES[split].toLowerCase()} />
        )}
      </div>
      {model.kind === "stage" && <p className="text-xs text-muted-foreground">{model.note}</p>}
    </div>
  );
}
