import { useEffect, useRef } from "react";

import { RecordName } from "@/components/record-name";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { counted } from "@/lib/counted";
import { DETACH_ALL, type DetachStep, type InstanceDetachState } from "../use-instance-detach";

function StepNodes({ step }: { step: DetachStep }) {
  if (step.kind !== "disable") return null;
  if (step.nodesError !== null) {
    return (
      <p className="text-destructive">The mission nodes could not be read: {step.nodesError}</p>
    );
  }
  if (step.nodes === null || step.nodes.length === 0) {
    return <p className="text-muted-foreground">No current mission node names it.</p>;
  }
  return (
    <>
      <p>
        {counted(step.nodes.length, "current mission node names", "current mission nodes name")} it.
      </p>
      <ul className="list-disc pl-4">
        {step.nodes.map((node) => (
          <li key={node.filename} className="break-words">
            {node.name}
          </li>
        ))}
      </ul>
    </>
  );
}

function ChooseBinding({ detach }: { detach: InstanceDetachState }) {
  return (
    <Field>
      <FieldLabel id="detach-target">Detach from</FieldLabel>
      <RadioGroup
        aria-labelledby="detach-target"
        value={detach.selection}
        onValueChange={(value) => {
          if (typeof value === "string") detach.select(value);
        }}
      >
        {detach.choices.map((choice) => (
          <Field key={choice.key} orientation="horizontal">
            <RadioGroupItem id={`detach-${choice.key}`} value={choice.key} />
            <FieldLabel htmlFor={`detach-${choice.key}`}>
              <span className="min-w-0 break-words">
                {choice.binding} of {choice.projectName}
              </span>
            </FieldLabel>
          </Field>
        ))}
        <Field orientation="horizontal">
          <RadioGroupItem id="detach-all" value={DETACH_ALL} />
          <FieldLabel htmlFor="detach-all">
            All {counted(detach.choices.length, "binding", "bindings")}
          </FieldLabel>
        </Field>
      </RadioGroup>
    </Field>
  );
}

export function DetachInstanceDialog({ detach }: { detach: InstanceDetachState }) {
  const name = detach.instance ?? "";
  const writing = detach.phase === "writing";
  const keepRef = useRef<HTMLButtonElement>(null);
  const choosing = detach.phase === "choose";
  const opened = detach.phase !== "closed";
  useEffect(() => {
    if (opened && !choosing) keepRef.current?.focus();
  }, [opened, choosing]);
  return (
    <AlertDialog open={detach.phase !== "closed"} onOpenChange={(open) => !open && detach.cancel()}>
      <AlertDialogContent className="max-h-[90dvh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>Detach {name}?</AlertDialogTitle>
          <AlertDialogDescription>
            {detach.phase === "choose" ? (
              <>
                {counted(detach.choices.length, "binding lists", "bindings list")}{" "}
                <RecordName>{name}</RecordName>. Choose the binding to detach it from, or all of
                them.
              </>
            ) : (
              <>
                A detach removes <RecordName>{name}</RecordName> from the instance list of a
                binding. The instance itself stays.
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {detach.phase === "reading" && (
          <p className="text-sm text-muted-foreground">Reading the bindings that list it…</p>
        )}
        {detach.phase === "choose" && <ChooseBinding detach={detach} />}
        {(detach.phase === "confirm" || writing) && detach.steps.length > 0 && (
          <ul aria-label="Changes" className="flex flex-col gap-3 text-sm">
            {detach.steps.map((step) => (
              <li key={step.choice.key} className="flex flex-col gap-1 break-words">
                <p>{step.consequence}</p>
                <StepNodes step={step} />
              </li>
            ))}
          </ul>
        )}
        {detach.steps.some((step) => step.kind === "disable") && (
          <p className="text-sm text-muted-foreground">
            To keep a binding available, add another instance to it first.
          </p>
        )}
        {detach.error !== null && (
          <p role="alert" className="text-sm text-destructive">
            {detach.error}
          </p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel ref={keepRef} disabled={writing}>
            Keep {name}
          </AlertDialogCancel>
          {detach.phase === "choose" ? (
            <Button disabled={detach.selection === null} onClick={detach.proceed}>
              Continue
            </Button>
          ) : (
            <AlertDialogAction
              variant="destructive"
              disabled={!detach.writable}
              onClick={detach.confirm}
            >
              Detach {name}
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
