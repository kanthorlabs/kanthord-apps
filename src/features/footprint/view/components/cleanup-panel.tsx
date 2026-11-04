import { ListChecksIcon, Trash2Icon, XIcon } from "lucide-react";

import type {
  CleanableKind,
  FootprintCandidate,
  FootprintStat,
  WorkerPlacement,
} from "@/api/types";
import { DataList } from "@/components/data-list";
import { DataListItem } from "@/components/data-list-item";
import { DisabledAction } from "@/components/disabled-action";
import { TextField } from "@/components/text-field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { counted } from "@/lib/counted";
import { byteText, utcDateTime } from "@/lib/format";
import { KEPT_BACKUP_TEXT, PRESET_LABEL, refusalText } from "@/lib/footprint";
import { isSelectable } from "../cleanup-plan";
import { EVERY_ITEM, useCandidateSelection } from "../use-candidate-selection";
import type { FootprintCleanupState } from "../use-footprint-cleanup";
import type { FootprintPresetState } from "../use-footprint-preset";
import { OptionField } from "./option-field";

interface CandidateItemProps {
  readonly kind: CleanableKind;
  readonly candidate: FootprintCandidate;
  readonly checked: boolean;
  readonly onToggle: () => void;
}

function CandidateItem({ kind, candidate, checked, onToggle }: CandidateItemProps) {
  const notice = candidate.kept
    ? KEPT_BACKUP_TEXT
    : candidate.refusal === null
      ? null
      : refusalText(kind, candidate.refusal);
  const fields = [
    { label: "Time", value: utcDateTime(candidate.at) },
    { label: "Size", value: candidate.bytes === null ? "—" : byteText(candidate.bytes) },
  ];
  if (candidate.node_id !== null && candidate.node_id !== candidate.key) {
    fields.push({ label: "Node", value: candidate.node_id });
  }
  if (candidate.execution_id !== null && candidate.execution_id !== candidate.key) {
    fields.push({ label: "Execution", value: candidate.execution_id });
  }
  return (
    <DataListItem
      title={<span className="font-mono">{candidate.key}</span>}
      fields={fields}
      notice={
        notice === null ? undefined : <p className="text-sm text-muted-foreground">{notice}</p>
      }
      actions={
        isSelectable(candidate) ? (
          <Checkbox
            aria-label={`Select ${candidate.key}`}
            checked={checked}
            onCheckedChange={onToggle}
          />
        ) : undefined
      }
    />
  );
}

interface CleanupPanelProps {
  readonly kind: CleanableKind;
  readonly stat: FootprintStat;
  readonly placement: WorkerPlacement | null;
  readonly cleanup: FootprintCleanupState;
  readonly preset: FootprintPresetState;
}

export function CleanupPanel({ kind, stat, placement, cleanup, preset }: CleanupPanelProps) {
  const selection = useCandidateSelection(kind, stat, placement);
  const { pages, totals } = selection;
  return (
    <section aria-labelledby="footprint-cleanup" className="flex flex-col gap-4">
      <h3 id="footprint-cleanup" className="font-semibold leading-none">
        Clean up
      </h3>
      <p className="text-sm text-muted-foreground">
        A rule only proposes. Pick the items, then confirm. KanthorD deletes nothing without the
        confirmation.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <OptionField
          id="footprint-rule"
          label="Rule"
          value={selection.mode}
          options={selection.modeOptions}
          onChange={selection.setMode}
        />
        {selection.mode === "older_than" && (
          <TextField
            id="footprint-age"
            label="Older than (days)"
            value={selection.age}
            error={selection.ageError}
            description="Days from 1 to 3650. The default is 30."
            onChange={selection.setAge}
          />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {selection.totalText !== null && <p className="text-sm">{selection.totalText}</p>}
        <p className="text-sm text-muted-foreground">
          {counted(selection.selected.size, "item selected", "items selected")}
        </p>
        <div className="flex flex-wrap gap-2 md:ml-auto">
          <Button
            variant="outline"
            size="sm"
            disabled={selection.selectingAll || pages.items.length === 0}
            onClick={selection.selectAll}
          >
            <ListChecksIcon aria-hidden="true" data-icon="inline-start" />
            {totals === null ? "Select all" : `Select all ${totals.count}`}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={selection.selected.size === 0}
            onClick={selection.clear}
          >
            <XIcon aria-hidden="true" data-icon="inline-start" />
            Clear
          </Button>
          {preset.available && (
            <Button
              variant="outline"
              size="sm"
              disabled={preset.preparing || stat.stale}
              onClick={preset.prepare}
            >
              {PRESET_LABEL}
            </Button>
          )}
          {selection.disabledReason === null ? (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => cleanup.request(selection.plan())}
            >
              <Trash2Icon aria-hidden="true" data-icon="inline-start" />
              Clean up
            </Button>
          ) : (
            <DisabledAction
              label="Clean up"
              icon={<Trash2Icon aria-hidden="true" data-icon="inline-start" />}
              reason={selection.disabledReason}
            />
          )}
        </div>
      </div>
      {selection.disabledReason !== null && (
        <p className="text-sm text-muted-foreground">{selection.disabledReason}</p>
      )}
      <DataList
        label="Cleanup candidates"
        items={pages.items}
        getKey={(candidate) => candidate.key}
        renderItem={(candidate) => (
          <CandidateItem
            kind={kind}
            candidate={candidate}
            checked={selection.selected.has(candidate.key)}
            onToggle={() => selection.toggle(candidate)}
          />
        )}
        status={pages.status}
        error={pages.error?.message ?? null}
        pending={pages.pending}
        onRetry={pages.retry}
        emptyText={
          selection.mode === EVERY_ITEM ? "No item on this host." : "No candidate for this rule."
        }
        pager={{
          hasPrevious: pages.hasPrevious,
          hasNext: pages.hasNext,
          position: pages.position,
          onPrevious: pages.previous,
          onNext: pages.next,
        }}
      />
    </section>
  );
}
