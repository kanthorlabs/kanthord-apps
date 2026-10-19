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
import { LabelHint } from "@/components/label-hint";

interface SearchChoiceFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly options: readonly string[];
  readonly error: string | undefined;
  readonly placeholder: string;
  readonly emptyText: string;
  readonly labelOf?: (option: string) => string;
  readonly detailOf?: (option: string) => string | null;
  readonly description?: ReactNode;
  readonly hint?: string;
  readonly actions?: ReactNode;
  readonly onChange: (value: string | null) => void;
}

function sameLabel(option: string): string {
  return option;
}

function noDetail(): null {
  return null;
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
  detailOf = noDetail,
  description,
  hint,
  actions,
  onChange,
}: SearchChoiceFieldProps) {
  return (
    <Field data-invalid={error !== undefined}>
      {hint === undefined ? (
        <FieldLabel htmlFor={id}>{label}</FieldLabel>
      ) : (
        <div className="flex items-center gap-1">
          <FieldLabel htmlFor={id}>{label}</FieldLabel>
          <LabelHint label={label} hint={hint} />
        </div>
      )}
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
            {(item: string) => {
              const detail = detailOf(item);
              return (
                <ComboboxItem key={item} value={item}>
                  {detail === null ? (
                    labelOf(item)
                  ) : (
                    <span className="flex min-w-0 flex-col">
                      <span>{labelOf(item)}</span>
                      <span className="font-mono text-xs break-all text-muted-foreground">
                        {detail}
                      </span>
                    </span>
                  )}
                </ComboboxItem>
              );
            }}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {actions}
      {description !== undefined && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{error}</FieldError>
    </Field>
  );
}
