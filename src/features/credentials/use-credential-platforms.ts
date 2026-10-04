import { listCredentialPlatforms } from "@/api/resources/credentials";
import type { CredentialPlatformList } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

export function useCredentialPlatforms(): Resource<CredentialPlatformList> {
  return useResource(() => listCredentialPlatforms(), []);
}
