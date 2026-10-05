import { useParams } from "react-router-dom";

import { Skeleton } from "@/components/ui/skeleton";
import { CredentialDetail } from "@/features/credentials/view/components/credential-detail";
import { CredentialLoadFailure } from "@/features/credentials/view/components/credential-load-failure";
import { BindingList } from "./components/binding-list";
import { useRepositoryCredential } from "./use-repository-credential";

export function RepositoryScreen() {
  const { credentialName = "" } = useParams<{ credentialName: string }>();
  const { data: credential, error, loading, reload } = useRepositoryCredential(credentialName);

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
      <CredentialLoadFailure component="repository" message={error?.message} onRetry={reload} />
    );
  }

  return (
    <CredentialDetail component="repository" credential={credential} reload={reload}>
      <BindingList bindings={credential.bindings} />
    </CredentialDetail>
  );
}
