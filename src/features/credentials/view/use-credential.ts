import { readCredential } from "@/api/resources/credentials";
import type { Credential, CredentialComponent } from "@/api/types";
import { type Resource, useResource } from "@/hooks/use-resource";

export function useCredential(
  component: CredentialComponent,
  credentialName: string,
): Resource<Credential> {
  return useResource(() => readCredential(component, credentialName), [component, credentialName]);
}
