import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { VerifyStatus } from "@/features/auth/instances/components/verify-status";
import type { SignInFormState } from "../use-sign-in";

export function SignInForm({ form }: { form: SignInFormState }) {
  const { draft, errors } = form;

  return (
    <Card className="w-full min-w-0">
      <CardHeader>
        <CardTitle>kanthord</CardTitle>
        <CardDescription>Sign in to a KanthorD instance with a human token.</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          noValidate
          aria-label="Login"
          onSubmit={(event) => {
            event.preventDefault();
            void form.submit();
          }}
        >
          <FieldGroup>
            <Field data-invalid={errors.name !== undefined}>
              <FieldLabel htmlFor="login-name">Name</FieldLabel>
              <Input
                id="login-name"
                autoComplete="off"
                value={draft.name}
                aria-invalid={errors.name !== undefined}
                aria-describedby="login-name-description"
                onChange={(event) => form.setField("name", event.target.value)}
              />
              <FieldDescription id="login-name-description">
                Optional. An empty name takes the endpoint.
              </FieldDescription>
              <FieldError>{errors.name}</FieldError>
            </Field>
            <Field data-invalid={errors.baseUrl !== undefined}>
              <FieldLabel htmlFor="login-endpoint">Endpoint</FieldLabel>
              <Input
                id="login-endpoint"
                type="url"
                inputMode="url"
                autoComplete="off"
                placeholder="http://localhost:31415"
                value={draft.baseUrl}
                aria-invalid={errors.baseUrl !== undefined}
                onChange={(event) => form.setField("baseUrl", event.target.value)}
              />
              <FieldError>{errors.baseUrl}</FieldError>
              <VerifyStatus state={form.verifyState} />
            </Field>
            <Field data-invalid={errors.token !== undefined}>
              <FieldLabel htmlFor="login-token">JWT token</FieldLabel>
              <Input
                id="login-token"
                type="password"
                autoComplete="off"
                value={draft.token}
                aria-invalid={errors.token !== undefined}
                aria-describedby="login-token-description"
                onChange={(event) => form.setField("token", event.target.value)}
              />
              <FieldDescription id="login-token-description">
                Generate a human token with <code>kanthord auth jwt generate</code>.
              </FieldDescription>
              <FieldError>{errors.token}</FieldError>
            </Field>
            {form.error !== null && (
              <Alert variant="destructive">
                <AlertDescription>{form.error}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                size="lg"
                disabled={!form.canAct || form.verifying}
                onClick={form.verify}
              >
                {form.verifying ? "Verifying…" : "Verify"}
              </Button>
              <Button type="submit" size="lg" disabled={!form.canAct}>
                {form.pending ? "Logging in…" : "Login"}
              </Button>
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
