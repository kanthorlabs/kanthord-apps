import {
  CAUSE_CATEGORIES,
  CAUSE_SUBCATEGORIES,
  type CauseLabel,
  type EffectiveCause,
} from "@/api/types";
import { TouchTarget } from "@/components/touch-target";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { CAUSE_CATEGORY_LABELS, subcategoryText } from "@/lib/trace-cause";

import { useCauseLabel } from "../use-cause-label";
import { useLargeScreen } from "../use-large-screen";

interface LabelCauseSheetProps {
  readonly traceId: string;
  readonly cause: EffectiveCause;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onLabeled: (label: CauseLabel) => void;
}

const CATEGORY_ITEMS = CAUSE_CATEGORIES.filter((category) => category !== "unattributed").map(
  (category) => ({ value: category, label: CAUSE_CATEGORY_LABELS[category] }),
);

type LabelCauseFormProps = Omit<LabelCauseSheetProps, "open">;

function LabelCauseForm({ traceId, cause, onOpenChange, onLabeled }: LabelCauseFormProps) {
  const label = useCauseLabel(traceId, cause, (answer) => {
    onLabeled(answer);
    onOpenChange(false);
  });
  const { draft, errors } = label;
  const subcategoryItems = CAUSE_SUBCATEGORIES[draft.category].map((subcategory) => ({
    value: subcategory,
    label: subcategoryText(subcategory),
  }));
  return (
    <form
      noValidate
      aria-label="Label cause"
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        label.submit();
      }}
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
        {label.failure !== null && (
          <Alert variant="destructive">
            <AlertDescription>{label.failure}</AlertDescription>
          </Alert>
        )}
        <FieldGroup>
          <Field data-invalid={errors.category !== undefined}>
            <FieldLabel htmlFor="cause-category">Category</FieldLabel>
            <Select
              items={CATEGORY_ITEMS}
              value={draft.category === "unattributed" ? null : draft.category}
              onValueChange={(value) => {
                const next = CATEGORY_ITEMS.find((item) => item.value === value);
                if (next !== undefined) label.setCategory(next.value);
              }}
            >
              <TouchTarget>
                <SelectTrigger
                  id="cause-category"
                  className="w-full"
                  aria-invalid={errors.category !== undefined}
                >
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
              </TouchTarget>
              <SelectContent>
                {CATEGORY_ITEMS.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError>{errors.category}</FieldError>
          </Field>
          <Field data-invalid={errors.subcategory !== undefined}>
            <FieldLabel htmlFor="cause-subcategory">Subcategory</FieldLabel>
            <Select
              items={subcategoryItems}
              value={draft.subcategory}
              onValueChange={(value) => {
                const next = subcategoryItems.find((item) => item.value === value);
                if (next !== undefined) label.setSubcategory(next.value);
              }}
            >
              <TouchTarget>
                <SelectTrigger
                  id="cause-subcategory"
                  className="w-full"
                  aria-invalid={errors.subcategory !== undefined}
                >
                  <SelectValue placeholder="Choose" />
                </SelectTrigger>
              </TouchTarget>
              <SelectContent>
                {subcategoryItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError>{errors.subcategory}</FieldError>
          </Field>
          <Field data-invalid={errors.reason !== undefined}>
            <FieldLabel htmlFor="cause-reason">Reason</FieldLabel>
            <TouchTarget>
              <Textarea
                id="cause-reason"
                value={draft.reason}
                aria-invalid={errors.reason !== undefined}
                onChange={(event) => label.setReason(event.target.value)}
              />
            </TouchTarget>
            <FieldError>{errors.reason}</FieldError>
          </Field>
        </FieldGroup>
      </div>
      <SheetFooter>
        <TouchTarget>
          <Button type="submit" disabled={!label.valid || label.pending}>
            Save label
          </Button>
        </TouchTarget>
        <TouchTarget>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </TouchTarget>
      </SheetFooter>
    </form>
  );
}

export function LabelCauseSheet({
  traceId,
  cause,
  open,
  onOpenChange,
  onLabeled,
}: LabelCauseSheetProps) {
  const large = useLargeScreen();
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side={large ? "right" : "bottom"}>
        <SheetHeader>
          <SheetTitle>Label cause</SheetTitle>
          <SheetDescription>
            Pick the category and the subcategory of the cause, and say why.
          </SheetDescription>
        </SheetHeader>
        <LabelCauseForm
          traceId={traceId}
          cause={cause}
          onOpenChange={onOpenChange}
          onLabeled={onLabeled}
        />
      </SheetContent>
    </Sheet>
  );
}
