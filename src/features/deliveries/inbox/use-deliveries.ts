import { useMemo, useState } from "react";

import type { Delivery, DeliveryDisposition } from "@/api/types";
import { listDeliveries } from "@/api/resources/deliveries";
import { useProjectId } from "@/features/projects/project-context";
import { useResource, type Resource } from "@/hooks/use-resource";

export interface DeliveryGroup {
  readonly primary: Delivery;
  readonly duplicates: readonly Delivery[];
}

export type DeliveryFilter = DeliveryDisposition | "all";

export interface DeliveriesData {
  readonly resource: Resource<readonly Delivery[]>;
  readonly filter: DeliveryFilter;
  readonly setFilter: (f: DeliveryFilter) => void;
  readonly groups: readonly DeliveryGroup[];
}

export function useDeliveries(): DeliveriesData {
  const projectId = useProjectId();
  const resource = useResource(() => listDeliveries(projectId), [projectId]);
  const [filter, setFilter] = useState<DeliveryFilter>("all");

  const groups = useMemo<readonly DeliveryGroup[]>(() => {
    const deliveries = resource.data ?? [];

    const bySourceAndPdi = new Map<string, Delivery[]>();
    for (const d of deliveries) {
      const key = `${d.source}\0${d.platformDeliveryIdentity}`;
      let bucket = bySourceAndPdi.get(key);
      if (bucket === undefined) {
        bucket = [];
        bySourceAndPdi.set(key, bucket);
      }
      bucket.push(d);
    }

    const allGroups: DeliveryGroup[] = [];
    for (const bucket of bySourceAndPdi.values()) {
      const primaries = bucket.filter((d) => d.disposition !== "a duplicate");
      const dupes = bucket.filter((d) => d.disposition === "a duplicate");
      const primary = primaries[0];
      if (primary === undefined) continue;
      allGroups.push({ primary, duplicates: dupes });
    }

    return allGroups.filter((g) => {
      if (filter === "all") return true;
      if (filter === "a duplicate") return g.duplicates.length > 0;
      return g.primary.disposition === filter;
    });
  }, [resource.data, filter]);

  return { resource, filter, setFilter, groups };
}
