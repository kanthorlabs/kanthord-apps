import { listWorkerCatalog } from "@/api/resources/workers";
import { type Resource, useResource } from "@/hooks/use-resource";

async function listHostedWorkers(): Promise<ReadonlySet<string>> {
  const items = await listWorkerCatalog();
  return new Set(items.filter((item) => item.host === "kanthord").map((item) => item.name));
}

export function useHostedWorkers(): Resource<ReadonlySet<string>> {
  return useResource(listHostedWorkers, []);
}
