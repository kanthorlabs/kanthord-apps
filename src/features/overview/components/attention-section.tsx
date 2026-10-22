import type {
  AttentionDetails,
  AttentionGroup as Group,
  AttentionGroupId,
  AttentionItem,
} from "@/lib/attention";

import type { AttentionFocus } from "../use-attention-focus";
import type { ReadFault } from "../read-overview-snapshot";
import { AllClear } from "./all-clear";
import { AttentionFilter } from "./attention-filter";
import { AttentionGroup } from "./attention-group";
import { ReadFaultsAlert } from "./read-faults-alert";

interface AttentionSectionProps {
  readonly summary: string;
  readonly groups: readonly { readonly group: Group; readonly items: readonly AttentionItem[] }[];
  readonly shownGroups: readonly {
    readonly group: Group;
    readonly items: readonly AttentionItem[];
  }[];
  readonly groupId: AttentionGroupId | null;
  readonly selectGroup: (groupId: AttentionGroupId | null) => void;
  readonly faults: readonly ReadFault[];
  readonly allClear: boolean;
  readonly details: AttentionDetails;
  readonly showProject: boolean;
  readonly now: number;
  readonly reload: () => void;
  readonly retryDetail: (nodeId: string) => void;
  readonly setDialogOpen: (itemId: string, nodeId: string, open: boolean) => void;
  readonly focus: AttentionFocus;
}

export function AttentionSection({
  summary,
  groups,
  shownGroups,
  groupId,
  selectGroup,
  faults,
  allClear,
  details,
  showProject,
  now,
  reload,
  retryDetail,
  setDialogOpen,
  focus,
}: AttentionSectionProps) {
  return (
    <section aria-labelledby="overview-needs-you" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 id="overview-needs-you" className="text-base font-semibold">
          Needs you
        </h3>
        <div aria-live="polite">
          <p className="text-sm text-muted-foreground">{summary}</p>
        </div>
      </div>
      {groups.length > 1 && (
        <AttentionFilter groups={groups} value={groupId} onChange={selectGroup} />
      )}
      {faults.length > 0 && <ReadFaultsAlert faults={faults} onRetry={reload} />}
      {allClear && <AllClear titleRef={focus.allClearRef} />}
      {shownGroups.map(({ group, items }) => (
        <AttentionGroup
          key={group.id}
          group={group}
          items={items}
          details={details}
          showProject={showProject}
          now={now}
          reload={reload}
          markActed={focus.markActed}
          retryDetail={retryDetail}
          setDialogOpen={setDialogOpen}
          titleRef={focus.titleRef}
        />
      ))}
    </section>
  );
}
