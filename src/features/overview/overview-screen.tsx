import { type ReactNode, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { RefreshStatus } from "@/components/refresh-status";
import { TouchTarget } from "@/components/touch-target";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import type { AttentionItem } from "@/lib/attention";
import { hiddenByFilterOf, isNothingAtAll } from "@/lib/board-items";
import { BOARD_TABS, type BoardTab, type BoardTabId } from "@/lib/board-tabs";
import { announcementOf, leadLabelOf, workforceText } from "@/lib/board-text";
import { BOARD_WIDTH } from "@/lib/board-width";

import { AllClear } from "./components/all-clear";
import { BoardActsProvider, useBoardActs } from "./components/board-acts";
import { BoardDetailHost } from "./components/board-detail-host";
import { BoardFilter } from "./components/board-filter";
import { BoardList } from "./components/board-list";
import { BoardShortcutsDialog } from "./components/board-shortcuts-dialog";
import { BoardSkeleton } from "./components/board-skeleton";
import { BoardSummary } from "./components/board-summary";
import { BoardTabs } from "./components/board-tabs";
import { ReadFaultsAlert } from "./components/read-faults-alert";
import { SystemHealthAlert } from "./components/system-health-alert";
import { useBoard } from "./use-board";
import { type BoardKeysInput, useBoardKeys } from "./use-board-keys";
import { useBoardWidth } from "./use-board-width";
import { useOverview } from "./use-overview";

function tabNamed(id: BoardTabId): BoardTab {
  const tab = BOARD_TABS.find((entry) => entry.id === id);
  if (tab === undefined) throw new Error(`No board tab ${id}.`);
  return tab;
}

function BoardKeys(props: Omit<BoardKeysInput, "acts">) {
  const { acts } = useBoardActs();
  useBoardKeys({ ...props, acts });
  return null;
}

interface PaneEmptyProps {
  readonly tab: BoardTab;
  readonly nothingAtAll: boolean;
  readonly allClear: boolean;
  readonly workforce: string;
  readonly hiddenByFilter: boolean;
  readonly start: AttentionItem | null;
  readonly onShowAll: () => void;
  readonly onGoToStart: () => void;
  readonly allClearRef: (element: HTMLElement | null) => void;
}

function PaneEmpty({
  tab,
  nothingAtAll,
  allClear,
  workforce,
  hiddenByFilter,
  start,
  onShowAll,
  onGoToStart,
  allClearRef,
}: PaneEmptyProps) {
  if (nothingAtAll) {
    return <AllClear titleRef={allClearRef} fault={!allClear} workforce={workforce} />;
  }
  return (
    <Empty>
      <EmptyHeader>
        <EmptyDescription>{tab.what}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {hiddenByFilter && (
          <TouchTarget>
            <Button variant="outline" size="sm" onClick={onShowAll}>
              Show all projects
            </Button>
          </TouchTarget>
        )}
        {start !== null && (
          <TouchTarget>
            <Button variant="outline" size="sm" onClick={onGoToStart}>
              Go to {start.subject}
            </Button>
          </TouchTarget>
        )}
      </EmptyContent>
    </Empty>
  );
}

interface OverviewScreenProps {
  readonly onResume?: () => void;
}

export function OverviewScreen({ onResume }: OverviewScreenProps) {
  const overview = useOverview();
  const frame = useRef<HTMLDivElement>(null);
  const widthClass = useBoardWidth(frame);
  const board = useBoard(overview, widthClass);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [notice, setNotice] = useState<{ text: string; itemId: string | null } | null>(null);
  const expanded = widthClass === BOARD_WIDTH.Expanded;
  const tab = tabNamed(board.tab);
  const { startItem } = board;
  const workforce = workforceText(overview.running, overview.waiting);
  const readFault = overview.faults.length > 0;
  const hiddenByFilter = hiddenByFilterOf(
    overview.boardItems,
    overview.details,
    board.tab,
    board.projectId,
  );
  const projectName = overview.projects.find((entry) => entry.id === board.projectId)?.name ?? null;
  const nothingAtAll = isNothingAtAll({
    projectId: board.projectId,
    view: board.counts.view,
    allClear: overview.allClear,
    readFault,
  });
  const noticeText = notice?.itemId === board.selectedId ? (notice?.text ?? null) : null;
  const showAll = () => board.selectProject(null);
  const goToStart = () => {
    if (startItem !== null) board.select(startItem.id);
  };

  const filter: ReactNode = (
    <BoardFilter
      projects={overview.projects}
      counts={board.counts}
      projectId={board.projectId}
      tab={tab}
      widthClass={widthClass}
      onChange={board.selectProject}
    />
  );

  const tabs = (
    <BoardTabs
      tab={board.tab}
      counts={board.counts}
      allProjects={board.projectId !== null}
      widthClass={widthClass}
      onChange={board.selectTab}
    >
      <BoardList
        tab={tab}
        cards={board.cards}
        selectedId={board.selectedId}
        widthClass={widthClass}
        projectName={projectName}
        hiddenByFilter={hiddenByFilter}
        allClear={overview.allClear}
        nothingAtAll={nothingAtAll}
        start={startItem}
        workforce={workforce}
        now={overview.now}
        held={overview.held}
        gates={overview.gates}
        leadLabelOf={(item) => leadLabelOf(item, overview.details)}
        onSelect={board.open}
        onShowAll={showAll}
        onGoToStart={goToStart}
        cardRef={board.cardRef}
        allClearRef={board.allClearRef}
      />
    </BoardTabs>
  );

  const host = (
    <BoardDetailHost
      widthClass={widthClass}
      selected={board.selected}
      gone={board.gone}
      openId={board.openId}
      position={board.position}
      total={board.total}
      tab={tab}
      cards={board.cards}
      details={overview.details}
      now={overview.now}
      held={overview.held}
      snapshots={overview.snapshots}
      empty={
        <PaneEmpty
          tab={tab}
          nothingAtAll={nothingAtAll}
          allClear={overview.allClear}
          workforce={workforce}
          hiddenByFilter={hiddenByFilter}
          start={startItem}
          onShowAll={showAll}
          onGoToStart={goToStart}
          allClearRef={board.allClearRef}
        />
      }
      titleRef={board.titleRef}
      onClose={board.close}
      onStep={board.step}
      onOpen={board.open}
    />
  );

  return (
    <div
      ref={frame}
      className={
        expanded
          ? "@container flex h-[calc(100svh-var(--app-header-height)-3rem)] min-h-0 min-w-0 flex-col gap-4"
          : "@container flex min-w-0 flex-col gap-4"
      }
    >
      <div className="flex flex-wrap items-center gap-3 md:gap-4">
        <h2 className="text-lg font-semibold">Overview</h2>
        {onResume !== undefined && (
          <Button variant="link" size="sm" className="self-start" onClick={onResume}>
            Resume onboarding
          </Button>
        )}
        {overview.status === "ready" && (
          <>
            {expanded && filter}
            <div className="flex items-center gap-2 md:ml-auto">
              <BoardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
              <RefreshStatus
                updatedAt={overview.updatedAt}
                now={overview.now}
                onRefresh={overview.refresh}
              />
            </div>
          </>
        )}
      </div>

      <div role="status" className="sr-only">
        {noticeText ??
          announcementOf({
            gone: board.gone !== null,
            expanded,
            open: board.openId !== null,
            subject: board.selected?.subject ?? null,
            position: board.position,
            total: board.total,
          })}
      </div>

      {overview.status === "loading" && <BoardSkeleton widthClass={widthClass} />}

      {overview.status === "empty" && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No projects</EmptyTitle>
            <EmptyDescription>This server holds no project.</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button nativeButton={false} render={<Link to="/projects/new" />} size="lg">
              New project
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {overview.status === "error" && overview.error !== null && (
        <Alert variant="destructive">
          <AlertTitle>The overview could not be read.</AlertTitle>
          <AlertDescription>{overview.error.message}</AlertDescription>
          <div className="mt-2 flex md:justify-end">
            <Button variant="outline" size="sm" onClick={overview.refresh}>
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {overview.status === "ready" && (
        <BoardActsProvider
          item={board.selected}
          details={overview.details}
          reload={overview.refresh}
          retryDetail={overview.retryDetail}
          markActed={board.markActed}
          setDialogOpen={board.setDialogOpen}
        >
          <BoardKeys
            board={board}
            widthClass={widthClass}
            projects={overview.projects}
            openShortcuts={() => setShortcutsOpen(true)}
            announce={(text) =>
              setNotice(text === null ? null : { text, itemId: board.selectedId })
            }
          />
          <SystemHealthAlert components={overview.unavailable} failure={overview.livenessFailure} />
          {readFault && <ReadFaultsAlert faults={overview.faults} onRetry={overview.refresh} />}
          {!expanded && filter}
          <BoardSummary
            summary={board.summary}
            widthClass={widthClass}
            startSubject={startItem?.subject ?? null}
            workforce={workforce}
            cooling={overview.cooling}
            showProject={board.projectId === null}
            onStart={goToStart}
          />
          {expanded ? (
            <div className="grid min-h-0 flex-1 grid-cols-[minmax(400px,1fr)_minmax(544px,740px)] gap-4">
              <div className="min-h-0 min-w-0 overflow-y-auto">{tabs}</div>
              {host}
            </div>
          ) : (
            <>
              {tabs}
              {host}
            </>
          )}
        </BoardActsProvider>
      )}
    </div>
  );
}
