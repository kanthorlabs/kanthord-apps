import type { ActionActProps } from "./action-act-props";
import { NodeAct } from "./node-act";
import { ProjectAct } from "./project-act";

export function ActionAct(props: ActionActProps) {
  if (props.offer.operation_id.startsWith("project.")) return <ProjectAct {...props} />;
  return <NodeAct {...props} />;
}
