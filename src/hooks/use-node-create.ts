import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import { createMissionNode, readMission } from "@/api/resources/mission";
import { listBindings } from "@/api/resources/projects";
import type { ExternalLink, Intent, ProjectBindingRecord } from "@/api/types";
import { asApiError, type Resource, useResource } from "@/hooks/use-resource";
import {
  conversationBindingIdsOf,
  emptyNodeCreateDraft,
  nodeCreateBodyOf,
  type NodeCreateDraft,
  type NodeCreateErrors,
  nodeCreateErrorsOf,
} from "@/lib/node-create-draft";

const NO_BINDINGS: readonly ProjectBindingRecord[] = [];

const CONFLICT_MESSAGES: Readonly<Record<string, string>> = {
  "mission.node.filename_conflict": "A node file with this name exists. Enter another file name.",
  "mission.version.conflict":
    "The mission changed after this read. Review the fields and create the node again.",
};

export interface NodeCreateInput {
  readonly projectId: string;
  readonly link: ExternalLink;
  readonly subject: string;
  readonly onClose: () => void;
  readonly onCreated: () => void;
}

export interface NodeCreateState {
  readonly draft: NodeCreateDraft;
  readonly bindings: Resource<readonly ProjectBindingRecord[]>;
  readonly choices: readonly ProjectBindingRecord[];
  readonly errors: NodeCreateErrors;
  readonly error: string | null;
  readonly creating: boolean;
  readonly setText: (
    field: "filename" | "name" | "requirement" | "criterion",
    text: string,
  ) => void;
  readonly setVerification: (index: number, text: string) => void;
  readonly addVerification: () => void;
  readonly removeVerification: (index: number) => void;
  readonly setIntent: (intent: Intent) => void;
  readonly toggleBinding: (id: string, picked: boolean) => void;
  readonly cancel: () => void;
  readonly submit: () => void;
}

export function useNodeCreate({
  projectId,
  link,
  subject,
  onClose,
  onCreated,
}: NodeCreateInput): NodeCreateState {
  const bindings = useResource(() => listBindings(projectId), [projectId]);
  const [base, setBase] = useState<NodeCreateDraft>(emptyNodeCreateDraft);
  const [picked, setPicked] = useState<readonly string[] | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const records = bindings.data ?? NO_BINDINGS;
  const choices = useMemo(
    () => records.filter((binding) => binding.removed_at === null),
    [records],
  );
  const draft = useMemo(
    () => ({ ...base, bindings: picked ?? conversationBindingIdsOf(records, link) }),
    [base, picked, records, link],
  );
  const errors = useMemo(() => nodeCreateErrorsOf(draft, choices), [draft, choices]);

  const setText = useCallback(
    (field: "filename" | "name" | "requirement" | "criterion", text: string) =>
      setBase((current) => ({ ...current, [field]: text })),
    [],
  );
  const setVerification = useCallback(
    (index: number, text: string) =>
      setBase((current) => ({
        ...current,
        verifications: current.verifications.map((entry, at) => (at === index ? text : entry)),
      })),
    [],
  );
  const addVerification = useCallback(
    () => setBase((current) => ({ ...current, verifications: [...current.verifications, ""] })),
    [],
  );
  const removeVerification = useCallback(
    (index: number) =>
      setBase((current) => ({
        ...current,
        verifications: current.verifications.filter((_, at) => at !== index),
      })),
    [],
  );
  const setIntent = useCallback(
    (intent: Intent) => setBase((current) => ({ ...current, intent })),
    [],
  );
  const toggleBinding = useCallback(
    (id: string, on: boolean) =>
      setPicked((current) => {
        const held = current ?? conversationBindingIdsOf(records, link);
        return on
          ? [...held.filter((entry) => entry !== id), id]
          : held.filter((entry) => entry !== id);
      }),
    [records, link],
  );

  const cancel = useCallback(() => {
    if (!creating) onClose();
  }, [creating, onClose]);

  const submit = useCallback(
    function attempt() {
      setSubmitted(true);
      if (creating || Object.keys(errors).length > 0) return;
      setCreating(true);
      setError(null);
      readMission(projectId)
        .then((mission) =>
          createMissionNode(mission.id, {
            ...nodeCreateBodyOf(draft, link, `Create a node for the inbox thread ${subject}`),
            expected_mission_version: mission.version,
          }),
        )
        .then(
          () => {
            setCreating(false);
            toast.success(`Created ${draft.name.trim()} for ${subject}.`);
            onCreated();
            onClose();
          },
          (cause: unknown) => {
            setCreating(false);
            const failure = asApiError(cause);
            const message = CONFLICT_MESSAGES[failure.detail] ?? failure.message;
            setError(message);
            toast.error(`Creating a node for ${subject} failed.`, { description: message });
          },
        );
    },
    [creating, errors, projectId, draft, link, subject, onCreated, onClose],
  );

  return {
    draft,
    bindings,
    choices,
    errors: submitted ? errors : {},
    error,
    creating,
    setText,
    setVerification,
    addVerification,
    removeVerification,
    setIntent,
    toggleBinding,
    cancel,
    submit,
  };
}
