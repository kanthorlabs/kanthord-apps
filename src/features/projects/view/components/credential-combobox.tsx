import type { Credential } from "@/api/types";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";

interface CredentialComboboxProps {
  readonly id: string;
  readonly credentials: readonly Credential[];
  readonly value: string;
  readonly error: string | undefined;
  readonly onChange: (value: string) => void;
  readonly onNew?: () => void;
  readonly onRotate?: () => void;
  readonly rotateAvailable?: boolean;
}

export function CredentialCombobox({
  id,
  credentials,
  value,
  error,
  onChange,
  onNew,
  onRotate,
  rotateAvailable,
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
      {onNew !== undefined && (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" type="button" onClick={onNew}>
            New credential
          </Button>
          {rotateAvailable === true && onRotate !== undefined && (
            <Button size="sm" variant="outline" type="button" onClick={onRotate}>
              Rotate
            </Button>
          )}
        </div>
      )}
      <FieldError>{error}</FieldError>
    </Field>
  );
}
