import type { DraftErrors, MetadataDraft } from "@/lib/credential-draft";
import { fieldLabel } from "@/lib/field-label";
import { CredentialField } from "./credential-field";

interface MetadataFieldsProps {
  readonly fields: readonly string[];
  readonly draft: MetadataDraft;
  readonly errors: DraftErrors;
  readonly baseUrlDescription: string;
  readonly onEdit: (draft: MetadataDraft) => void;
}

export function MetadataFields({
  fields,
  draft,
  errors,
  baseUrlDescription,
  onEdit,
}: MetadataFieldsProps) {
  return fields.map((name) => (
    <CredentialField
      key={name}
      id={`credential-metadata-${name}`}
      label={fieldLabel(name)}
      value={draft.fields[name] ?? ""}
      error={errors[name]}
      description={name === "base_url" ? baseUrlDescription : undefined}
      onChange={(value) => onEdit({ ...draft, fields: { ...draft.fields, [name]: value } })}
    />
  ));
}
