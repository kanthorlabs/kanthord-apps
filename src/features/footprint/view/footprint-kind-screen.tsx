import { useParams } from "react-router-dom";

import type { FootprintKind } from "@/api/types";
import { useCrumbLabel } from "@/components/crumb-labels";
import { DataList } from "@/components/data-list";
import { FOOTPRINT_KIND_LABELS, isCleanableKind, isFootprintKind } from "@/lib/footprint";
import { StatItem } from "../components/stat-item";
import { statKey } from "../stat-facts";
import { BreakdownSection } from "./components/breakdown-section";
import { CleanupDialog } from "./components/cleanup-dialog";
import { CleanupPanel } from "./components/cleanup-panel";
import { OptionField } from "./components/option-field";
import { useFootprintCleanup } from "./use-footprint-cleanup";
import { useFootprintKind } from "./use-footprint-kind";
import { useFootprintPreset } from "./use-footprint-preset";

function KindView({ kind }: { kind: FootprintKind }) {
  const view = useFootprintKind(kind);
  const cleanup = useFootprintCleanup();
  const preset = useFootprintPreset(kind, view.placements, cleanup.request);
  const { read, host } = view;
  const stats = read.data?.stats ?? [];
  const status = read.data !== null ? "ready" : read.error !== null ? "error" : "loading";

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold">{FOOTPRINT_KIND_LABELS[kind]}</h2>
      <DataList
        label="Hosts"
        items={stats}
        getKey={statKey}
        renderItem={(stat) => <StatItem stat={stat} now={read.now} />}
        status={status}
        error={read.error?.message ?? null}
        pending={read.loading}
        onRetry={read.refresh}
        emptyText="No host reports this kind."
      />
      {view.noDeleteTexts.map((text) => (
        <p key={text} className="text-sm text-muted-foreground">
          {text}
        </p>
      ))}
      {read.data?.tables != null && <BreakdownSection tables={read.data.tables} />}
      {host !== null && isCleanableKind(kind) && (
        <>
          {view.hostOptions.length > 1 && (
            <div className="md:w-64">
              <OptionField
                id="footprint-host"
                label="Host"
                value={host.instance_name ?? ""}
                options={view.hostOptions}
                onChange={view.selectHost}
              />
            </div>
          )}
          <CleanupPanel
            key={statKey(host)}
            kind={kind}
            stat={host}
            placement={view.hostPlacement}
            cleanup={cleanup}
            preset={preset}
          />
        </>
      )}
      <CleanupDialog cleanup={cleanup} />
    </div>
  );
}

export function FootprintKindScreen() {
  const { kind = "" } = useParams();
  useCrumbLabel(
    `/footprint/${encodeURIComponent(kind)}`,
    isFootprintKind(kind) ? FOOTPRINT_KIND_LABELS[kind] : undefined,
  );
  if (!isFootprintKind(kind)) {
    return <p className="text-sm text-destructive">No footprint kind has the name {kind}.</p>;
  }
  return <KindView key={kind} kind={kind} />;
}
