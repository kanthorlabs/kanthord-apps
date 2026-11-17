import { cn } from "cn";
import { useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InlineError } from "@/features/workbench/chat/components/inline-error";
import { GuestChat } from "./guest-chat";
import { useJoin } from "./use-join";

export function JoinScreen() {
  const { token = "" } = useParams();
  const join = useJoin(token);
  const { nameError, failure } = join;

  if (join.session.guest !== null) return <GuestChat />;

  return (
    <main className="flex min-h-svh justify-center bg-muted/40 px-4 py-10">
      <Card
        className={cn(
          "h-fit w-full max-w-xl min-w-0",
          failure !== null && "border border-destructive",
        )}
      >
        <CardHeader>
          <CardTitle>Join the conversation</CardTitle>
          <CardDescription>Enter the name that the others see in the chat.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            noValidate
            aria-label="Join"
            onSubmit={(event) => {
              event.preventDefault();
              void join.submit();
            }}
          >
            <FieldGroup>
              <Field data-invalid={nameError !== null}>
                <FieldLabel htmlFor="join-name">Name</FieldLabel>
                <Input
                  id="join-name"
                  autoComplete="off"
                  value={join.name}
                  aria-invalid={nameError !== null}
                  onChange={(event) => join.setName(event.target.value)}
                />
                {typeof nameError === "string" && <FieldError>{nameError}</FieldError>}
                {nameError !== null && typeof nameError !== "string" && (
                  <InlineError code={nameError.code} message={nameError.message} />
                )}
              </Field>
              <Button type="submit" disabled={join.pending}>
                Join
              </Button>
              {failure !== null && <InlineError code={failure.code} message={failure.message} />}
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
