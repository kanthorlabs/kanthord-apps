import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export interface HolderToggleGroup {
  readonly label: string;
  readonly names: readonly string[];
}

export function HolderToggle({
  id,
  label,
  description,
  groups,
  value,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  groups: readonly HolderToggleGroup[];
  value: readonly string[];
  onChange: (value: readonly string[]) => void;
}) {
  return (
    <Field className="md:col-span-2">
      <FieldLabel id={id}>{label}</FieldLabel>
      {groups.length === 0 ? (
        <FieldDescription>No other holder.</FieldDescription>
      ) : (
        groups.map((group) => (
          <div key={group.label} className="flex min-w-0 flex-col gap-1">
            <p id={`${id}-${group.label}`} className="text-sm text-muted-foreground">
              {group.label}
            </p>
            <ToggleGroup
              multiple
              aria-labelledby={`${id} ${id}-${group.label}`}
              className="flex-wrap"
              value={value.filter((name) => group.names.includes(name))}
              onValueChange={(selected: string[]) =>
                onChange([...value.filter((name) => !group.names.includes(name)), ...selected])
              }
            >
              {group.names.map((name) => (
                <ToggleGroupItem key={name} value={name} variant="outline" className="max-w-full">
                  <span className="truncate">{name}</span>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        ))
      )}
      <FieldDescription>{description}</FieldDescription>
    </Field>
  );
}
