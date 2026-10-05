import { Link } from "react-router-dom";

import type { CredentialComponent } from "@/api/types";
import { Button } from "@/components/ui/button";
import { credentialSectionPath } from "@/lib/credential-sections";

interface CredentialLoadFailureProps {
  readonly component: CredentialComponent;
  readonly message: string | undefined;
  readonly onRetry: () => void;
}

export function CredentialLoadFailure({ component, message, onRetry }: CredentialLoadFailureProps) {
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-sm text-destructive">{message}</p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
        <Button
          nativeButton={false}
          render={<Link to={credentialSectionPath(component)} />}
          variant="ghost"
          size="sm"
        >
          Back to credentials
        </Button>
      </div>
    </div>
  );
}
