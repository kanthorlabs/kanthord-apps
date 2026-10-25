import { TouchTarget } from "@/components/touch-target";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const PILLS = [
  { value: "all", label: "All" },
  { value: "error", label: "Failed" },
  { value: "open", label: "Open" },
] as const;

interface StatePillsProps {
  readonly value: string;
  readonly onChange: (pill: string) => void;
}

export function StatePills({ value, onChange }: StatePillsProps) {
  return (
    <ToggleGroup
      aria-label="Trace state"
      variant="outline"
      value={[value]}
      onValueChange={(next) => {
        const [pill] = next;
        if (pill !== undefined) onChange(pill);
      }}
    >
      {PILLS.map((pill) => (
        <TouchTarget key={pill.value}>
          <ToggleGroupItem value={pill.value}>{pill.label}</ToggleGroupItem>
        </TouchTarget>
      ))}
    </ToggleGroup>
  );
}
