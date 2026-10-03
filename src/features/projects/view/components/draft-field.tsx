import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface DraftFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly error: string | undefined;
  readonly onChange: (value: string) => void;
  readonly description?: string;
  readonly inputMode?: "text" | "numeric" | "url";
  readonly readOnly?: boolean;
}

export function DraftField({
  id,
  label,
  value,
  error,
  onChange,
  description,
  inputMode = "text",
  readOnly = false,
}: DraftFieldProps) {
  return (
    <Field data-invalid={error !== undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        value={value}
        inputMode={inputMode}
        readOnly={readOnly}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error !== undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {description !== undefined && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{error}</FieldError>
    </Field>
  );
}
