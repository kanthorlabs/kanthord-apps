import { CheckIcon, CopyIcon } from "lucide-react";

import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";
import { useCopyText } from "@/hooks/use-copy-text";

interface IdentityValueProps {
  readonly label: string;
  readonly value: string;
}

export function IdentityValue({ label, value }: IdentityValueProps) {
  const { copied, copy } = useCopyText(value, label);
  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="min-w-0 break-all">{value}</span>
      <TouchTarget>
        <Button variant="ghost" size="icon-sm" aria-label={`Copy ${label}`} onClick={copy}>
          {copied ? <CheckIcon aria-hidden="true" /> : <CopyIcon aria-hidden="true" />}
        </Button>
      </TouchTarget>
    </span>
  );
}
