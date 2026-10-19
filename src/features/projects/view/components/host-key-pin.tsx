import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from "@/components/ui/item";
import { publishedFingerprintsUrl } from "@/lib/published-fingerprints";
import type { HostKeyPinState } from "../use-host-key-pin";

function Fingerprint({ value }: { readonly value: string }) {
  return <span className="font-mono text-xs break-all">{value}</span>;
}

function PublishedLink({ host }: { readonly host: string }) {
  const url = publishedFingerprintsUrl(host);
  if (url === null) return null;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="underline underline-offset-4">
      Published fingerprints of {host}
    </a>
  );
}

interface HostRowProps {
  readonly host: string;
  readonly badge: string;
  readonly children: ReactNode;
  readonly actions?: ReactNode;
}

function HostRow({ host, badge, children, actions }: HostRowProps) {
  return (
    <Item variant="outline" size="sm" role="group" aria-label={`Host key of ${host}`}>
      <ItemContent className="min-w-0">
        <ItemTitle>
          Host key of {host}
          <Badge variant="outline">{badge}</Badge>
        </ItemTitle>
        <ItemDescription className="flex min-w-0 flex-col gap-1 break-words">
          {children}
        </ItemDescription>
      </ItemContent>
      {actions !== undefined && (
        <ItemActions className="basis-full md:basis-auto">{actions}</ItemActions>
      )}
    </Item>
  );
}

export function HostKeyPin({ pin }: { readonly pin: HostKeyPinState }) {
  const { view } = pin;
  if (view.status === "none") return null;
  if (view.status === "reading") {
    return (
      <HostRow host={view.host} badge="Checking">
        <span>The server reads the host key.</span>
      </HostRow>
    );
  }
  if (view.status === "pinned") {
    return (
      <HostRow host={view.host} badge="Pinned">
        <Fingerprint value={view.key.fingerprint} />
        {view.pinnedNow && view.key.source === "github_meta" && (
          <span>Host key pinned from api.github.com</span>
        )}
      </HostRow>
    );
  }
  if (view.status === "unconfirmed") {
    return (
      <HostRow
        host={view.host}
        badge="Not pinned"
        actions={
          <Button type="button" size="sm" disabled={view.pinning} onClick={pin.confirm}>
            Confirm host key
          </Button>
        }
      >
        <Fingerprint value={view.scan.fingerprint} />
        <span>
          Compare the fingerprint with the published one. Save stays off until the host key is
          pinned.
        </span>
        <PublishedLink host={view.host} />
        {view.error !== null && <span className="text-destructive">{view.error}</span>}
      </HostRow>
    );
  }
  if (view.status === "changed") {
    return (
      <Alert variant="destructive">
        <AlertTitle>The host presented another key.</AlertTitle>
        <AlertDescription className="flex min-w-0 flex-col gap-1">
          <span>First read of {view.host}:</span>
          <Fingerprint value={view.scanned} />
          <span>Second read:</span>
          <Fingerprint value={view.presented} />
          <span>Compare both with the published fingerprints. Then read the key again.</span>
          <PublishedLink host={view.host} />
          <Button type="button" size="sm" variant="outline" onClick={pin.retry}>
            Read again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  return (
    <Alert variant="destructive">
      <AlertTitle>The host key of {view.host} was not read.</AlertTitle>
      <AlertDescription className="flex min-w-0 flex-col gap-2">
        <span>{view.message}</span>
        <Button type="button" size="sm" variant="outline" onClick={pin.retry}>
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}
