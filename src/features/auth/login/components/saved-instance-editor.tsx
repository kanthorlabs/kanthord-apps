import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Item, ItemContent } from "@/components/ui/item";
import type { SavedInstance } from "@/features/auth/instances/instance-storage";
import type { InstanceEditState } from "@/features/auth/instances/use-instance-edit";

interface SavedInstanceEditorProps {
  readonly instance: SavedInstance;
  readonly edit: InstanceEditState;
  readonly onSave: () => void;
}

export function SavedInstanceEditor({ instance, edit, onSave }: SavedInstanceEditorProps) {
  const { draft, errors } = edit;
  const id = (field: string) => `edit-${field}-${instance.id}`;

  return (
    <Item variant="outline" role="listitem" aria-label={`Edit ${instance.name}`}>
      <ItemContent className="min-w-0">
        <form
          noValidate
          aria-label={`Edit ${instance.name}`}
          onSubmit={(event) => {
            event.preventDefault();
            onSave();
          }}
        >
          <FieldGroup>
            <Field data-invalid={errors.name !== undefined}>
              <FieldLabel htmlFor={id("name")}>Name</FieldLabel>
              <Input
                id={id("name")}
                autoComplete="off"
                value={draft.name}
                aria-invalid={errors.name !== undefined}
                onChange={(event) => edit.setField("name", event.target.value)}
              />
              <FieldError>{errors.name}</FieldError>
            </Field>
            <Field data-invalid={errors.baseUrl !== undefined}>
              <FieldLabel htmlFor={id("endpoint")}>Endpoint</FieldLabel>
              <Input
                id={id("endpoint")}
                type="url"
                inputMode="url"
                autoComplete="off"
                value={draft.baseUrl}
                aria-invalid={errors.baseUrl !== undefined}
                onChange={(event) => edit.setField("baseUrl", event.target.value)}
              />
              <FieldError>{errors.baseUrl}</FieldError>
            </Field>
            <Field data-invalid={errors.token !== undefined}>
              <FieldLabel htmlFor={id("token")}>JWT token</FieldLabel>
              <Input
                id={id("token")}
                type="password"
                autoComplete="off"
                value={draft.token}
                aria-invalid={errors.token !== undefined}
                onChange={(event) => edit.setField("token", event.target.value)}
              />
              <FieldError>{errors.token}</FieldError>
            </Field>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" size="lg" onClick={edit.cancel}>
                Cancel
              </Button>
              <Button type="submit" size="lg">
                Save
              </Button>
            </div>
          </FieldGroup>
        </form>
      </ItemContent>
    </Item>
  );
}
