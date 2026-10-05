import { readCredential } from "@/api/resources/credentials";
import type { RepositoryCredential } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

export function useRepositoryCredential(credentialName: string): Resource<RepositoryCredential> {
  return useResource(() => readCredential("repository", credentialName), [credentialName]);
}
