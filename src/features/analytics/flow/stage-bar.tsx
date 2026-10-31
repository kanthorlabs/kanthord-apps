import { countText } from "@/lib/flow-format";
import type { FlowSegment } from "@/lib/flow-stages";
import type { FlowSeverity } from "@/lib/flow-status";

interface StageBarProps {
  readonly name: string;
  readonly bar: readonly FlowSegment[];
}

const KIND_NAME: Readonly<Record<FlowSegment["kind"], string>> = {
  forward: "forward",
  loops: "loops",
  leaks: "leaks",
};
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

function labelOf(name: string, bar: readonly FlowSegment[]): string {
  const parts = bar.map(
    (segment) =>
      `${countText(segment.count)} ${KIND_NAME[segment.kind]}${segment.severity === "ok" ? "" : ` (${segment.severity})`}`,
  );
  return `${name} settled executions: ${parts.length === 0 ? "none" : parts.join(", ")}`;
}

export function StageBar({ name, bar }: StageBarProps) {
  return (
    <div
      role="img"
      aria-label={labelOf(name, bar)}
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
