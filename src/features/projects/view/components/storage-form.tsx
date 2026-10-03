import type { DraftErrors, StorageDraft } from "@/lib/binding-draft";
import { AvailabilityField } from "./availability-field";
import { DraftField } from "./draft-field";

interface StorageFormProps {
  readonly draft: StorageDraft;
  readonly errors: DraftErrors;
  readonly onEdit: (draft: StorageDraft) => void;
}

export function StorageForm({ draft, errors, onEdit }: StorageFormProps) {
  return (
    <>
      <AvailabilityField
        id="binding-available"
        available={draft.available}
        onChange={(available) => onEdit({ ...draft, available })}
      />
      <DraftField
        id="binding-endpoint"
        label="Endpoint"
        value={draft.endpoint}
        error={errors["endpoint"]}
        inputMode="url"
        description="A new endpoint host replaces the binding."
        onChange={(endpoint) => onEdit({ ...draft, endpoint })}
      />
      <DraftField
        id="binding-bucket"
        label="Bucket"
        value={draft.bucket}
        error={errors["bucket"]}
        description="A new bucket replaces the binding."
        onChange={(bucket) => onEdit({ ...draft, bucket })}
      />
      <DraftField
        id="binding-region"
        label="Region"
        value={draft.region}
        error={errors["region"]}
        onChange={(region) => onEdit({ ...draft, region })}
      />
      <DraftField
        id="binding-prefix"
        label="Prefix"
        value={draft.prefix}
        error={errors["prefix"]}
        description="Optional. The object keys start with it."
        onChange={(prefix) => onEdit({ ...draft, prefix })}
      />
      <DraftField
        id="binding-credential"
        label="Credential"
        value={draft.credential}
        error={errors["credential"]}
        onChange={(credential) => onEdit({ ...draft, credential })}
      />
    </>
  );
}
