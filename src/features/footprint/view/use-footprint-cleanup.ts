import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { createFootprintCleanup } from "@/api/resources/footprint";
import type { FootprintCleanupRecord } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { counted } from "@/lib/counted";
import { FOOTPRINT_KIND_LABELS, SERVER_HOST_LABEL } from "@/lib/footprint";
import { cleanupPath } from "../cleanup-facts";
import type { CleanupPlan } from "./cleanup-plan";

const CREATE_MESSAGES: Readonly<Record<string, string>> = {
  "footprint.instance.archived":
    "The instance is archived. Its slot and its data are gone with the archive.",
  "footprint.instance.not_found": "No worker instance has this name.",
  "footprint.kind.host_mismatch": "This kind does not live on this host.",
  "footprint.rule.not_supported": "The rule does not apply to this kind.",
};

export interface FootprintCleanupState {
  readonly plan: CleanupPlan | null;
  readonly sending: boolean;
  readonly error: string | null;
  readonly blocked: boolean;
  readonly request: (plan: CleanupPlan) => void;
  readonly cancel: () => void;
  readonly confirm: () => void;
}

function recordedText(records: readonly FootprintCleanupRecord[]): string {
  return records
    .map(
      (record) =>
        `${FOOTPRINT_KIND_LABELS[record.kind]} on ${record.instance_name ?? SERVER_HOST_LABEL} (${record.cleanup_id})`,
    )
    .join(", ");
}

function failureText(
  records: readonly FootprintCleanupRecord[],
  total: number,
  message: string,
): string {
  if (records.length === 0) return message;
  return `${counted(records.length, "cleanup", "cleanups")} of ${total} recorded: ${recordedText(records)}. Cleanup ${records.length + 1} of ${total} failed: ${message} KanthorD rolls back nothing.`;
}

export function useFootprintCleanup(): FootprintCleanupState {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<CleanupPlan | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);

  const request = useCallback((next: CleanupPlan) => {
    setError(null);
    setBlocked(false);
    setPlan(next);
  }, []);

  const cancel = useCallback(() => {
    if (sending) return;
    setPlan(null);
    setError(null);
  }, [sending]);

  const confirm = useCallback(() => {
    if (plan === null || sending || blocked) return;
    setSending(true);
    setError(null);
    const calls = plan.calls;
    const records: FootprintCleanupRecord[] = [];
    const send = async () => {
      for (const call of calls) records.push(await createFootprintCleanup(call));
    };
    send().then(
      () => {
        setSending(false);
        setPlan(null);
        toast.success(`Recorded ${counted(records.length, "cleanup", "cleanups")}.`);
        const first = records[0];
        if (first !== undefined) navigate(cleanupPath(first.cleanup_id));
      },
      (cause: unknown) => {
        setSending(false);
        const failure = asApiError(cause);
        const message = CREATE_MESSAGES[failure.detail] ?? failure.message;
        setBlocked(records.length > 0);
        setError(failureText(records, calls.length, message));
        toast.error("The cleanup request failed.", { description: message });
      },
    );
  }, [plan, sending, blocked, navigate]);

  return { plan, sending, error, blocked, request, cancel, confirm };
}
