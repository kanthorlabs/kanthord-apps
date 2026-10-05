import { FieldError } from "@/components/ui/field";
import { CheckStatusBadge } from "../../components/check-status-badge";
import { VerifyButton } from "../../components/verify-button";
import type { CredentialPrecheck } from "../use-credential-precheck";

interface SecretPrecheckProps {
  readonly platform: string;
  readonly precheck: CredentialPrecheck;
  readonly ready: boolean;
}

export function SecretPrecheck({ platform, precheck, ready }: SecretPrecheckProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:min-h-10 sm:flex-row sm:flex-wrap sm:items-center [&>button]:w-full sm:[&>button]:w-auto">
        <VerifyButton
          platform={platform}
          verifiable={precheck.available}
          checking={precheck.checking}
          onVerify={precheck.run}
          label="Check the typed secret"
          incomplete={!ready}
          size="lg"
        />
        <CheckStatusBadge badge={precheck.badge} />
      </div>
      <FieldError>{precheck.error}</FieldError>
    </div>
  );
}
