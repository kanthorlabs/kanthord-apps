import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InstanceManager } from "@/features/auth/instances/instance-manager";
import { useInstances } from "@/features/auth/instances/use-instances";
import { useInstanceManager } from "@/features/auth/instances/use-instance-manager";
import { useSignIn } from "./use-sign-in";

export function LoginScreen() {
  const store = useInstances();
  const signIn = useSignIn(store);
  const manager = useInstanceManager(store);

  return (
    <main className="flex min-h-svh items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-sm min-w-0">
        <CardHeader>
          <CardTitle>kanthord</CardTitle>
          <CardDescription>Sign in to a KanthorD instance with a human token.</CardDescription>
          <CardAction>
            <Button variant="outline" size="sm" onClick={manager.openList}>
              Manage instances
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {store.instances.length === 0 ? (
            <Empty>
              <EmptyHeader>
                <EmptyTitle>No instances</EmptyTitle>
                <EmptyDescription>
                  Add the URL of a KanthorD instance before you sign in.
                </EmptyDescription>
              </EmptyHeader>
              <EmptyContent>
                <Button onClick={manager.openAdd}>Add an instance</Button>
              </EmptyContent>
            </Empty>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void signIn.submit();
              }}
            >
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="login-instance">KanthorD instance</FieldLabel>
                  <Select
                    items={store.instances.map((instance) => ({
                      value: instance.id,
                      label: instance.name,
                    }))}
                    value={signIn.selected?.id ?? null}
                    onValueChange={(id) => {
                      if (id !== null) signIn.select(id);
                    }}
                  >
                    <SelectTrigger id="login-instance" className="w-full min-w-0">
                      <SelectValue placeholder="Select an instance" />
                    </SelectTrigger>
                    <SelectContent>
                      {store.instances.map((instance) => (
                        <SelectItem key={instance.id} value={instance.id}>
                          {instance.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="login-instance-url">Instance</FieldLabel>
                  <Input
                    id="login-instance-url"
                    readOnly
                    value={signIn.selected?.baseUrl ?? ""}
                    aria-describedby={
                      signIn.instanceMissing === null ? undefined : "login-instance-missing"
                    }
                  />
                  {signIn.instanceMissing !== null && (
                    <FieldDescription id="login-instance-missing">
                      {signIn.instanceMissing}
                    </FieldDescription>
                  )}
                </Field>
                <Field>
                  <FieldLabel htmlFor="login-token">JWT token</FieldLabel>
                  <Input
                    id="login-token"
                    type="password"
                    autoComplete="off"
                    value={signIn.token}
                    aria-describedby="login-token-description"
                    onChange={(event) => signIn.setToken(event.target.value)}
                  />
                  <FieldDescription id="login-token-description">
                    Generate a human token with <code>kanthord jwt generate</code>.
                    {signIn.tokenMissing !== null && <> {signIn.tokenMissing}</>}
                  </FieldDescription>
                </Field>
                {signIn.error !== null && (
                  <Alert variant="destructive">
                    <AlertDescription>{signIn.error}</AlertDescription>
                  </Alert>
                )}
                <Button type="submit" disabled={!signIn.canSubmit}>
                  {signIn.pending ? "Signing in…" : "Sign in"}
                </Button>
              </FieldGroup>
            </form>
          )}
        </CardContent>
      </Card>
      <InstanceManager store={store} manager={manager} />
    </main>
  );
}
