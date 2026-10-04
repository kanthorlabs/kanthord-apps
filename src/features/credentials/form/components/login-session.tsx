import type { CredentialLoginSession, CredentialLoginStatus } from "@/api/types";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldGroup } from "@/components/ui/field";
import { utcDateTime } from "@/lib/format";
import { CredentialField } from "../../components/credential-field";
import type { CredentialLoginState } from "../use-credential-login";

function SessionFacts({
  session,
  status,
}: {
  session: CredentialLoginSession;
  status: CredentialLoginStatus | null;
}) {
  return (
    <dl className="grid grid-cols-1 gap-x-4 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
      <dt className="text-muted-foreground">State</dt>
      <dd>
        <Badge variant={status?.state === "completed" ? "default" : "outline"}>
          {status?.state ?? "pending"}
        </Badge>
      </dd>
      <dt className="text-muted-foreground">Address</dt>
      <dd className="min-w-0 break-all">
        <a href={session.address} target="_blank" rel="noreferrer" className="underline">
          {session.address}
        </a>
      </dd>
      <dt className="text-muted-foreground">Code</dt>
      <dd className="font-mono break-all">{session.code ?? "none"}</dd>
      <dt className="text-muted-foreground">Expires</dt>
      <dd>{utcDateTime(session.expiresAt)}</dd>
      {status?.lastMessage != null && (
        <>
          <dt className="text-muted-foreground">Message</dt>
          <dd className="break-words">{status.lastMessage}</dd>
        </>
      )}
      {status?.failureReason != null && (
        <>
          <dt className="text-muted-foreground">Failure</dt>
          <dd className="break-words text-destructive">{status.failureReason}</dd>
        </>
      )}
    </dl>
  );
}

function CodeForm({ login }: { login: CredentialLoginState }) {
  return (
    <form
      noValidate
      aria-label="Supply a code"
      onSubmit={(event) => {
        event.preventDefault();
        login.submitCode();
      }}
    >
      <FieldGroup>
        <CredentialField
          id="login-code"
          label="Code or redirect URL"
          value={login.code}
          error={login.codeError ?? undefined}
          description="Paste it only when the sign-in asks for it, for example when the browser callback fails."
          onChange={login.setCode}
        />
        <div className="flex sm:justify-end">
          <Button type="submit" variant="outline" disabled={login.codeSubmitting}>
            Send code
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

export function LoginSession({
  login,
  session,
}: {
  login: CredentialLoginState;
  session: CredentialLoginSession;
}) {
  const state = login.status?.state ?? "pending";

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        Open the address, then complete the interaction of the platform. This page checks the state
        every 2 seconds and opens the credential when the sign-in completes.
      </p>
      <SessionFacts session={session} status={login.status} />
      {login.pollError !== null && (
        <Alert variant="destructive">
          <AlertTitle>The state could not be read.</AlertTitle>
          <AlertDescription>{login.pollError}</AlertDescription>
          <AlertAction>
            <Button variant="outline" size="sm" onClick={login.checkAgain}>
              Check again
            </Button>
          </AlertAction>
        </Alert>
      )}
      {state === "pending" && <CodeForm login={login} />}
      {(state === "failed" || state === "expired") && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">Custody stored nothing.</p>
          <Button variant="outline" size="lg" onClick={login.restart}>
            Start again
          </Button>
        </div>
      )}
    </div>
  );
}
