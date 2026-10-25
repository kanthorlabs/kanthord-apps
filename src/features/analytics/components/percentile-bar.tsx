import { Progress } from "@/components/ui/progress";
import type { TimeMark } from "@/lib/analytics-time-rows";

interface PercentileBarProps {
  readonly max: number;
  readonly scale: number;
  readonly marks: readonly TimeMark[];
  readonly label: string;
}

export function PercentileBar({ max, scale, marks, label }: PercentileBarProps) {
  return (
    <Progress value={max} max={scale} aria-label={label} className="relative">
      {marks.map((mark) => (
        <span
          key={mark.label}
          aria-hidden="true"
          style={{ left: `${mark.percent}%` }}
          className="absolute top-0 z-10 h-1.5 w-0.5 bg-background"
        />
      ))}
    </Progress>
  );
}
