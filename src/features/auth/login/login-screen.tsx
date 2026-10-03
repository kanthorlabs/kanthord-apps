import { DataList } from "@/components/data-list";
import { Toaster } from "@/components/ui/sonner";
import { useInstances } from "@/features/auth/instances/use-instances";
import { SavedInstanceEditor } from "./components/saved-instance-editor";
import { SavedInstanceItem } from "./components/saved-instance-item";
import { SignInForm } from "./components/sign-in-form";
import { useSavedInstances } from "./use-saved-instances";
import { useSignIn } from "./use-sign-in";

export function LoginScreen() {
  const store = useInstances();
  const form = useSignIn(store);
  const saved = useSavedInstances(store);

  return (
    <main className="flex min-h-svh justify-center bg-muted/40 px-4 py-10">
      <div className="flex w-full max-w-xl min-w-0 flex-col gap-6">
        <SignInForm form={form} />
        {saved.rows.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Saved instances</h2>
            <DataList
              label="Saved instances"
              items={saved.rows}
              getKey={(row) => row.instance.id}
              status="ready"
              error={null}
              pending={false}
              onRetry={() => undefined}
              emptyText="No saved instances. A successful login saves its instance here."
              renderItem={(row) =>
                row.mode === "edit" ? (
                  <SavedInstanceEditor
                    instance={row.instance}
                    edit={saved.edit}
                    onSave={saved.saveEdit}
                  />
                ) : (
                  <SavedInstanceItem
                    row={row}
                    busy={saved.busy}
                    onSignIn={saved.signInWith}
                    onVerify={saved.verify}
                    onEdit={saved.startEdit}
                    onDelete={saved.requestDelete}
                    onConfirmDelete={saved.confirmDelete}
                    onCancelDelete={saved.cancelDelete}
                  />
                )
              }
            />
          </div>
        )}
      </div>
      <Toaster position="top-right" />
    </main>
  );
}
