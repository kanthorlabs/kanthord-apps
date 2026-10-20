import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ChoiceFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly string[];
  readonly error: string | undefined;
  readonly description?: string;
  readonly disabledOptions?: readonly string[];
  readonly note?: string | null;
  readonly onChange: (value: string | null) => void;
}

export function ChoiceField({
  id,
  label,
  value,
  options,
  error,
  description,
  disabledOptions = [],
  note = null,
  onChange,
}: ChoiceFieldProps) {
  const items = options.map((option) => ({ value: option, label: option }));
  return (
    <Field data-invalid={error !== undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Select items={items} value={value === "" ? null : value} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full" aria-invalid={error !== undefined}>
          <SelectValue placeholder="Choose" />
        </SelectTrigger>
        <SelectContent>
          {items.map((item) => (
            <SelectItem
              key={item.value}
              value={item.value}
              disabled={disabledOptions.includes(item.value)}
            >
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description !== undefined && <FieldDescription>{description}</FieldDescription>}
      {note !== null && <FieldDescription>{note}</FieldDescription>}
      <FieldError>{error}</FieldError>
    </Field>
  );
}
