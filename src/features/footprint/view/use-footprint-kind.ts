import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

import { readFootprintKind } from "@/api/resources/footprint";
import { listWorkerInstances } from "@/api/resources/worker-instances";
import type { FootprintKind, FootprintKindRead, FootprintStat, WorkerPlacement } from "@/api/types";
import { type PolledResource, usePolledResource } from "@/hooks/use-polled-resource";
import { useResource } from "@/hooks/use-resource";
import { noDeleteText } from "@/lib/footprint";
import { statHost } from "../stat-facts";

export const KIND_POLL_MS = 60_000;
const INSTANCE_PARAM = "instance";

export interface HostOption {
  readonly value: string;
  readonly label: string;
}

export interface FootprintKindState {
  readonly read: PolledResource<FootprintKindRead>;
  readonly placements: ReadonlyMap<string, WorkerPlacement>;
  readonly hostOptions: readonly HostOption[];
  readonly host: FootprintStat | null;
  readonly hostPlacement: WorkerPlacement | null;
  readonly noDeleteTexts: readonly string[];
  readonly selectHost: (value: string | null) => void;
}

function hostValue(stat: FootprintStat): string {
  return stat.instance_name ?? "";
}

export function useFootprintKind(kind: FootprintKind): FootprintKindState {
  const read = usePolledResource(() => readFootprintKind(kind), [kind], {
    intervalMs: KIND_POLL_MS,
  });
  const instances = useResource(() => listWorkerInstances(), []);
  const [params, setParams] = useSearchParams();
  const wanted = params.get(INSTANCE_PARAM) ?? "";

  const placements = useMemo(
    () =>
      new Map(
        (instances.data ?? []).map((instance): [string, WorkerPlacement] => [
          instance.name,
          instance.placement,
        ]),
      ),
    [instances.data],
  );
  const stats = read.data?.stats ?? [];
  const cleanable = stats.filter((stat) => stat.delete_operation !== null);
  const noDeleteTexts = [
    ...new Set(
      stats
        .filter((stat) => stat.delete_operation === null)
        .map((stat) =>
          noDeleteText(
            kind,
            stat.instance_name === null ? null : (placements.get(stat.instance_name) ?? null),
          ),
        ),
    ),
  ];
  const host = cleanable.find((stat) => hostValue(stat) === wanted) ?? cleanable[0] ?? null;

  const selectHost = useCallback(
    (value: string | null) => {
      if (value === null) return;
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          if (value === "") next.delete(INSTANCE_PARAM);
          else next.set(INSTANCE_PARAM, value);
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return {
    read,
    placements,
    hostOptions: cleanable.map((stat) => ({ value: hostValue(stat), label: statHost(stat) })),
    host,
    hostPlacement:
      host === null || host.instance_name === null
        ? null
        : (placements.get(host.instance_name) ?? null),
    noDeleteTexts,
    selectHost,
  };
}
