import type { WorkerPlacement } from "@/api/types";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { containerDescriptionOf, type PlacementChoices } from "@/lib/placement-status";

const POOL_PLACEMENTS = ["server", "container"] as const;
type PoolPlacement = (typeof POOL_PLACEMENTS)[number];

interface PlacementFieldProps {
  readonly value: WorkerPlacement | null;
  readonly choices: PlacementChoices;
  readonly onChange: (placement: PoolPlacement) => void;
}

export function PlacementField({ value, choices, onChange }: PlacementFieldProps) {
  const atWorker = value === "worker";
  const texts: Readonly<Record<PoolPlacement, { title: string; description: string }>> = {
    server: {
      title: "Server",
      description: "Built in. Runs each instance as a thread of the server.",
    },
    container: { title: "Container", description: containerDescriptionOf(choices) },
  };
  return (
    <FieldSet>
      <FieldLegend id="binding-placement" variant="label">
        Placement
      </FieldLegend>
      <RadioGroup
        aria-labelledby="binding-placement"
        value={atWorker ? null : value}
        disabled={atWorker}
        onValueChange={(next) => {
          const placement = POOL_PLACEMENTS.find((item) => item === next);
          if (placement !== undefined) onChange(placement);
        }}
      >
        {POOL_PLACEMENTS.map((placement) => {
          const off = atWorker || choices.disabled.includes(placement);
          const id = `binding-placement-${placement}`;
          return (
            <FieldLabel key={placement} htmlFor={id}>
              <Field orientation="horizontal" data-disabled={off}>
                <RadioGroupItem id={id} value={placement} disabled={off} />
                <FieldContent>
                  <FieldTitle>{texts[placement].title}</FieldTitle>
                  <FieldDescription>{texts[placement].description}</FieldDescription>
                </FieldContent>
              </Field>
            </FieldLabel>
          );
        })}
      </RadioGroup>
      <FieldDescription>
        {atWorker
          ? "Advanced settings set the worker placement. Turn it off to choose server or container."
          : "The binding keeps this choice."}
      </FieldDescription>
    </FieldSet>
  );
}
