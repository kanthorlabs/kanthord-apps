import { NodeCreateDialog } from "@/components/node-create-dialog";
import { NodeLinkDialog } from "@/components/node-link-dialog";
import { useNodeCreate } from "@/hooks/use-node-create";
import { useNodeLink } from "@/hooks/use-node-link";
import type { ProjectSnapshot } from "@/lib/attention";
import { inboxActsOf } from "@/lib/board-acts";
import type { InboxAttentionItem } from "@/lib/inbox-attention";

import { type ActsStore, stateOf, usePublished } from "../use-board-acts";
import { type InboxActsContext, useInboxActs } from "../use-inbox-acts";
import { InboxMessage } from "./inbox-message";
import { InboxPauseDialog } from "./inbox-pause-dialog";
import { InboxSnoozeDialog } from "./inbox-snooze-dialog";

interface InboxActsProps extends InboxActsContext {
  readonly store: ActsStore;
  readonly item: InboxAttentionItem;
  readonly snapshots: readonly ProjectSnapshot[];
}

interface DialogProps {
  readonly item: InboxAttentionItem;
  readonly snapshot: ProjectSnapshot | undefined;
  readonly onClose: () => void;
  readonly onDone: () => void;
}

function InboxCreateNode({ item, onClose, onDone }: DialogProps) {
  const create = useNodeCreate({
    projectId: item.project.id,
    link: item.inbox.external_link,
    subject: item.subject,
    onClose,
    onCreated: onDone,
  });
  return (
    <NodeCreateDialog
      create={create}
      message={
        <>
          <h3 className="text-sm font-semibold">Message</h3>
          <InboxMessage item={item} />
        </>
      }
    />
  );
}

function InboxLinkNode({ item, snapshot, onClose, onDone }: DialogProps) {
  const link = useNodeLink({
    projectId: item.project.id,
    nodes: snapshot?.nodes ?? [],
    link: item.inbox.external_link,
    subject: item.subject,
    onClose,
    onLinked: onDone,
  });
  return <NodeLinkDialog subject={item.subject} link={link} />;
}

export function InboxActs({ store, item, snapshots, ...context }: InboxActsProps) {
  const acts = useInboxActs(item, snapshots, context);
  usePublished(
    store,
    stateOf(inboxActsOf(item, acts.controls), { failure: acts.failure, notice: acts.notice }),
  );
  const snapshot = snapshots.find((entry) => entry.project.id === item.project.id);
  return (
    <>
      {acts.snoozeOpen && (
        <InboxSnoozeDialog
          subject={item.subject}
          choices={acts.snoozeChoices}
          busy={acts.snoozeBusy}
          onChoose={acts.snoozeUntil}
          onCancel={acts.cancelSnooze}
        />
      )}
      {acts.createOpen && (
        <InboxCreateNode
          item={item}
          snapshot={snapshot}
          onClose={acts.cancelCreate}
          onDone={context.reload}
        />
      )}
      {acts.linkOpen && (
        <InboxLinkNode
          item={item}
          snapshot={snapshot}
          onClose={acts.cancelLink}
          onDone={context.reload}
        />
      )}
      {acts.pausing !== null && (
        <InboxPauseDialog
          key={acts.pausing.id}
          node={acts.pausing}
          missionVersion={snapshot?.missionVersion ?? 0}
          reload={context.reload}
          onEnd={acts.endPause}
        />
      )}
    </>
  );
}
