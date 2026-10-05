import type { Credential } from "@/api/types";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";

interface CredentialComboboxProps {
  readonly id: string;
  readonly credentials: readonly Credential[];
  readonly value: string;
  readonly error: string | undefined;
  readonly onChange: (value: string) => void;
}

export function CredentialCombobox({
  id,
  credentials,
  value,
  error,
  onChange,
}: CredentialComboboxProps) {
  const platformOf = new Map(
    credentials.map((credential) => [credential.name, credential.platform]),
  );
  const labelOf = (name: string) => {
    const platform = platformOf.get(name);
    return platform === undefined ? name : `${name} · ${platform}`;
  };

  return (
    <Field data-invalid={error !== undefined}>
      <FieldLabel htmlFor={id}>Credential</FieldLabel>
      <Combobox
        items={credentials.map((credential) => credential.name)}
        value={value === "" ? null : value}
        itemToStringLabel={labelOf}
        onValueChange={(next: string | null) => onChange(next ?? "")}
      >
        <ComboboxInput
          id={id}
          className="w-full"
          placeholder="Search credentials"
          aria-invalid={error !== undefined}
        />
        <ComboboxContent>
          <ComboboxEmpty>No credential matches.</ComboboxEmpty>
          <ComboboxList>
            {(name: string) => (
              <ComboboxItem key={name} value={name}>
                {labelOf(name)}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <FieldError>{error}</FieldError>
    </Field>
  );
}
