import type { CredentialHealthState } from "../use-credential-health";
import { HealthBadge } from "./health-badge";
import { HealthNotice } from "./health-notice";

interface CredentialHealthLineProps {
  readonly name: string;
  readonly state: CredentialHealthState;
  readonly onVerify: () => void;
}

export function CredentialHealthLine({ name, state, onVerify }: CredentialHealthLineProps) {
  const entry = state.status === "ready" ? state.entries[name] : undefined;

  return (
    <div className="flex flex-col gap-2">
      {state.status === "ready" && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <HealthBadge entry={entry} />
          {entry !== undefined && (
            <span className="text-muted-foreground">Capability: {entry.capability}</span>
          )}
        </div>
      )}
      <HealthNotice state={state} onVerify={onVerify} />
    </div>
  );
}
