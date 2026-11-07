import { useCallback, useState } from "react";
import { toast } from "sonner";

import { readMission, readNodeRevision, updateMissionNode } from "@/api/resources/mission";
import { listBindings } from "@/api/resources/projects";
import type { ExternalLink, MissionNodeRecord } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import { useResource } from "@/hooks/use-resource";
import { conversationBindingIdsOf } from "@/lib/node-create-draft";
import { linkableNodesOf, nodeLinkUpdateOf } from "@/lib/node-link-update";

const CONFLICT_MESSAGES: Readonly<Record<string, string>> = {
  "mission.version.conflict":
    "The mission changed after this read. Pick the node and link it again.",
};

const NO_BINDING =
  "The project holds no conversation binding for this thread. Add the binding first.";

export interface NodeLinkInput {
  readonly projectId: string;
  readonly nodes: readonly MissionNodeRecord[];
  readonly link: ExternalLink;
  readonly subject: string;
  readonly onClose: () => void;
  readonly onLinked: () => void;
}

export interface NodeLinkState {
  readonly candidates: readonly MissionNodeRecord[];
  readonly picked: string | null;
  readonly missing: string | null;
  readonly error: string | null;
  readonly linking: boolean;
  readonly pick: (nodeId: string) => void;
  readonly cancel: () => void;
  readonly submit: () => void;
}

export function useNodeLink({
  projectId,
  nodes,
  link,
  subject,
  onClose,
  onLinked,
}: NodeLinkInput): NodeLinkState {
  const bindings = useResource(() => listBindings(projectId), [projectId]);
  const [picked, setPicked] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const candidates = linkableNodesOf(nodes);
  const binding = conversationBindingIdsOf(bindings.data ?? [], link)[0];
  const missing = bindings.data !== null && binding === undefined ? NO_BINDING : null;

  const cancel = useCallback(() => {
    if (!linking) onClose();
  }, [linking, onClose]);

  const submit = useCallback(
    function attempt() {
      const node = candidates.find((entry) => entry.id === picked);
      if (linking || node === undefined || binding === undefined) return;
      setLinking(true);
      setError(null);
      Promise.all([readNodeRevision(node.id, node.visible_revision), readMission(projectId)])
        .then(([revision, mission]) =>
          updateMissionNode(
            node.id,
            nodeLinkUpdateOf(
              revision,
              link,
              binding,
              mission.version,
              `Link the inbox thread ${subject} to the node`,
            ),
          ),
        )
        .then(
          () => {
            setLinking(false);
            toast.success(`Linked ${subject} to ${node.content.name}.`);
            onLinked();
            onClose();
          },
          (cause: unknown) => {
            setLinking(false);
            const failure = asApiError(cause);
            const message = CONFLICT_MESSAGES[failure.detail] ?? failure.message;
            setError(message);
            toast.error(`Linking ${subject} to ${node.content.name} failed.`, {
              description: message,
            });
          },
        );
    },
    [candidates, picked, linking, binding, projectId, link, subject, onLinked, onClose],
  );

  return { candidates, picked, missing, error, linking, pick: setPicked, cancel, submit };
}
