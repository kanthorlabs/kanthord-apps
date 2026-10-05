import { FieldError } from "@/components/ui/field";
import { CheckStatusBadge } from "../../components/check-status-badge";
import { VerifyButton } from "../../components/verify-button";
import type { CredentialPrecheck } from "../use-credential-precheck";

interface SecretPrecheckProps {
  readonly platform: string;
  readonly precheck: CredentialPrecheck;
}

export function SecretPrecheck({ platform, precheck }: SecretPrecheckProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-h-10 flex-wrap items-center gap-2">
        <VerifyButton
          platform={platform}
          verifiable
          checking={precheck.checking}
          onVerify={precheck.run}
          label="Check the typed secret"
        />
        <CheckStatusBadge badge={precheck.badge} />
      </div>
      <FieldError>{precheck.error}</FieldError>
    </div>
  );
}
