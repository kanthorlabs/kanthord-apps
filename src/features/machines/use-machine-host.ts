import { useCallback, useState } from "react";

import { readServerVersion } from "@/api/resources/gateway";
import { useResource } from "@/hooks/use-resource";
import {
  type ContainerRuntime,
  containerRuntimeOf,
  DEFAULT_CONTAINER_RUNTIME,
  type HostKind,
  hostKindOf,
} from "@/lib/instance-host";

export interface MachineHostState {
  readonly kind: HostKind | null;
  readonly runtime: ContainerRuntime;
  readonly version: string | null;
  readonly versionError: string | null;
  readonly selectKind: (value: string | null) => void;
  readonly selectRuntime: (value: string | null) => void;
  readonly reset: () => void;
}

export function useMachineHost(active: boolean): MachineHostState {
  const [kind, setKind] = useState<HostKind | null>(null);
  const [runtime, setRuntime] = useState<ContainerRuntime>(DEFAULT_CONTAINER_RUNTIME);
  const version = useResource(
    () => (active ? readServerVersion() : Promise.resolve(null)),
    [active],
  );

  const selectKind = useCallback((value: string | null) => {
    const next = hostKindOf(value);
    if (next !== null) setKind(next);
  }, []);

  const selectRuntime = useCallback((value: string | null) => {
    const next = containerRuntimeOf(value);
    if (next !== null) setRuntime(next);
  }, []);

  const reset = useCallback(() => {
    setKind(null);
    setRuntime(DEFAULT_CONTAINER_RUNTIME);
  }, []);

  return {
    kind,
    runtime,
    version: version.data ?? null,
    versionError: version.error?.message ?? null,
    selectKind,
    selectRuntime,
    reset,
  };
}
