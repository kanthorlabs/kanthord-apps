import { useCallback, useState } from "react";
import { toast } from "sonner";

import { checkNode, doneInboxItem } from "@/api/resources/mission";
import type { MissionNodeRecord } from "@/api/types";
import { asApiError } from "@/hooks/use-resource";
import type { ProjectSnapshot } from "@/lib/attention";
import type { InboxActControls, InboxNodeControl } from "@/lib/board-acts";
import type { ActedAct } from "@/lib/board-done";
import { checkLabelOf, linkLabelsOf } from "@/lib/check-result";
import { type InboxAttentionItem, type InboxNodes, inboxNodesOf } from "@/lib/inbox-attention";
import { type SnoozeChoice, snoozeChoicesOf } from "@/lib/inbox-snooze";

import { type ActFailure, reportActFailure } from "./use-board-tool-acts";

export const NEW_UPDATE_NOTICE = "A new update arrived.";

export interface InboxActsContext {
  readonly reload: () => void;
  readonly markActed: (itemId: string, act?: ActedAct) => void;
  readonly closeInboxItem: (itemId: string) => void;
  readonly jump?: (itemId: string) => void;
}

export interface InboxActs {
  readonly controls: InboxActControls;
  readonly nodes: InboxNodes;
  readonly notice: string | null;
  readonly failure: ActFailure | null;
  readonly snoozeChoices: readonly SnoozeChoice[];
  readonly snoozeOpen: boolean;
  readonly snoozeBusy: boolean;
  readonly snoozeUntil: (choice: SnoozeChoice) => void;
  readonly cancelSnooze: () => void;
  readonly createOpen: boolean;
  readonly cancelCreate: () => void;
  readonly linkOpen: boolean;
  readonly cancelLink: () => void;
  readonly pausing: MissionNodeRecord | null;
  readonly endPause: () => void;
}

export function useInboxActs(
  item: InboxAttentionItem,
  snapshots: readonly ProjectSnapshot[],
  { reload, markActed, closeInboxItem, jump }: InboxActsContext,
): InboxActs {
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [failure, setFailure] = useState<ActFailure | null>(null);
  const [snoozeChoices, setSnoozeChoices] = useState<readonly SnoozeChoice[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [pausing, setPausing] = useState<MissionNodeRecord | null>(null);
  const [checking, setChecking] = useState<string | null>(null);
  const [labels, setLabels] = useState<readonly string[]>([]);
  const endPause = useCallback(() => setPausing(null), []);
  const nodes = inboxNodesOf(item, snapshots);
  const itemId = item.id;
  const subject = item.subject;

  const send = useCallback(
    function attempt(until: number | null) {
      if (busy) return;
      setBusy(true);
      setFailure(null);
      setNotice(null);
      doneInboxItem(itemId, until === null ? {} : { snoozed_until: until }).then(
        (answer) => {
          setBusy(false);
          setSnoozeChoices(null);
          if (answer.state === "open") {
            setNotice(NEW_UPDATE_NOTICE);
            reload();
            return;
          }
          toast.success(until === null ? `Marked ${subject} done.` : `Snoozed ${subject}.`);
          markActed(itemId, { id: until === null ? "mark_done" : "snooze" });
          closeInboxItem(itemId);
          reload();
        },
        (cause: unknown) => {
          setBusy(false);
          setFailure(
            reportActFailure(until === null ? "Marking done" : "Snoozing", subject, cause, () =>
              attempt(until),
            ),
          );
          if (asApiError(cause).status === 404) reload();
        },
      );
    },
    [busy, itemId, subject, markActed, closeInboxItem, reload],
  );

  const check = useCallback(
    function attempt(node: MissionNodeRecord, missionVersion: number) {
      if (checking !== null) return;
      setChecking(node.id);
      checkNode(node.id, { expected_mission_version: missionVersion }).then(
        (answer) => {
          setChecking(null);
          setLabels(
            [checkLabelOf(answer), ...linkLabelsOf(answer)].flatMap((l) => (l === null ? [] : [l])),
          );
          for (const failed of answer.failures) {
            toast.error(`A request of ${node.content.name} could not be checked.`, {
              description: `${failed.error.error.message} (${failed.error.error.code})`,
            });
          }
          reload();
        },
        (cause: unknown) => {
          setChecking(null);
          setLabels([]);
          toast.error(`Checking ${node.content.name} failed.`, {
            description: asApiError(cause).message,
            action: { label: "Retry", onClick: () => attempt(node, missionVersion) },
          });
        },
      );
    },
    [checking, reload],
  );

  const versionOf = (node: MissionNodeRecord): number =>
    snapshots.find((snapshot) => snapshot.nodes.some((entry) => entry.id === node.id))
      ?.missionVersion ?? 0;
  const nodeControl = (
    node: MissionNodeRecord,
    press: () => void,
    nodeBusy = false,
  ): InboxNodeControl => ({
    nodeId: node.id,
    name: node.content.name,
    busy: nodeBusy,
    press,
  });

  const controls: InboxActControls = {
    done: { busy, press: () => send(null) },
    snooze: { busy, request: () => setSnoozeChoices(snoozeChoicesOf(Date.now())) },
    create: () => setCreateOpen(true),
    link: () => setLinkOpen(true),
    pause: nodes.pausable.map((node) => nodeControl(node, () => setPausing(node))),
    check: nodes.checkable.map((node) =>
      nodeControl(node, () => check(node, versionOf(node)), checking === node.id),
    ),
    followups: nodes.followups.map((node) =>
      nodeControl(node, () => jump?.(`followup_proposal:${node.id}`)),
    ),
    labels,
  };

  return {
    controls,
    nodes,
    notice,
    failure,
    snoozeChoices: snoozeChoices ?? [],
    snoozeOpen: snoozeChoices !== null,
    snoozeBusy: busy,
    snoozeUntil: (choice) => send(choice.until),
    cancelSnooze: () => setSnoozeChoices(null),
    createOpen,
    cancelCreate: () => setCreateOpen(false),
    linkOpen,
    cancelLink: () => setLinkOpen(false),
    pausing,
    endPause,
  };
}
