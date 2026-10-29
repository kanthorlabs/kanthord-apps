import { useCallback } from "react";

import type { WorkerInstanceListItem } from "@/api/types";
import type { Resource } from "@/hooks/use-resource";
import type { BindingDraft, DraftErrors, WorkerDraft } from "@/lib/binding-draft";
import type { BindingDraftState, BindingTarget } from "./use-binding-draft";
import { showsWorkerEnvironment } from "./use-binding-environment";
import { type InstanceAddState, useInstanceAdd } from "./use-instance-add";
import { type InstanceSharing, useInstanceSharing } from "./use-instance-sharing";
import { instanceOptionsOf, useWorkerInstanceChoices } from "./use-worker-instance-choices";

const NO_NAMES: readonly string[] = [];
const ENVIRONMENT_REQUIRED =
  "Choose the repository binding whose image the container instances run.";

export interface WorkerInstanceForm {
  readonly choices: Resource<readonly WorkerInstanceListItem[]>;
  readonly sharing: Resource<readonly InstanceSharing[]>;
  readonly add: InstanceAddState;
  readonly saved: readonly string[];
  readonly environmentShown: boolean;
  readonly edit: (next: BindingDraft) => void;
  readonly validate: () => ReturnType<BindingDraftState["validate"]>;
}

function isNative(draft: BindingDraft): draft is WorkerDraft {
  return draft.kind === "worker" && draft.instanceCount === null;
}

function savedInstancesOf(target: BindingTarget): readonly string[] {
  const entry = target.entry;
  if (entry?.kind !== "worker" || !("worker_instances" in entry.config)) return NO_NAMES;
  return entry.config.worker_instances;
}

export function useWorkerInstanceForm(
  projectId: string,
  form: BindingDraftState,
  target: BindingTarget,
  repositoryNames: readonly string[],
): WorkerInstanceForm {
  const { draft, edit: editDraft, validate: validateDraft } = form;
  const native = isNative(draft);
  const worker = draft.kind === "worker" ? draft.worker : "";
  const selected = native ? draft.instances : NO_NAMES;
  const choices = useWorkerInstanceChoices(worker, native);
  const sharing = useInstanceSharing(projectId, selected);
  const live = choices.data;
  const environmentShown =
    native && showsWorkerEnvironment(instanceOptionsOf(live ?? [], selected), selected);

  const edit = useCallback(
    (next: BindingDraft) => {
      const dropsEnvironment =
        isNative(next) &&
        next.environment !== "" &&
        (draft.kind !== "worker" ||
          next.worker !== draft.worker ||
          (live !== null &&
            !showsWorkerEnvironment(instanceOptionsOf(live, next.instances), next.instances)));
      editDraft(dropsEnvironment ? { ...next, environment: "" } : next);
    },
    [draft, live, editDraft],
  );

  const add = useInstanceAdd(worker, (name) => {
    choices.reload();
    if (native) edit({ ...draft, instances: [...draft.instances, name] });
  });

  const validate = useCallback(() => {
    const missingEnvironment =
      environmentShown &&
      draft.kind === "worker" &&
      draft.environment.trim() === "" &&
      repositoryNames.length >= 2;
    const extra: DraftErrors = missingEnvironment ? { environment: ENVIRONMENT_REQUIRED } : {};
    const names = native ? (live?.map((instance) => instance.name) ?? null) : null;
    return validateDraft(names, extra);
  }, [environmentShown, draft, repositoryNames, native, live, validateDraft]);

  return {
    choices,
    sharing,
    add,
    saved: savedInstancesOf(target),
    environmentShown,
    edit,
    validate,
  };
}
