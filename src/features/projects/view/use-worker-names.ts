import { listWorkerCatalog } from "@/api/resources/workers";
import { type Resource, useResource } from "@/hooks/use-resource";

async function listWorkerNames(): Promise<readonly string[]> {
  const items = await listWorkerCatalog();
  return items.map((item) => item.name);
}

export function useWorkerNames(): Resource<readonly string[]> {
  return useResource(listWorkerNames, []);
}
