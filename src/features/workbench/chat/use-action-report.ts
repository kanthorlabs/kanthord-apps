import { useCallback, useState } from "react";

import { reportWorkbenchAction } from "@/api/resources/workbench";
import type { ApiError } from "@/api/errors";
import type { WorkbenchActionReportBody } from "@/api/types";
import type { ActResult } from "@/hooks/act-result";
import { asApiError } from "@/hooks/use-resource";

const ERROR_CODE = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/;
const SETTLED_CODE = "workbench.session.action_settled";

export interface ActionReport {
  readonly failure: ApiError | null;
  readonly settle: (result: ActResult) => void;
  readonly reset: () => void;
}

function bodyOf(result: ActResult): WorkbenchActionReportBody {
  if (result.ok) return { outcome: "done", error_code: null };
  const valid = result.code !== null && ERROR_CODE.test(result.code);
  return { outcome: "failed", error_code: valid ? result.code : null };
}

export function useActionReport(sessionId: string, toolCallId: string): ActionReport {
  const [failure, setFailure] = useState<ApiError | null>(null);

  const settle = useCallback(
    (result: ActResult) => {
      setFailure(null);
      reportWorkbenchAction(sessionId, toolCallId, bodyOf(result)).catch((cause: unknown) => {
        const reported = asApiError(cause);
        if (result.ok && reported.detail === SETTLED_CODE) return;
        setFailure(reported);
      });
    },
    [sessionId, toolCallId],
  );

  const reset = useCallback(() => setFailure(null), []);

  return { failure, settle, reset };
}
