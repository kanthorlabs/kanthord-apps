import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { createCredential, discoverSshAliases } from "@/api/resources/credentials";
import type { SshAliasItem, SshMetadata } from "@/api/types";
import type { ApiError } from "@/api/errors";
import { asApiError } from "@/hooks/use-resource";
import { sshAliasToName } from "@/lib/ssh-name";
import { credentialMessage } from "./credential-message";

export interface SshImportFailure {
  readonly host: string;
  readonly message: string;
}

export interface SshImportState {
  readonly items: readonly SshAliasItem[];
  readonly loading: boolean;
  readonly discoverError: ApiError | null;
  readonly selected: ReadonlySet<string>;
  readonly submitting: boolean;
  readonly failures: readonly SshImportFailure[];
  readonly readyCount: number;
  readonly toggle: (host: string, checked: boolean) => void;
  readonly submit: () => void;
  readonly reload: () => void;
}

interface DiscoverState {
  readonly items: readonly SshAliasItem[];
  readonly loading: boolean;
  readonly discoverError: ApiError | null;
}

const DISCOVER_IDLE: DiscoverState = { items: [], loading: true, discoverError: null };

export function useSshImport(onImported: (names: readonly string[]) => void): SshImportState {
  const [discover, setDiscover] = useState<DiscoverState>(DISCOVER_IDLE);
  const [nonce, setNonce] = useState(0);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [failures, setFailures] = useState<readonly SshImportFailure[]>([]);
  const onImportedRef = useRef(onImported);

  useEffect(() => {
    onImportedRef.current = onImported;
  });

  useEffect(() => {
    let live = true;
    discoverSshAliases().then(
      (result) => {
        if (live) setDiscover({ items: result.items, loading: false, discoverError: null });
      },
      (cause: unknown) => {
        if (live) setDiscover({ items: [], loading: false, discoverError: asApiError(cause) });
      },
    );
    return () => {
      live = false;
    };
  }, [nonce]);

  const reload = useCallback(() => {
    setDiscover(DISCOVER_IDLE);
    setNonce((n) => n + 1);
  }, []);

  const toggle = useCallback((host: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(host);
      else next.delete(host);
      return next;
    });
  }, []);

  const submit = useCallback(() => {
    const readyItems = discover.items.filter(
      (item): item is Extract<SshAliasItem, { state: "ready" }> =>
        item.state === "ready" && selected.has(item.host),
    );
    if (readyItems.length === 0) return;
    setSubmitting(true);
    setFailures([]);
    const created: string[] = [];
    const rowFailures: SshImportFailure[] = [];
    void (async () => {
      for (const item of readyItems) {
        const name = sshAliasToName(item.host);
        try {
          const metadata: SshMetadata = {
            host: item.host,
            hostname: item.hostname,
            port: item.port,
            identity_file: item.identity_file,
          };
          await createCredential("repository", {
            name,
            platform: "ssh",
            metadata,
            secret: {},
          });
          created.push(name);
          toast.success(`Created ${name}.`);
        } catch (cause: unknown) {
          rowFailures.push({ host: item.host, message: credentialMessage(asApiError(cause)) });
        }
      }
      setSubmitting(false);
      setFailures(rowFailures);
      if (created.length > 0) {
        onImportedRef.current(created);
      }
    })();
  }, [discover, selected]);

  const readyCount = [...selected].filter((host) =>
    discover.items.some((item) => item.host === host && item.state === "ready"),
  ).length;

  return {
    items: discover.items,
    loading: discover.loading,
    discoverError: discover.discoverError,
    selected,
    submitting,
    failures,
    readyCount,
    toggle,
    submit,
    reload,
  };
}
