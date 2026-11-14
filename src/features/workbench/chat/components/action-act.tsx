import type { ActionActProps } from "./action-act-props";
import { AgentDefaultAct } from "./agent-default-act";
import { BindingSetAct } from "./binding-set-act";
import { CredentialAct } from "./credential-act";
import { NodeAct } from "./node-act";
import { ProjectAct } from "./project-act";

export function ActionAct(props: ActionActProps) {
  const { operation_id } = props.offer;
  if (operation_id === "llm.credential.rotate") return <CredentialAct {...props} />;
  if (operation_id === "project.bindingSet.write") return <BindingSetAct {...props} />;
  if (operation_id === "agent.enablement.put") return <AgentDefaultAct {...props} />;
  if (operation_id.startsWith("project.")) return <ProjectAct {...props} />;
  return <NodeAct {...props} />;
}
