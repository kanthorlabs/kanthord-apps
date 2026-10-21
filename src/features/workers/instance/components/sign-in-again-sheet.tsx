import { RecordName } from "@/components/record-name";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LoginSession } from "@/features/credentials/form/components/login-session";
import type { InstanceSignInState } from "../use-instance-sign-in";

export function SignInAgainSheet({
  instanceName,
  signIn,
}: {
  instanceName: string;
  signIn: InstanceSignInState;
}) {
  const copy = signIn.copy;
  const session = signIn.login.session;
  return (
    <Sheet open={copy !== null} onOpenChange={(open) => !open && signIn.close()}>
      <SheetContent
        className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
        showCloseButton={!signIn.login.inProgress}
      >
        <SheetHeader>
          <SheetTitle>Sign in again to {copy?.name}</SheetTitle>
          <SheetDescription>
            The sign-in becomes the next revision of the copy held by{" "}
            <RecordName>{instanceName}</RecordName>, sealed to its current key.
          </SheetDescription>
        </SheetHeader>
        {session !== null ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-4">
            <LoginSession login={signIn.login} session={session} />
          </div>
        ) : (
          <form
            noValidate
            aria-label={`Sign in again to ${copy?.name ?? ""}`}
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(event) => {
              event.preventDefault();
              signIn.submit();
            }}
          >
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
              {signIn.login.startError !== null && (
                <Alert variant="destructive">
                  <AlertTitle>The sign-in did not start.</AlertTitle>
                  <AlertDescription>{signIn.login.startError}</AlertDescription>
                </Alert>
              )}
              <p className="text-sm text-muted-foreground">
                The instance runs this sign-in in {signIn.copyCode ? "copy-code" : "device-code"}{" "}
                mode and seals the result to its own key. The instance must be connected.
              </p>
            </div>
            <SheetFooter>
              <Button type="submit" disabled={signIn.login.starting}>
                Start sign-in
              </Button>
              <Button type="button" variant="outline" onClick={signIn.close}>
                Cancel
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
