import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";

interface SearchChoiceFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly string[];
  readonly error: string | undefined;
  readonly placeholder: string;
  readonly emptyText: string;
  readonly onChange: (value: string | null) => void;
}

export function SearchChoiceField({
  id,
  label,
  value,
  options,
  error,
  placeholder,
  emptyText,
  onChange,
}: SearchChoiceFieldProps) {
  return (
    <Field data-invalid={error !== undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Combobox items={options} value={value === "" ? null : value} onValueChange={onChange}>
        <ComboboxInput
          id={id}
          className="w-full"
          placeholder={placeholder}
          aria-invalid={error !== undefined}
        />
        <ComboboxContent>
          <ComboboxEmpty>{emptyText}</ComboboxEmpty>
          <ComboboxList>
            {(item: string) => (
              <ComboboxItem key={item} value={item}>
                {item}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <FieldError>{error}</FieldError>
    </Field>
  );
}
