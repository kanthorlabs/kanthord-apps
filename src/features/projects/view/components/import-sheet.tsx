import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Item, ItemContent, ItemGroup, ItemTitle } from "@/components/ui/item";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { MissionImportState } from "../use-mission-import";

interface ImportSheetProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly state: MissionImportState;
}

function PreviewList({
  label,
  values,
  empty,
}: {
  label: string;
  values: readonly ReactNode[];
  empty: string;
}) {
  return (
    <section aria-label={label} className="flex flex-col gap-1">
      <h4 className="text-sm font-medium">
        {label} <span className="text-muted-foreground tabular-nums">({values.length})</span>
      </h4>
      {values.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ItemGroup aria-label={label} className="gap-1">
          {values.map((value, index) => (
            <Item key={index} variant="outline" size="sm" role="listitem">
              <ItemContent className="min-w-0">
                <ItemTitle className="min-w-0 break-all">{value}</ItemTitle>
              </ItemContent>
            </Item>
          ))}
        </ItemGroup>
      )}
    </section>
  );
}

export function ImportSheet({ open, onOpenChange, state }: ImportSheetProps) {
  const shown = state.reviewed?.preview;
  const nameOf = (nodeId: string) => state.reviewed?.names.get(nodeId) ?? nodeId;
  const retiring = shown?.retirements.length ?? 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="data-[side=right]:w-full data-[side=right]:sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Import mission</SheetTitle>
          <SheetDescription>
            An import replaces the whole mission. A node that the import omits retires.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
          {state.staleNotice !== null && (
            <Alert variant="destructive">
              <AlertTitle>Preview again</AlertTitle>
              <AlertDescription>{state.staleNotice}</AlertDescription>
            </Alert>
          )}
          {state.error !== null && (
            <Alert variant="destructive">
              <AlertTitle>The daemon refused the import.</AlertTitle>
              <AlertDescription>{state.error.message}</AlertDescription>
            </Alert>
          )}
          <FieldGroup>
            <Field data-invalid={state.inputError !== null}>
              <FieldLabel htmlFor="mission-import-files">Plan files</FieldLabel>
              <Input
                id="mission-import-files"
                type="file"
                multiple
                accept=".json,.md"
                aria-invalid={state.inputError !== null}
                onChange={(event) => state.pickFiles(Array.from(event.target.files ?? []))}
              />
              <FieldDescription>
                One .json mission export, or one or more .md plan files.
              </FieldDescription>
              <FieldError>{state.inputError}</FieldError>
            </Field>
            <Field>
              <FieldLabel htmlFor="mission-import-reason">Reason</FieldLabel>
              <Textarea
                id="mission-import-reason"
                value={state.reason}
                onChange={(event) => state.setReason(event.target.value)}
              />
              <FieldDescription>Required. Every node revision records it.</FieldDescription>
            </Field>
            <Button variant="outline" disabled={!state.canPreview} onClick={state.preview}>
              Preview
            </Button>
          </FieldGroup>
          {shown !== undefined && (
            <div className="flex flex-col gap-4 border-t pt-4">
              {shown.violations.length > 0 && (
                <Alert variant="destructive">
                  <AlertTitle>The import cannot apply.</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc pl-4">
                      {shown.violations.map((violation, index) => (
                        <li key={index}>
                          {violation.filename !== null && `${violation.filename}: `}
                          {violation.message}
                        </li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
              <PreviewList label="Creates" values={shown.creates} empty="No new nodes." />
              <PreviewList
                label="Updates"
                values={shown.updates.map(nameOf)}
                empty="No node changes."
              />
              <PreviewList
                label="Retirements"
                values={shown.retirements.map(nameOf)}
                empty="No node retires."
              />
              <p className="text-sm text-muted-foreground">
                {shown.noOps.length} nodes stay unchanged. {shown.removedEdges.length} edges are
                removed.
              </p>
              {retiring > 0 && (
                <Field orientation="horizontal">
                  <Switch
                    id="mission-import-retire"
                    checked={state.retirementsConfirmed}
                    onCheckedChange={state.confirmRetirements}
                  />
                  <FieldLabel htmlFor="mission-import-retire">
                    Retire all {retiring} nodes listed above. To keep one, add it to the import and
                    preview again.
                  </FieldLabel>
                </Field>
              )}
            </div>
          )}
        </div>
        <SheetFooter>
          <Button disabled={!state.canApply} onClick={state.apply}>
            {retiring > 0 ? `Apply and retire ${retiring} nodes` : "Apply import"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
