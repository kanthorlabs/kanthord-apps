import { useState } from "react";

import type { ActionCardItem } from "@/lib/workbench-chat";
import { useActionReport } from "../use-action-report";
import { ActionAct } from "./action-act";
import { ActionCard } from "./action-card";

interface ActionCardEntryProps {
  readonly item: ActionCardItem;
  readonly sessionId: string;
  readonly canRun: boolean;
}

export function ActionCardEntry({ item, sessionId, canRun }: ActionCardEntryProps) {
  const [run, setRun] = useState(0);
  const report = useActionReport(sessionId, item.offer.tool_call_id);
  const { reset } = report;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <ActionCard
        item={item}
        canRun={canRun}
        reportFailure={report.failure}
        onRun={() => {
          reset();
          setRun((count) => count + 1);
        }}
      />
      {run > 0 && <ActionAct key={run} offer={item.offer} onSettled={report.settle} />}
    </div>
  );
}
