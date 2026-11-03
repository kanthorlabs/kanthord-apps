import { ChoiceField } from "@/components/choice-field";
import { SearchChoiceField } from "@/components/search-choice-field";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  FINDING_CAUSE_OWNERS,
  FINDING_KINDS,
  type FindingDraftField,
  NODE_TASK,
  taskChoiceText,
} from "@/lib/finding-draft";
import { assessmentChoiceText } from "@/lib/review-findings";
import type { FindingReportState } from "../use-finding-report";

interface TextAreaFieldProps {
  readonly id: string;
  readonly label: string;
  readonly value: string;
  readonly error: string | undefined;
  readonly description: string;
  readonly onChange: (value: string) => void;
}

function TextAreaField({ id, label, value, error, description, onChange }: TextAreaFieldProps) {
  return (
    <Field data-invalid={error !== undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Textarea
        id={id}
        value={value}
        aria-invalid={error !== undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldDescription>{description}</FieldDescription>
      <FieldError>{error}</FieldError>
    </Field>
  );
}

export function FindingReportSheet({ report }: { report: FindingReportState }) {
  const mobile = useIsMobile();
  const { draft, errors } = report;
  const editing = report.editing;
  const assessmentIds = report.assessmentChoices.map((assessment) => assessment.id);
  const assessmentLabel = (id: string) => assessmentChoiceText(id, report.assessments);
  const taskIds = [NODE_TASK, ...report.tasks.map((task) => task.id)];
  const taskLabel = (id: string) => taskChoiceText(id, report.tasks);
  const set = (field: FindingDraftField) => (value: string | null) =>
    report.setField(field, value ?? "");

  return (
    <Sheet open={report.open} onOpenChange={(open) => !open && report.cancel()}>
      <SheetContent
        side={mobile ? "bottom" : "right"}
        className="data-[side=bottom]:max-h-[85svh] data-[side=right]:w-full data-[side=right]:sm:max-w-xl"
      >
        <SheetHeader>
          <SheetTitle className="mr-8 break-words">
            {editing === null ? "Report a defect" : `Edit the finding ${editing.label}`}
          </SheetTitle>
          <SheetDescription>
            A defect report records a defect that a human found after delivery. It names the
            assessment that missed the defect and the owner of the cause. It changes no node, and it
            waits for a human decision.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4">
          {editing === null ? (
            <SearchChoiceField
              id="finding-report-assessment"
              label="Assessment that missed it"
              value={draft.assessment_id}
              options={assessmentIds}
              labelOf={assessmentLabel}
              error={errors.assessment_id}
              placeholder="Search the assessments"
              emptyText="No assessment matches."
              description="An assessment of an attempt that delivered the code."
              onChange={set("assessment_id")}
            />
          ) : (
            <p className="text-sm break-words">
              Assessment that missed it: {assessmentLabel(editing.assessment_id)}
            </p>
          )}
          <ChoiceField
            id="finding-report-kind"
            label="Kind"
            value={draft.kind}
            options={FINDING_KINDS}
            error={errors.kind}
            onChange={set("kind")}
          />
          <SearchChoiceField
            id="finding-report-task"
            label="Task"
            value={draft.task}
            options={taskIds}
            labelOf={taskLabel}
            error={errors.task}
            placeholder="Search the tasks"
            emptyText="No task matches."
            description="A task of the revision of that assessment, or the node."
            onChange={set("task")}
          />
          <TextField
            id="finding-report-name"
            label="Name"
            value={draft.name}
            error={errors.name}
            description="A short name of the defect."
            onChange={set("name")}
          />
          <TextAreaField
            id="finding-report-description"
            label="Description"
            value={draft.description}
            error={errors.description}
            description="The concrete defect."
            onChange={set("description")}
          />
          <TextAreaField
            id="finding-report-fix"
            label="Fix"
            value={draft.fix}
            error={errors.fix}
            description="The recommended change."
            onChange={set("fix")}
          />
          <TextAreaField
            id="finding-report-why"
            label="Why"
            value={draft.why}
            error={errors.why}
            description="The reason that the defect matters."
            onChange={set("why")}
          />
          <ChoiceField
            id="finding-report-cause-owner"
            label="Owner of the cause"
            value={draft.cause_owner}
            options={FINDING_CAUSE_OWNERS}
            error={errors.cause_owner}
            onChange={set("cause_owner")}
          />
          {report.error !== null && (
            <p role="alert" className="text-sm text-destructive">
              {report.error}
            </p>
          )}
        </div>
        <SheetFooter className="flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            disabled={report.saving}
            onClick={report.cancel}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={report.saving}
            onClick={report.save}
          >
            {editing === null ? "Report the defect" : "Save the finding"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
