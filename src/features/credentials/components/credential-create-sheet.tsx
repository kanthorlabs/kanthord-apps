import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type { CredentialComponent } from "@/api/types";
import { CreateForm } from "../form/credential-form-screen";
import { LoginSession } from "../form/components/login-session";
import { useCredentialForm } from "../form/use-credential-form";

interface CredentialCreateSheetProps {
  readonly component: CredentialComponent;
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onCreated: (name: string) => void;
}

export function CredentialCreateSheet({
  component,
  open,
  onClose,
  onCreated,
}: CredentialCreateSheetProps) {
  const form = useCredentialForm(component, onCreated, onClose);
  const session = form.login.session;

  return (
    <Sheet open={open} onOpenChange={(next) => !next && !form.login.inProgress && onClose()}>
      <SheetContent
        showCloseButton={!form.login.inProgress}
        className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg"
      >
        <SheetHeader>
          <SheetTitle>
            {session === null ? "New credential" : `Sign in for ${form.name}`}
          </SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto px-4 py-4">
          {form.platforms.loading ? (
            <Skeleton className="h-32 w-full" />
          ) : form.platforms.error !== null ? (
            <div className="flex flex-col items-start gap-2">
              <p className="text-sm text-destructive">{form.platforms.error.message}</p>
              <Button variant="outline" size="sm" onClick={form.platforms.reload}>
                Retry
              </Button>
            </div>
          ) : session === null ? (
            <CreateForm component={component} form={form} />
          ) : (
            <LoginSession login={form.login} session={session} />
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
