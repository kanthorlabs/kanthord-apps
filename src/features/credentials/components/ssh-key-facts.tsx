import { CopyIcon } from "lucide-react";

import type { SshMetadata } from "@/api/types";
import { Button } from "@/components/ui/button";
import { usePublicKeyCopy } from "../use-public-key-copy";

export function SshKeyFacts({ sshKey }: { readonly sshKey: SshMetadata }) {
  const copy = usePublicKeyCopy();

  return (
    <dl className="flex min-w-0 flex-col gap-3 text-sm">
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <dt className="font-medium">Public key</dt>
          <Button
            variant="outline"
            size="sm"
            aria-label="Copy public key"
            onClick={() => copy(sshKey.public_key)}
          >
            <CopyIcon aria-hidden="true" data-icon="inline-start" />
            Copy
          </Button>
        </div>
        <dd className="min-w-0 rounded-md border bg-muted p-2 font-mono text-xs break-all">
          {sshKey.public_key}
        </dd>
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <dt className="font-medium">Fingerprint</dt>
        <dd className="min-w-0 font-mono text-xs break-all">{sshKey.fingerprint}</dd>
      </div>
    </dl>
  );
}
