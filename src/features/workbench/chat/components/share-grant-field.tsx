import type { GrantableOperation } from "@/api/types";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  type GrantGroup,
  grantGroupsOf,
  groupCheckStateOf,
  withGroupChecked,
  withOperationChecked,
} from "@/lib/share-invite";

const WARNING =
  "Anyone who holds this link can run the checked acts in your name, on the selected projects, without your approval, until the link expires or you revoke it. Auto mode off stops them.";

interface ShareGrantFieldProps {
  readonly name: string;
  readonly grantable: readonly GrantableOperation[];
  readonly checked: readonly string[];
  readonly onChange: (ids: readonly string[]) => void;
}

interface GroupProps {
  readonly group: GrantGroup;
  readonly name: string;
  readonly checked: readonly string[];
  readonly onChange: (ids: readonly string[]) => void;
}

function GrantGroupControl({ group, name, checked, onChange }: GroupProps) {
  const state = groupCheckStateOf(group.operations, checked);
  const groupId = `share-grant-${group.guardClass}`;
  return (
    <div role="group" aria-labelledby={groupId} className="flex min-w-0 flex-col gap-2">
      <Field orientation="horizontal">
        <Checkbox
          id={`${groupId}-box`}
          checked={state === "all"}
          indeterminate={state === "some"}
          onCheckedChange={(next) => onChange(withGroupChecked(checked, group.operations, next))}
        />
        <FieldLabel id={groupId} htmlFor={`${groupId}-box`}>
          {group.label}
        </FieldLabel>
      </Field>
      <FieldDescription>{group.line(name)}</FieldDescription>
      <ul className="flex min-w-0 flex-col gap-2 pl-6">
        {group.operations.map((operation) => (
          <li key={operation.operation_id} className="min-w-0">
            <Field orientation="horizontal">
              <Checkbox
                id={`share-grant-${operation.operation_id}`}
                checked={checked.includes(operation.operation_id)}
                onCheckedChange={(next) =>
                  onChange(withOperationChecked(checked, operation.operation_id, next))
                }
              />
              <FieldLabel htmlFor={`share-grant-${operation.operation_id}`}>
                <code className="font-mono break-all">{operation.operation_id}</code>
              </FieldLabel>
            </Field>
            <FieldDescription className="pl-6">{operation.description}</FieldDescription>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ShareGrantField({ name, grantable, checked, onChange }: ShareGrantFieldProps) {
  const who = name.trim() === "" ? "the guest" : name.trim();
  return (
    <section aria-labelledby="share-grant-heading" className="flex min-w-0 flex-col gap-3">
      <h3 id="share-grant-heading" className="font-semibold">
        What {who} may do without your approval
      </h3>
      <FieldDescription>
        Nothing checked: you approve every act in a run that {who} starts.
      </FieldDescription>
      {grantGroupsOf(grantable).map((group) => (
        <GrantGroupControl
          key={group.guardClass}
          group={group}
          name={who}
          checked={checked}
          onChange={onChange}
        />
      ))}
      {checked.length > 0 && (
        <Alert variant="destructive">
          <AlertDescription>{WARNING}</AlertDescription>
        </Alert>
      )}
    </section>
  );
}
