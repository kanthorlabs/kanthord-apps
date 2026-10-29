import type { ApiError } from "@/api/errors";
import { readProject } from "@/api/resources/projects";
import {
  ANOTHER_PROJECT,
  credentialMessage,
  instanceSharedFactsOf,
  instanceSharedMessage,
} from "@/features/credentials/credential-message";

export async function instanceSharedRefusalOf(refusal: ApiError): Promise<string> {
  const facts = instanceSharedFactsOf(refusal.details);
  if (facts === null) return credentialMessage(refusal);
  const project = await readProject(facts.projectId).then(
    (record) => record.name,
    () => ANOTHER_PROJECT,
  );
  return instanceSharedMessage(facts, project);
}
