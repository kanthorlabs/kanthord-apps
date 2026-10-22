import { useCallback, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { exportMissionJson, readMission } from "@/api/resources/mission";
import { listProjects, readBindingSet, writeBindingSet } from "@/api/resources/projects";
import { readWorkerInstance } from "@/api/resources/worker-instances";
import type { BindingSet, BindingSetEntry, MissionPlanEntry } from "@/api/types";
import { RecordName } from "@/components/record-name";
import { credentialMessage } from "@/features/credentials/credential-message";
import { consequenceOf } from "@/features/projects/view/use-binding-change-guard";
import { VERSION_CONFLICT } from "@/features/projects/view/use-binding-set";
import { asApiError } from "@/hooks/use-resource";
import { classifyChange, nextBindings, nodesNaming } from "@/lib/binding-change";

export const DETACH_ALL = "all";

export interface DetachScope {
  readonly projectId: string;
  readonly binding: string;
}

export interface DetachChoice extends DetachScope {
  readonly key: string;
  readonly projectName: string;
}

export type DetachStepKind = "revise" | "disable" | "gone";

export interface DetachStep {
  readonly choice: DetachChoice;
  readonly kind: DetachStepKind;
  readonly after: BindingSetEntry | null;
  readonly consequence: ReactNode;
  readonly nodes: readonly MissionPlanEntry[] | null;
  readonly nodesError: string | null;
}

export type DetachPhase = "closed" | "reading" | "choose" | "confirm" | "writing";

export interface InstanceDetachState {
  readonly instance: string | null;
  readonly phase: DetachPhase;
  readonly choices: readonly DetachChoice[];
  readonly selection: string | null;
  readonly steps: readonly DetachStep[];
  readonly error: string | null;
  readonly writable: boolean;
  readonly request: (instance: string, scope: DetachScope | null) => void;
  readonly select: (key: string) => void;
  readonly proceed: () => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

interface WriteOutcome {
  readonly choices: readonly DetachChoice[];
  readonly failure: string | null;
}

function keyOf(scope: DetachScope): string {
  return `${scope.projectId}/${scope.binding}`;
}

export function detachedEntryOf(
  entry: BindingSetEntry | undefined,
  instance: string,
): BindingSetEntry | null {
  if (entry?.kind !== "worker" || entry.config.placement !== "worker") return null;
  const listed = entry.config.worker_instances ?? [];
  if (!listed.includes(instance)) return null;
  return {
    ...entry,
    config: { ...entry.config, worker_instances: listed.filter((name) => name !== instance) },
  };
}

function stepConsequence(
  choice: DetachChoice,
  instance: string,
  kind: DetachStepKind,
  before: BindingSetEntry | undefined,
  after: BindingSetEntry | null,
): ReactNode {
  const binding = <RecordName>{choice.binding}</RecordName>;
  const project = <RecordName>{choice.projectName}</RecordName>;
  const name = <RecordName>{instance}</RecordName>;
  if (kind === "gone") {
    return (
      <>
        {binding} of {project} no longer lists {name}. Nothing changes there.
      </>
    );
  }
  if (kind === "disable") {
    return (
      <>
        {name} is the last instance of {binding} of {project}.{" "}
        {consequenceOf({ name: choice.binding, before, after, kind: "disable" })}
      </>
    );
  }
  return (
    <>
      {binding} of {project} stops listing {name}. Its other instances keep serving it. A
      registration of {name} for {binding} drains.
    </>
  );
}

async function readNodes(projectId: string): Promise<readonly MissionPlanEntry[]> {
  const mission = await readMission(projectId);
  return (await exportMissionJson(mission.id)).entries;
}

async function planOf(
  instance: string,
  choices: readonly DetachChoice[],
): Promise<{ steps: readonly DetachStep[]; sets: ReadonlyMap<string, BindingSet> }> {
  const projectIds = [...new Set(choices.map((choice) => choice.projectId))];
  const read = await Promise.all(projectIds.map((id) => readBindingSet(id)));
  const sets = new Map(projectIds.map((id, index) => [id, read[index] as BindingSet]));
  const drafts = choices.map((choice) => {
    const before = sets.get(choice.projectId)?.bindings[choice.binding];
    const after = detachedEntryOf(before, instance);
    const kind: DetachStepKind =
      after === null
        ? "gone"
        : classifyChange(choice.binding, before, after) === "disable"
          ? "disable"
          : "revise";
    return { choice, before, after, kind };
  });
  const guardedProjects = [
    ...new Set(
      drafts.filter((draft) => draft.kind === "disable").map((draft) => draft.choice.projectId),
    ),
  ];
  const nodeReads = await Promise.all(
    guardedProjects.map((id) =>
      readNodes(id).then(
        (entries) => ({ entries, error: null }),
        (cause: unknown) => ({ entries: null, error: asApiError(cause).message }),
      ),
    ),
  );
  const nodesOf = new Map(guardedProjects.map((id, index) => [id, nodeReads[index]]));
  const steps = drafts.map(({ choice, before, after, kind }) => {
    const read = kind === "disable" ? nodesOf.get(choice.projectId) : undefined;
    return {
      choice,
      kind,
      after,
      consequence: stepConsequence(choice, instance, kind, before, after),
      nodes: read?.entries == null ? null : nodesNaming(read.entries, choice.binding),
      nodesError: read?.error ?? null,
    };
  });
  return { steps, sets };
}

function failureOf(cause: unknown, projectName: string): string {
  const failure = asApiError(cause);
  if (failure.status === 409 && failure.detail === VERSION_CONFLICT) {
    return `Someone else saved the binding set of ${projectName} after this read. Nothing changed in ${projectName}.`;
  }
  return credentialMessage(failure);
}

async function writeSteps(
  steps: readonly DetachStep[],
  sets: ReadonlyMap<string, BindingSet>,
): Promise<readonly WriteOutcome[]> {
  const outcomes: WriteOutcome[] = [];
  for (const [projectId, set] of sets) {
    const own = steps.filter((step) => step.choice.projectId === projectId && step.after !== null);
    if (own.length === 0) continue;
    const next = own.reduce(
      (bindings, step) => nextBindings(bindings, step.choice.binding, step.after),
      set.bindings,
    );
    const choices = own.map((step) => step.choice);
    try {
      await writeBindingSet(projectId, set.version, next);
      outcomes.push({ choices, failure: null });
    } catch (cause: unknown) {
      outcomes.push({ choices, failure: failureOf(cause, choices[0]?.projectName ?? projectId) });
    }
  }
  return outcomes;
}

function choiceLine(choice: DetachChoice): ReactNode {
  return (
    <>
      <RecordName>{choice.binding}</RecordName> of <RecordName>{choice.projectName}</RecordName>
    </>
  );
}

function reportOutcomes(instance: string, outcomes: readonly WriteOutcome[]): void {
  const failed = outcomes.filter((outcome) => outcome.failure !== null);
  const lines = outcomes.flatMap((outcome) =>
    outcome.choices.map((choice) => (
      <span key={keyOf(choice)} className="block">
        {outcome.failure === null ? "Detached from " : "Not detached from "}
        {choiceLine(choice)}
        {outcome.failure === null ? "." : `: ${outcome.failure}`}
      </span>
    )),
  );
  if (failed.length === 0) {
    toast.success(`Detached ${instance}.`, { description: <>{lines}</> });
    return;
  }
  toast.error(
    failed.length === outcomes.length
      ? `Detaching ${instance} failed.`
      : `Detaching ${instance} failed in part.`,
    { description: <>{lines}</> },
  );
}

export function useInstanceDetach(onChanged: () => void): InstanceDetachState {
  const [instance, setInstance] = useState<string | null>(null);
  const [phase, setPhase] = useState<DetachPhase>("closed");
  const [choices, setChoices] = useState<readonly DetachChoice[]>([]);
  const [selection, setSelection] = useState<string | null>(null);
  const [steps, setSteps] = useState<readonly DetachStep[]>([]);
  const [sets, setSets] = useState<ReadonlyMap<string, BindingSet>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const prepare = useCallback((name: string, selected: readonly DetachChoice[]) => {
    setPhase("reading");
    planOf(name, selected).then(
      (plan) => {
        setSteps(plan.steps);
        setSets(plan.sets);
        setPhase("confirm");
      },
      (cause: unknown) => {
        setSteps([]);
        setError(asApiError(cause).message);
        setPhase("confirm");
      },
    );
  }, []);

  const request = useCallback(
    (name: string, scope: DetachScope | null) => {
      setInstance(name);
      setChoices([]);
      setSelection(null);
      setSteps([]);
      setError(null);
      setPhase("reading");
      Promise.all([readWorkerInstance(name), listProjects()]).then(
        ([detail, projects]) => {
          const listed = detail.bindings
            .map((binding) => ({
              key: keyOf({ projectId: binding.project_id, binding: binding.binding }),
              projectId: binding.project_id,
              binding: binding.binding,
              projectName:
                projects.find((project) => project.id === binding.project_id)?.name ??
                binding.project_id,
            }))
            .filter((choice) => scope === null || choice.key === keyOf(scope));
          setChoices(listed);
          if (listed.length === 0) {
            setError(`No binding lists ${name} now. The page now shows the current state.`);
            setPhase("confirm");
            onChanged();
            return;
          }
          if (listed.length === 1) {
            prepare(name, listed);
            return;
          }
          setPhase("choose");
        },
        (cause: unknown) => {
          setError(asApiError(cause).message);
          setPhase("confirm");
        },
      );
    },
    [prepare, onChanged],
  );

  const proceed = useCallback(() => {
    if (instance === null || selection === null) return;
    const selected =
      selection === DETACH_ALL ? choices : choices.filter((choice) => choice.key === selection);
    prepare(instance, selected);
  }, [instance, selection, choices, prepare]);

  const cancel = useCallback(() => {
    if (phase !== "writing") setPhase("closed");
  }, [phase]);

  const writable = phase === "confirm" && steps.some((step) => step.after !== null);

  const confirm = useCallback(() => {
    if (!writable || instance === null) return;
    setPhase("writing");
    void writeSteps(steps, sets).then((outcomes) => {
      reportOutcomes(instance, outcomes);
      setPhase("closed");
      onChanged();
    });
  }, [writable, instance, steps, sets, onChanged]);

  return {
    instance,
    phase,
    choices,
    selection,
    steps,
    error,
    writable,
    request,
    select: setSelection,
    proceed,
    cancel,
    confirm,
  };
}
