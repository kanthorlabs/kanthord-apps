import { readMissionNode } from "@/api/resources/mission";

export async function readNodeNames(
  nodeIds: readonly string[],
): Promise<ReadonlyMap<string, string>> {
  const distinct = [...new Set(nodeIds)];
  const settled = await Promise.allSettled(distinct.map(readMissionNode));
  const names = new Map<string, string>();
  settled.forEach((result, index) => {
    const nodeId = distinct[index];
    if (result.status === "fulfilled" && nodeId !== undefined) {
      names.set(nodeId, result.value.content.name);
    }
  });
  return names;
}
