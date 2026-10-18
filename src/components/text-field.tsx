import type { Ref } from "react";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface TextFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly error: string | undefined;
  readonly description: string;
  readonly onChange: (value: string) => void;
  readonly inputRef?: Ref<HTMLInputElement>;
}

export function TextField({
  id,
  label,
  value,
  error,
  description,
  onChange,
  inputRef,
}: TextFieldProps) {
  return (
    <Field data-invalid={error !== undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={value}
        ref={inputRef}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-invalid={error !== undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldDescription>{description}</FieldDescription>
      <FieldError>{error}</FieldError>
    </Field>
  );
}
