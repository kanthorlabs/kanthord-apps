import { listProjects } from "@/api/resources/projects";
import type { GuestLine } from "@/lib/guest-chat";
import type { WorkbenchProjectRef } from "@/api/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
  ComboboxValue,
  useComboboxAnchor,
} from "@/components/ui/combobox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { useResource } from "@/hooks/use-resource";
import { projectRefLabel } from "@/lib/share-invite";
import { useShareProjects } from "../use-share-projects";
import { InlineError } from "./inline-error";

const LABEL = "Projects (required, 1 to 50)";
const LOCKED_LINE =
  "Every invite of this conversation shares these projects. Revoke every invite to change them.";

interface ShareProjectsFieldProps {
  readonly selected: readonly string[];
  readonly locked: readonly WorkbenchProjectRef[] | null;
  readonly failure: GuestLine | null;
  readonly exceeded: boolean;
  readonly onChange: (ids: readonly string[]) => void;
}

export function ShareProjectsField({
  selected,
  locked,
  failure,
  exceeded,
  onChange,
}: ShareProjectsFieldProps) {
  const anchor = useComboboxAnchor();
  const projects = useResource(listProjects, []);
  const { projectIds, labelOf } = useShareProjects(projects.data, locked);

  if (locked !== null) {
    return (
      <Field>
        <FieldLabel>{LABEL}</FieldLabel>
        <ul aria-label="Projects of the live invites" className="flex flex-wrap gap-1.5">
          {locked.map((project) => (
            <li key={project.id}>
              <Badge variant="secondary">{projectRefLabel(project)}</Badge>
            </li>
          ))}
        </ul>
        <FieldDescription>{LOCKED_LINE}</FieldDescription>
      </Field>
    );
  }

  return (
    <Field>
      <FieldLabel htmlFor="share-projects">{LABEL}</FieldLabel>
      <Combobox
        multiple
        items={projectIds}
        value={[...selected]}
        onValueChange={onChange}
        itemToStringLabel={labelOf}
      >
        <ComboboxChips ref={anchor}>
          <ComboboxValue>
            {(ids: readonly string[]) => (
              <>
                {ids.map((id) => (
                  <ComboboxChip key={id}>{labelOf(id)}</ComboboxChip>
                ))}
                <ComboboxChipsInput id="share-projects" placeholder="Search projects…" />
              </>
            )}
          </ComboboxValue>
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          <ComboboxEmpty>No project matches.</ComboboxEmpty>
          <ComboboxList>
            {(id: string) => (
              <ComboboxItem key={id} value={id}>
                {labelOf(id)}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={projectIds.length === 0}
          onClick={() => onChange(projectIds)}
        >
          Select all
        </Button>
      </div>
      {projects.error !== null && <InlineError code={null} message={projects.error.message} />}
      {selected.length === 0 && <FieldDescription>Select at least one project.</FieldDescription>}
      {exceeded && <FieldDescription>Select at most 50 projects.</FieldDescription>}
      {failure !== null && <InlineError code={failure.code} message={failure.message} />}
    </Field>
  );
}
