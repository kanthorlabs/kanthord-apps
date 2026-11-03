import { useMemo, useState } from "react";

import { agentReadFailure } from "@/api/agent-read-failure";
import { readAgent } from "@/api/resources/workers";
import { BINDING_PROMPT_AGENTS, type BindingPromptAgent } from "@/api/types";
import { useResource } from "@/hooks/use-resource";
import type { PromptTarget } from "@/lib/binding-draft";
import { type PreviewPart, previewParts } from "@/lib/prompt-preview";

export interface PromptPreviewScope {
  readonly projectId: string;
  readonly bindingId: string;
  readonly bindingName: string;
}

export interface PromptPreviewState {
  readonly agents: readonly BindingPromptAgent[];
  readonly agent: BindingPromptAgent;
  readonly selectAgent: (agent: BindingPromptAgent) => void;
  readonly loading: boolean;
  readonly error: string | null;
  readonly retry: () => void;
  readonly parts: readonly PreviewPart[];
}

const NO_PARTS: readonly PreviewPart[] = [];

function agentsOf(target: PromptTarget): readonly BindingPromptAgent[] {
  return target === "repository" ? BINDING_PROMPT_AGENTS : [target];
}

export function usePromptPreview(
  scope: PromptPreviewScope,
  target: PromptTarget,
  text: string,
): PromptPreviewState {
  const agents = agentsOf(target);
  const [agent, setAgent] = useState<BindingPromptAgent>(agents[0] ?? "swe@1");
  const { projectId, bindingId, bindingName } = scope;
  const resource = useResource(
    () => readAgent(agent, { projectId, bindingId }),
    [agent, projectId, bindingId],
  );
  const stored = resource.data?.prompt.parts;
  const parts = useMemo(
    () =>
      stored === undefined
        ? NO_PARTS
        : previewParts(stored, {
            kind: target === "repository" ? "repository" : "binding",
            bindingId,
            bindingName,
            text,
          }),
    [stored, target, bindingId, bindingName, text],
  );
  return {
    agents,
    agent,
    selectAgent: setAgent,
    loading: resource.loading,
    error: resource.error === null ? null : agentReadFailure(resource.error),
    retry: resource.reload,
    parts,
  };
}
