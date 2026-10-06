import type { Credential } from "@/api/types";
import { SearchChoiceField } from "@/components/search-choice-field";
import { Button } from "@/components/ui/button";

interface CredentialComboboxProps {
  readonly id: string;
  readonly label?: string;
  readonly credentials: readonly Credential[];
  readonly value: string;
  readonly error: string | undefined;
  readonly description?: string;
  readonly onChange: (value: string) => void;
  readonly onNew?: () => void;
  readonly onRotate?: () => void;
  readonly rotateAvailable?: boolean;
}

export function CredentialCombobox({
  id,
  label = "Credential",
  credentials,
  value,
  error,
  description,
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
    <SearchChoiceField
      id={id}
      label={label}
      value={value}
      options={credentials.map((credential) => credential.name)}
      error={error}
      placeholder="Search credentials"
      emptyText="No credential matches."
      labelOf={labelOf}
      description={description}
      actions={
        onNew !== undefined && (
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
        )
      }
      onChange={(next) => onChange(next ?? "")}
    />
  );
}
