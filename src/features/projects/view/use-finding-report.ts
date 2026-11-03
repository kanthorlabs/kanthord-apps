import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  createFinding,
  listNodeAssessments,
  listNodeRevisions,
  updateFinding,
} from "@/api/resources/mission";
import type {
  MissionAssessment,
  MissionFinding,
  MissionRevision,
  MissionTaskContent,
} from "@/api/types";
import { asApiError, useResource } from "@/hooks/use-resource";
import {
  deliveryAssessmentsOf,
  draftOfFinding,
  emptyFindingDraft,
  type FindingDraft,
  type FindingDraftErrors,
  findingDraftErrors,
  type FindingDraftField,
  findingReportOf,
  NODE_TASK,
  refusedFindingErrors,
} from "@/lib/finding-draft";

export interface FindingReportState {
  readonly open: boolean;
  readonly editing: MissionFinding | null;
  readonly draft: FindingDraft;
  readonly errors: FindingDraftErrors;
  readonly saving: boolean;
  readonly error: string | null;
  readonly assessments: readonly MissionAssessment[];
  readonly assessmentChoices: readonly MissionAssessment[];
  readonly tasks: readonly MissionTaskContent[];
  readonly available: boolean;
  readonly unavailableReason: string | null;
  readonly refreshKey: number;
  readonly requestCreate: () => void;
  readonly requestEdit: (finding: MissionFinding) => void;
  readonly setField: (field: FindingDraftField, value: string) => void;
  readonly cancel: () => void;
  readonly save: () => void;
}

interface ReportReads {
  readonly assessments: readonly MissionAssessment[];
  readonly revisions: readonly MissionRevision[];
}

const NO_ASSESSMENTS: readonly MissionAssessment[] = [];
const NO_TASKS: readonly MissionTaskContent[] = [];

const REFUSAL_MESSAGES: Readonly<Record<string, string>> = {
  "mission.version.conflict":
    "The mission changed after this read. The view now shows the current mission. Save again.",
  "mission.finding.not_human":
    "The finding is a reviewer finding. Only a human finding takes an edit. The view now shows the current findings.",
  "mission.finding.decided":
    "A human decided the finding after this read. A decided finding takes no edit. The view now shows the decision.",
  "mission.node.not_found": "The node no longer exists. The view now shows the current mission.",
  "mission.record.not_found":
    "The finding no longer exists. The view now shows the current findings.",
  "gateway.request.validation_failed":
    "The daemon refused a field: the assessment, the task or a text. Check the fields and save again.",
};

async function readReportReads(nodeId: string): Promise<ReportReads> {
  const [assessments, revisions] = await Promise.all([
    listNodeAssessments(nodeId),
    listNodeRevisions(nodeId),
  ]);
  return { assessments, revisions };
}

function unavailableReasonOf(
  loading: boolean,
  error: string | null,
  assessments: readonly MissionAssessment[],
): string | null {
  if (loading) return "The view reads the assessments of the node.";
  if (error !== null) return error;
  if (assessments.length === 0)
    return "The node holds no execution assessment. A defect report names the assessment of the attempt that delivered the code.";
  return null;
}

export function useFindingReport(
  nodeId: string,
  missionVersion: number,
  reload: () => void,
): FindingReportState {
  const [refreshKey, setRefreshKey] = useState(0);
  const reads = useResource(() => readReportReads(nodeId), [nodeId, missionVersion, refreshKey]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MissionFinding | null>(null);
  const [draft, setDraft] = useState<FindingDraft>(() => emptyFindingDraft(""));
  const [errors, setErrors] = useState<FindingDraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assessments = reads.data?.assessments ?? NO_ASSESSMENTS;
  const assessmentChoices = useMemo(() => deliveryAssessmentsOf(assessments), [assessments]);
  const tasks = useMemo(() => {
    const assessment = assessments.find((item) => item.id === draft.assessment_id);
    if (assessment === undefined) return NO_TASKS;
    return (
      reads.data?.revisions.find((item) => item.revision === assessment.node_revision)?.tasks ??
      NO_TASKS
    );
  }, [assessments, draft.assessment_id, reads.data]);
  const unavailableReason = unavailableReasonOf(
    reads.loading,
    reads.error?.message ?? null,
    assessmentChoices,
  );
  const available = unavailableReason === null;

  const start = useCallback((finding: MissionFinding | null, next: FindingDraft) => {
    setEditing(finding);
    setDraft(next);
    setErrors({});
    setError(null);
    setOpen(true);
  }, []);

  const requestCreate = useCallback(() => {
    if (!available) return;
    start(null, emptyFindingDraft(assessmentChoices.at(-1)?.id ?? ""));
  }, [available, assessmentChoices, start]);

  const requestEdit = useCallback(
    (finding: MissionFinding) => start(finding, draftOfFinding(finding)),
    [start],
  );

  const setField = useCallback((field: FindingDraftField, value: string) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
      ...(field === "assessment_id" ? { task: NODE_TASK } : {}),
    }));
    setErrors((current) => ({ ...current, [field]: undefined }));
  }, []);

  const cancel = useCallback(() => {
    if (saving) return;
    setOpen(false);
    setError(null);
  }, [saving]);

  const save = useCallback(() => {
    if (saving || !open) return;
    const found = findingDraftErrors(
      draft,
      tasks.map((task) => task.id),
      editing === null ? assessmentChoices.map((assessment) => assessment.id) : null,
    );
    const report = findingReportOf(draft);
    if (Object.keys(found).length > 0 || report === null) {
      setErrors(found);
      return;
    }
    setSaving(true);
    setError(null);
    const write =
      editing === null
        ? createFinding(nodeId, {
            expected_mission_version: missionVersion,
            assessment_id: draft.assessment_id,
            ...report,
          })
        : updateFinding(editing.id, { expected_mission_version: missionVersion, ...report });
    write.then(
      (finding) => {
        setSaving(false);
        toast.success(
          editing === null
            ? `Reported the defect ${finding.label}.`
            : `Updated the finding ${finding.label}.`,
        );
        setOpen(false);
        setRefreshKey((count) => count + 1);
        reload();
      },
      (cause: unknown) => {
        setSaving(false);
        const failure = asApiError(cause);
        const message = REFUSAL_MESSAGES[failure.detail] ?? failure.message;
        setError(message);
        setErrors(refusedFindingErrors(failure.details));
        toast.error(
          editing === null ? "Reporting the defect failed." : "Updating the finding failed.",
          { description: message },
        );
        setRefreshKey((count) => count + 1);
        reload();
      },
    );
  }, [saving, open, draft, tasks, assessmentChoices, editing, nodeId, missionVersion, reload]);

  return {
    open,
    editing,
    draft,
    errors,
    saving,
    error,
    assessments,
    assessmentChoices,
    tasks,
    available,
    unavailableReason,
    refreshKey,
    requestCreate,
    requestEdit,
    setField,
    cancel,
    save,
  };
}
