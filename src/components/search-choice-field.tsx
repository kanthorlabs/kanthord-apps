import type { ReactNode } from "react";

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";

interface SearchChoiceFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly string[];
  readonly error: string | undefined;
  readonly placeholder: string;
  readonly emptyText: string;
  readonly labelOf?: (option: string) => string;
  readonly description?: string;
  readonly actions?: ReactNode;
  readonly onChange: (value: string | null) => void;
}

function sameLabel(option: string): string {
  return option;
}

export function SearchChoiceField({
  id,
  label,
  value,
  options,
  error,
  placeholder,
  emptyText,
  labelOf = sameLabel,
  description,
  actions,
  onChange,
}: SearchChoiceFieldProps) {
  return (
    <Field data-invalid={error !== undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Combobox
        items={options}
        value={value === "" ? null : value}
        itemToStringLabel={labelOf}
        onValueChange={onChange}
      >
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
                {labelOf(item)}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {actions}
      {description !== undefined && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{error}</FieldError>
    </Field>
  );
}
