import { readCredential } from "@/api/resources/credentials";
import type { CredentialComponent } from "@/api/types";
import { useResource } from "@/hooks/use-resource";
import { isArchived } from "@/lib/credential-revisions";
import { type CredentialCheck, useCredentialCheck } from "./use-credential-check";
import { useCredentialPlatforms } from "./use-credential-platforms";

export interface CredentialVerifyAction {
  readonly check: CredentialCheck;
  readonly loading: boolean;
  readonly blocked: string | null;
}

export function useCredentialVerifyAction(
  component: CredentialComponent,
  name: string,
): CredentialVerifyAction {
  const check = useCredentialCheck(component, name);
  const credential = useResource(() => readCredential(component, name), [component, name]);
  const platforms = useCredentialPlatforms(component);
  const record = credential.data;
  const entry =
    record === null
      ? null
      : (platforms.data?.items.find((item) => item.platform === record.platform) ?? null);

  const blocked =
    credential.error !== null
      ? `${name} was not read: ${credential.error.message}`
      : record !== null && isArchived(record)
        ? `${name} is archived. An archived credential takes no check.`
        : record !== null && entry !== null && !entry.verifiable
          ? `Verification is not supported yet for ${record.platform}.`
          : null;

  return { check, loading: credential.loading, blocked };
}
