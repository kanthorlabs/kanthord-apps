import { useCallback, useState } from "react";
import { toast } from "sonner";

import { listHostKeys, pinHostKey, scanHostKey } from "@/api/resources/credentials";
import type { HostKey, HostKeyScan } from "@/api/types";
import { asApiError, type Resource, useResource } from "@/hooks/use-resource";
import { credentialMessage } from "./credential-message";

export interface HostKeyConfirmation {
  readonly pinned: HostKey;
  readonly scan: HostKeyScan;
  readonly pinning: boolean;
  readonly error: string | null;
}

export interface HostKeysState {
  readonly list: Resource<readonly HostKey[]>;
  readonly busyHost: string | null;
  readonly confirmation: HostKeyConfirmation | null;
  readonly pinAgain: (pinned: HostKey) => void;
  readonly confirm: () => void;
  readonly cancel: () => void;
}

function messageOf(cause: unknown): string {
  return credentialMessage(asApiError(cause));
}

export function useHostKeys(): HostKeysState {
  const list = useResource(() => listHostKeys(), []);
  const [busyHost, setBusyHost] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<HostKeyConfirmation | null>(null);
  const reload = list.reload;

  const pin = useCallback(
    (scan: HostKeyScan) =>
      pinHostKey(scan.host, { fingerprint: scan.fingerprint }).then((item) => {
        toast.success(
          item.source === "github_meta"
            ? `Host key of ${item.host} pinned from api.github.com.`
            : `Host key of ${item.host} pinned.`,
          { description: item.fingerprint },
        );
        reload();
      }),
    [reload],
  );

  const pinAgain = useCallback(
    (pinned: HostKey) => {
      if (busyHost !== null) return;
      setBusyHost(pinned.host);
      let scanned: HostKeyScan | null = null;
      scanHostKey(pinned.host)
        .then((scan) => {
          scanned = scan;
          if (scan.source !== "github_meta") {
            setConfirmation({ pinned, scan, pinning: false, error: null });
            return undefined;
          }
          return pin(scan);
        })
        .catch((cause: unknown) => {
          const message = messageOf(cause);
          toast.error(`The host key of ${pinned.host} was not pinned.`, {
            description:
              scanned === null
                ? message
                : `${message} Scanned fingerprint: ${scanned.fingerprint}.`,
          });
        })
        .finally(() => setBusyHost(null));
    },
    [busyHost, pin],
  );

  const confirm = useCallback(() => {
    if (confirmation === null || confirmation.pinning) return;
    setConfirmation({ ...confirmation, pinning: true, error: null });
    pin(confirmation.scan).then(
      () => setConfirmation(null),
      (cause: unknown) =>
        setConfirmation({ ...confirmation, pinning: false, error: messageOf(cause) }),
    );
  }, [confirmation, pin]);

  const cancel = useCallback(() => {
    if (confirmation?.pinning === true) return;
    setConfirmation(null);
  }, [confirmation]);

  return { list, busyHost, confirmation, pinAgain, confirm, cancel };
}
