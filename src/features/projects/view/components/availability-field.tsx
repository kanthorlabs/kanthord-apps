import { Field, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";

interface AvailabilityFieldProps {
  readonly id: string;
  readonly available: boolean;
  readonly onChange: (available: boolean) => void;
}

export function AvailabilityField({ id, available, onChange }: AvailabilityFieldProps) {
  return (
    <Field orientation="horizontal">
      <Switch id={id} checked={available} onCheckedChange={onChange} />
      <FieldLabel htmlFor={id}>{available ? "Available" : "Unavailable"}</FieldLabel>
    </Field>
  );
}
