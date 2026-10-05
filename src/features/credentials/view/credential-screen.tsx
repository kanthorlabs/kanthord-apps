import { useParams } from "react-router-dom";

import type { CredentialComponent } from "@/api/types";
import { Skeleton } from "@/components/ui/skeleton";
import { CredentialDetail } from "./components/credential-detail";
import { CredentialLoadFailure } from "./components/credential-load-failure";
import { useCredential } from "./use-credential";

export function CredentialScreen({ component }: { component: CredentialComponent }) {
  const { credentialName = "" } = useParams<{ credentialName: string }>();
  const { data: credential, error, loading, reload } = useCredential(component, credentialName);

  if (loading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error !== null || credential === null) {
    return (
      <CredentialLoadFailure component={component} message={error?.message} onRetry={reload} />
    );
  }

  return <CredentialDetail component={component} credential={credential} reload={reload} />;
}
