import { Link } from "react-router-dom";

import type { CredentialLoginSession, CredentialLoginStatus } from "@/api/types";
import { useCrumbLabel } from "@/components/crumb-labels";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { utcDateTime } from "@/lib/format";
import { CredentialField } from "../components/credential-field";
import {
  PLATFORM_DEFAULT_MODE,
  useCredentialLogin,
  type CredentialLoginState,
} from "./use-credential-login";

const MODE_ITEMS = [
  { value: PLATFORM_DEFAULT_MODE, label: "Platform default" },
  { value: "browser", label: "Browser" },
  { value: "device", label: "Device code" },
];

function StartForm({ login }: { login: CredentialLoginState }) {
  return (
    <form
      noValidate
      aria-label="Start sign-in"
      onSubmit={(event) => {
        event.preventDefault();
        login.start();
      }}
    >
      <FieldGroup>
        {login.startError !== null && (
          <Alert variant="destructive">
            <AlertTitle>The sign-in did not start.</AlertTitle>
            <AlertDescription>{login.startError}</AlertDescription>
          </Alert>
        )}
        <CredentialField
          id="login-name"
          label="Credential name"
          value={login.name}
          error={login.nameError ?? undefined}
          description="Custody stores the OAuth credential under this name when the sign-in completes."
          onChange={login.setName}
        />
        <Field>
          <FieldLabel htmlFor="login-mode">Mode</FieldLabel>
          <Select items={MODE_ITEMS} value={login.mode} onValueChange={login.selectMode}>
            <SelectTrigger id="login-mode" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MODE_ITEMS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>A platform with one mode ignores the selection.</FieldDescription>
        </Field>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            nativeButton={false}
            render={<Link to="/credentials" />}
            variant="outline"
            size="lg"
          >
            Cancel
          </Button>
          <Button type="submit" size="lg" disabled={login.starting}>
            Start sign-in
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}

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

function SessionPanel({
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
        Open the address, then complete the GitHub interaction. This page checks the state every 2
        seconds.
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
      {state === "completed" && (
        <Button
          nativeButton={false}
          render={<Link to={`/credentials/${encodeURIComponent(login.name)}`} />}
          size="lg"
        >
          Open {login.name}
        </Button>
      )}
      {(state === "failed" || state === "expired") && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <p className="text-sm text-muted-foreground">Custody stored nothing.</p>
          <Button variant="outline" size="lg" onClick={login.restart}>
            Start again
          </Button>
        </div>
      )}
    </div>
  );
}

export function CredentialLoginScreen() {
  const login = useCredentialLogin();
  useCrumbLabel("/credentials/login", "Sign in to GitHub Copilot");

  return (
    <Card className="w-full max-w-xl">
      <CardHeader>
        <h2 className="font-semibold leading-none">Sign in to GitHub Copilot</h2>
      </CardHeader>
      <CardContent>
        {login.session === null ? (
          <StartForm login={login} />
        ) : (
          <SessionPanel login={login} session={login.session} />
        )}
      </CardContent>
    </Card>
  );
}
