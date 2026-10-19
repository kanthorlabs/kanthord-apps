import type { Credential } from "@/api/types";
import { SearchChoiceField } from "@/components/search-choice-field";
import { Button } from "@/components/ui/button";
import { credentialLabel } from "@/lib/credential-label";
import { newestLiveRevision } from "@/lib/credential-revisions";
import { newestSshKeyOf, SSH_PLATFORM } from "@/lib/ssh-key";

interface CredentialComboboxProps {
  readonly id: string;
  readonly label?: string;
  readonly credentials: readonly Credential[];
  readonly value: string;
  readonly error: string | undefined;
  readonly description?: string;
  readonly hint?: string;
  readonly onChange: (value: string) => void;
  readonly onNew?: () => void;
  readonly newLabel?: string;
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
  hint,
  onChange,
  onNew,
  newLabel = "New credential",
  onRotate,
  rotateAvailable,
}: CredentialComboboxProps) {
  const byName = new Map(credentials.map((credential) => [credential.name, credential]));
  const labelOf = (name: string) => {
    const credential = byName.get(name);
    if (credential === undefined) return name;
    if (credential.platform !== SSH_PLATFORM) return credentialLabel(name, credential.platform);
    const revision = newestLiveRevision(credential);
    return revision === null ? name : `${name} (v${revision.revision})`;
  };
  const detailOf = (name: string) => {
    const credential = byName.get(name);
    if (credential === undefined || credential.platform !== SSH_PLATFORM) return null;
    return newestSshKeyOf(credential)?.fingerprint ?? null;
  };

  return (
    <SearchChoiceField
      id={id}
      label={label}
      value={value}
      options={credentials.map((credential) => credential.name)}
      error={error}
      placeholder="Search credentials"
      emptyText={
        credentials.length === 0
          ? `No credential exists. Use ${newLabel}.`
          : "No credential matches."
      }
      labelOf={labelOf}
      detailOf={detailOf}
      description={description}
      hint={hint}
      actions={
        onNew !== undefined && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" type="button" onClick={onNew}>
              {newLabel}
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
