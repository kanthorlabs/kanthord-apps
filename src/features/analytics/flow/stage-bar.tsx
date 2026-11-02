import type { FlowSegment } from "@/lib/flow-stages";
import type { FlowSeverity } from "@/lib/flow-status";

interface StageBarProps {
  readonly label: string;
  readonly bar: readonly FlowSegment[];
}

const KIND_FILL: Readonly<Record<FlowSegment["kind"], string>> = {
  forward: "bg-flow-forward",
  loops: "bg-flow-loop",
  leaks: "bg-flow-leak",
};
const SEVERITY_FILL: Readonly<Record<Exclude<FlowSeverity, "ok">, string>> = {
  warn: "bg-flow-warn",
  bad: "bg-flow-bad",
};

function fillOf(segment: FlowSegment): string {
  return segment.severity === "ok" ? KIND_FILL[segment.kind] : SEVERITY_FILL[segment.severity];
}

export function StageBar({ label, bar }: StageBarProps) {
  return (
    <div
      role="img"
      aria-label={label}
      className="flex h-2 w-full gap-px overflow-hidden rounded-full bg-muted"
    >
      {bar.map((segment) => (
        <div
          key={segment.kind}
          style={{ flexGrow: segment.count }}
          className={`basis-0 ${fillOf(segment)}`}
        />
      ))}
    </div>
  );
}
