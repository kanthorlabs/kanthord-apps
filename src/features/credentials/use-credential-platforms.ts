import { listCredentialPlatforms } from "@/api/resources/credentials";
import type { CredentialComponent, CredentialPlatformList } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

export function useCredentialPlatforms(
  component: CredentialComponent,
): Resource<CredentialPlatformList> {
  return useResource(() => listCredentialPlatforms(component), [component]);
}
