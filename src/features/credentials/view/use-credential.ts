import { readCredential } from "@/api/resources/credentials";
import type { Credential } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

export function useCredential(credentialName: string): Resource<Credential> {
  return useResource(() => readCredential(credentialName), [credentialName]);
}
