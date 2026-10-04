import type { CredentialPlatform } from "@/api/types";
import type { DraftErrors, MetadataDraft } from "@/lib/credential-draft";
import { CredentialField } from "./credential-field";

interface MetadataFieldsProps {
  readonly platform: CredentialPlatform;
  readonly draft: MetadataDraft;
  readonly errors: DraftErrors;
  readonly baseUrlDescription: string;
  readonly onEdit: (draft: MetadataDraft) => void;
}

export function MetadataFields({
  platform,
  draft,
  errors,
  baseUrlDescription,
  onEdit,
}: MetadataFieldsProps) {
  if (platform === "openai-compatible") {
    return (
      <CredentialField
        id="credential-base-url"
        label="Base URL"
        inputMode="url"
        value={draft.baseUrl}
        error={errors["baseUrl"]}
        description={baseUrlDescription}
        onChange={(baseUrl) => onEdit({ ...draft, baseUrl })}
      />
    );
  }
  if (platform === "s3") {
    return (
      <>
        <CredentialField
          id="credential-endpoint"
          label="Endpoint"
          inputMode="url"
          value={draft.endpoint}
          error={errors["endpoint"]}
          description="The healthcheck probes the bucket at this endpoint."
          onChange={(endpoint) => onEdit({ ...draft, endpoint })}
        />
        <CredentialField
          id="credential-bucket"
          label="Bucket"
          value={draft.bucket}
          error={errors["bucket"]}
          onChange={(bucket) => onEdit({ ...draft, bucket })}
        />
        <CredentialField
          id="credential-region"
          label="Region"
          value={draft.region}
          error={errors["region"]}
          onChange={(region) => onEdit({ ...draft, region })}
        />
      </>
    );
  }
  return null;
}
