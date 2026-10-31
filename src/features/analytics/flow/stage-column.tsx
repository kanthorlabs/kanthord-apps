import { OctagonAlert, TriangleAlert } from "lucide-react";

import type { FlowColumn } from "@/lib/flow-stages";
import type { FlowSeverity } from "@/lib/flow-status";

import { DayAxis, DayStrip } from "./day-strip";
import { StageBar } from "./stage-bar";

interface StageColumnProps {
  readonly column: FlowColumn;
  readonly showAxis: boolean;
}

interface ColumnPartProps {
  readonly column: FlowColumn;
}

const TEXT_TONE: Readonly<Record<FlowSeverity, string>> = {
  ok: "",
  warn: "text-flow-warn",
  bad: "text-flow-bad",
};

export function StageIcon({ column }: ColumnPartProps) {
  const { icon, name } = column;
  if (icon === "ok") return null;
  const Icon = icon === "bad" ? OctagonAlert : TriangleAlert;
  return (
    <Icon
      role="img"
      aria-label={`${name} status ${icon}`}
      className={`size-4 ${TEXT_TONE[icon]}`}
    />
  );
}

export function StageHeadline({ column }: ColumnPartProps) {
  const { headline } = column;
  return (
    <p className={`text-sm font-semibold break-words ${TEXT_TONE[headline.severity]}`}>
      {`${headline.label} ${headline.value}`}
    </p>
  );
}

export function StageException({ column }: ColumnPartProps) {
  const { exception } = column;
  if (exception === null) return <p className="min-h-8" />;
  const tone = exception.muted ? "text-muted-foreground" : TEXT_TONE[exception.severity];
  return (
    <p className={`min-h-8 text-xs break-words ${tone}`}>
      {exception.text}
      <span className="sr-only">{exception.reader}</span>
    </p>
  );
}

export function StageColumn({ column, showAxis }: StageColumnProps) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="flex h-6 items-center justify-between gap-1">
        <h4 className="truncate text-sm font-medium">{column.name}</h4>
        <StageIcon column={column} />
      </div>
      <div className="min-h-12">
        <StageHeadline column={column} />
      </div>
      <StageException column={column} />
      <DayStrip strip={column.strip} />
      <div className="h-4">{showAxis && <DayAxis cells={column.strip.cells} />}</div>
      <StageBar name={column.name} bar={column.bar} />
      <p className="min-h-5 text-xs break-words">{column.exits}</p>
      <p className="text-xs text-muted-foreground">{column.entered}</p>
    </div>
  );
}
