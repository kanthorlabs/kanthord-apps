import { listCredentialPage } from "@/api/resources/credentials";
import type { Credential } from "@/api/types";
import { useResource, type Resource } from "@/hooks/use-resource";

async function listRepositoryCredentials(): Promise<readonly Credential[]> {
  const credentials: Credential[] = [];
  let cursor: string | null = null;
  do {
    const page = await listCredentialPage("repository", null, cursor);
    credentials.push(...page.items);
    cursor = page.next_cursor;
  } while (cursor !== null);
  return credentials;
}

export function useRepositoryCredentials(): Resource<readonly Credential[]> {
  return useResource(listRepositoryCredentials, []);
}
