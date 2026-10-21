import { useCallback, useState } from "react";

import { connectionBaseUrl } from "@/api/client";
import { readServerVersion } from "@/api/resources/gateway";
import { listWorkerPlacements } from "@/api/resources/workers";
import { useResource } from "@/hooks/use-resource";
import {
  addressDefaultOf,
  hostKindOf,
  instanceAddressError,
  type HostKind,
} from "@/lib/instance-host";

export interface HostAddressState {
  readonly kind: HostKind | null;
  readonly address: string;
  readonly hint: string | null;
  readonly version: string | null;
  readonly versionError: string | null;
  readonly selectKind: (value: string | null) => void;
  readonly setAddress: (value: string) => void;
  readonly reset: () => void;
  readonly addressError: () => string | null;
}

export function useHostAddress(active: boolean): HostAddressState {
  const [kind, setKind] = useState<HostKind | null>(null);
  const [address, setAddressValue] = useState("");
  const [edited, setEdited] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const placements = useResource(
    () => (active ? listWorkerPlacements() : Promise.resolve([])),
    [active],
  );
  const version = useResource(
    () => (active ? readServerVersion() : Promise.resolve(null)),
    [active],
  );
  const serverInContainer = (placements.data ?? []).some(
    (status) => status.reason === "server_in_container",
  );

  const selectKind = useCallback(
    (value: string | null) => {
      const next = hostKindOf(value);
      if (next === null) return;
      setKind(next);
      const fallback = addressDefaultOf(next, connectionBaseUrl(), serverInContainer);
      setHint(fallback.hint);
      if (!edited) setAddressValue(fallback.address);
    },
    [edited, serverInContainer],
  );

  const setAddress = useCallback((value: string) => {
    setEdited(true);
    setAddressValue(value);
  }, []);

  const reset = useCallback(() => {
    setKind(null);
    setAddressValue("");
    setEdited(false);
    setHint(null);
  }, []);

  const addressError = useCallback(() => instanceAddressError(address), [address]);

  return {
    kind,
    address,
    hint,
    version: version.data ?? null,
    versionError: version.error?.message ?? null,
    selectKind,
    setAddress,
    reset,
    addressError,
  };
}
