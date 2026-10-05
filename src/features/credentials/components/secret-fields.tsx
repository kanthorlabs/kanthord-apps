import type { SecretShape } from "@/api/types";
import type { DraftErrors, SecretDraft } from "@/lib/credential-draft";
import { CredentialField } from "./credential-field";

interface SecretFieldsProps {
  readonly shape: SecretShape;
  readonly draft: SecretDraft;
  readonly errors: DraftErrors;
  readonly onEdit: (draft: SecretDraft) => void;
}

export function SecretFields({ shape, draft, errors, onEdit }: SecretFieldsProps) {
  if (shape === "none") {
    return null;
  }
  if (shape === "api_key") {
    return (
      <CredentialField
        id="credential-key"
        label="API key"
        secret
        value={draft.key}
        error={errors["key"]}
        description="Custody keeps the exact value and never shows it again."
        onChange={(key) => onEdit({ ...draft, key })}
      />
    );
  }
  if (shape === "s3_access_key") {
    return (
      <>
        <CredentialField
          id="credential-access-key-id"
          label="Access key ID"
          secret
          value={draft.accessKeyId}
          error={errors["accessKeyId"]}
          onChange={(accessKeyId) => onEdit({ ...draft, accessKeyId })}
        />
        <CredentialField
          id="credential-secret-access-key"
          label="Secret access key"
          secret
          value={draft.secretAccessKey}
          error={errors["secretAccessKey"]}
          description="A session token is not accepted."
          onChange={(secretAccessKey) => onEdit({ ...draft, secretAccessKey })}
        />
      </>
    );
  }
  return (
    <>
      <CredentialField
        id="credential-refresh"
        label="Refresh token"
        secret
        value={draft.refresh}
        error={errors["refresh"]}
        onChange={(refresh) => onEdit({ ...draft, refresh })}
      />
      <CredentialField
        id="credential-access"
        label="Access token"
        secret
        value={draft.access}
        error={errors["access"]}
        onChange={(access) => onEdit({ ...draft, access })}
      />
      <CredentialField
        id="credential-expires"
        label="Access token expiry"
        inputMode="numeric"
        value={draft.expires}
        error={errors["expires"]}
        description="Unix milliseconds in UTC."
        onChange={(expires) => onEdit({ ...draft, expires })}
      />
    </>
  );
}
