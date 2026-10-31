import { Link } from "react-router-dom";

import type { UnattributedModel } from "@/lib/flow-causes";
import { rateBoundText } from "@/lib/flow-format";
import type { FlowSeverity } from "@/lib/flow-status";

import { Sparkline } from "./sparkline";

interface UnattributedPanelProps {
  readonly model: UnattributedModel;
}

const TEXT_TONE: Readonly<Record<FlowSeverity, string>> = {
  ok: "",
  warn: "text-flow-warn",
  bad: "text-flow-bad",
};

export function UnattributedPanel({ model }: UnattributedPanelProps) {
  const { icon, severity, share } = model;
  return (
    <section aria-label="Unattributed" className="flex flex-col gap-2 rounded-lg border p-4">
      <h4 className="text-sm font-medium text-muted-foreground">Unattributed</h4>
      <p className={`text-2xl font-semibold ${TEXT_TONE[severity]}`}>
        {icon !== null && (
          <span role="img" aria-label={`Unattributed status ${severity}`}>
            {icon}
          </span>
        )}
        {icon !== null && " "}
        {share}
      </p>
      <p className="text-xs text-muted-foreground">{model.comparison}</p>
      <Sparkline
        values={model.series}
        partial={model.partial}
        bad={model.bad}
        label="unattributed share"
        format={rateBoundText}
      />
      <p className="text-sm">{model.caused}</p>
      <p className="text-sm text-muted-foreground">{model.manual}</p>
      <Link to={model.target} className="text-sm underline underline-offset-4">
        Label unattributed traces →
      </Link>
    </section>
  );
}
