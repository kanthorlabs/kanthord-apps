import { useCallback, useEffect, useState } from "react";

import { readMissionNode } from "@/api/resources/mission";
import { approveWorkbenchCall } from "@/api/resources/workbench";
import type { WorkbenchPendingApproval } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { type GuestLine, guestLineOf } from "@/lib/guest-chat";

const NAME_MISMATCH = "workbench.evidence.name_mismatch";
const MISMATCH_LINE = "The typed name does not match the node name. The card read the node again.";

export interface EvidenceAllowState {
  readonly nodeName: string | null;
  readonly typed: string;
  readonly canAllow: boolean;
  readonly pending: boolean;
  readonly failure: GuestLine | null;
  readonly setTyped: (value: string) => void;
  readonly allow: () => Promise<void>;
}

export function useEvidenceAllow(
  approval: WorkbenchPendingApproval,
  onAllowed: () => void,
): EvidenceAllowState {
  const nodeId = String(approval.input["node_id"]);
  const [nodeName, setNodeName] = useState<string | null>(null);
  const [typed, setTypedValue] = useState("");
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<GuestLine | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let live = true;
    readMissionNode(nodeId).then(
      (node) => {
        if (live) setNodeName(node.content.name);
      },
      (cause: unknown) => {
        if (live) setFailure(guestLineOf(asApiError(cause)));
      },
    );
    return () => {
      live = false;
    };
  }, [nodeId, nonce]);

  const setTyped = useCallback((value: string) => {
    setTypedValue(value);
    setFailure(null);
  }, []);

  const canAllow = nodeName !== null && nodeName !== "" && typed === nodeName;

  const allow = useCallback(async () => {
    if (!canAllow || pending) return;
    setPending(true);
    setFailure(null);
    try {
      await approveWorkbenchCall(approval.session_id, approval.tool_call_id, true, typed);
      onAllowed();
    } catch (cause) {
      const error = asApiError(cause);
      if (error.detail === NAME_MISMATCH) {
        setFailure({ code: NAME_MISMATCH, message: MISMATCH_LINE });
        setNonce((value) => value + 1);
      } else {
        setFailure(guestLineOf(error));
      }
    } finally {
      setPending(false);
    }
  }, [canAllow, pending, approval.session_id, approval.tool_call_id, typed, onAllowed]);

  return { nodeName, typed, canAllow, pending, failure, setTyped, allow };
}
