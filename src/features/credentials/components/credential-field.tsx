import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

interface CredentialFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly error: string | undefined;
  readonly onChange: (value: string) => void;
  readonly description?: string;
  readonly secret?: boolean;
  readonly inputMode?: "text" | "numeric" | "url";
  readonly readOnly?: boolean;
}

export function CredentialField({
  id,
  label,
  value,
  error,
  onChange,
  description,
  secret = false,
  inputMode = "text",
  readOnly = false,
}: CredentialFieldProps) {
  return (
    <Field data-invalid={error !== undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type={secret ? "password" : "text"}
        value={value}
        inputMode={inputMode}
        readOnly={readOnly}
        autoComplete={secret ? "new-password" : "off"}
        autoCapitalize="none"
        spellCheck={false}
        aria-invalid={error !== undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {description !== undefined && <FieldDescription>{description}</FieldDescription>}
      <FieldError>{error}</FieldError>
    </Field>
  );
}
