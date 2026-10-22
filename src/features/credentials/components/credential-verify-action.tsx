import { ShieldCheckIcon } from "lucide-react";

import type { CredentialComponent } from "@/api/types";
import { DisabledAction } from "@/components/disabled-action";
import { useCredentialVerifyAction } from "../use-credential-verify-action";
import { CheckStatusBadge } from "./check-status-badge";
import { VerifyButton } from "./verify-button";

interface CredentialVerifyActionProps {
  readonly component: CredentialComponent;
  readonly name: string;
}

export function CredentialVerifyAction({ component, name }: CredentialVerifyActionProps) {
  const action = useCredentialVerifyAction(component, name);
  const label = `Verify ${name}`;
  return (
    <>
      <CheckStatusBadge badge={action.check.badge} />
      {action.blocked !== null ? (
        <DisabledAction
          label="Verify"
          ariaLabel={label}
          reason={action.blocked}
          icon={<ShieldCheckIcon aria-hidden="true" data-icon="inline-start" />}
        />
      ) : (
        <VerifyButton
          label={label}
          platform={component}
          verifiable
          checking={action.check.checking}
          incomplete={action.loading}
          onVerify={action.check.verify}
        />
      )}
    </>
  );
}
