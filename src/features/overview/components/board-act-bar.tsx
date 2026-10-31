import { Link } from "react-router-dom";

import { DisabledAction } from "@/components/disabled-action";
import { TouchTarget } from "@/components/touch-target";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { actKeysOf } from "@/lib/board-keys";
import { BOARD_WIDTH } from "@/lib/board-width";

import { useShortcutSetting } from "../use-shortcut-setting";
import { type BoardAct, useBoardActs, useBoardActsFrame } from "./board-acts";
import { BoardMoreSheet } from "./board-more-sheet";
import { CheckBadge } from "./check-badge";
import { ResumeProjectAction } from "./resume-project-action";

const NO_KEYS: ReadonlyMap<string, string> = new Map();
const DISCARD = "discard";

interface PhoneActs {
  readonly lead: BoardAct | null;
  readonly others: readonly BoardAct[];
  readonly last: BoardAct | null;
  readonly badges: readonly BoardAct[];
}

function phoneActsOf(acts: readonly BoardAct[]): PhoneActs {
  const badges = acts.filter((act) => act.type === "badge");
  const actions = acts.filter((act) => act.type !== "badge");
  const lead =
    actions.find((act) => act.type !== "gated" && act.id !== DISCARD) ?? actions[0] ?? null;
  const others = actions.filter((act) => act !== lead);
  return {
    lead,
    others: others.filter((act) => act.id !== DISCARD),
    last: others.find((act) => act.id === DISCARD) ?? null,
    badges,
  };
}

function KeyHint({ shortcut }: { readonly shortcut: string }) {
  return (
    <span aria-hidden="true" className="[@media(hover:none)]:hidden">
      <Kbd>{shortcut}</Kbd>
    </span>
  );
}

function ActControl({
  act,
  shortcut,
}: {
  readonly act: BoardAct;
  readonly shortcut: string | null;
}) {
  const hint = shortcut === null ? undefined : <KeyHint shortcut={shortcut} />;
  const keyShortcuts = shortcut ?? undefined;
  switch (act.type) {
    case "button":
      return (
        <TouchTarget>
          <Button
            variant={act.variant}
            size="sm"
            aria-label={act.ariaLabel ?? undefined}
            aria-keyshortcuts={keyShortcuts}
            disabled={act.disabled}
            onClick={act.press}
          >
            {act.label}
            {hint}
          </Button>
        </TouchTarget>
      );
    case "gated":
      return (
        <TouchTarget>
          <DisabledAction
            label={act.label}
            ariaLabel={act.ariaLabel ?? undefined}
            reason={act.need}
            keyShortcuts={keyShortcuts}
            hint={hint}
          />
        </TouchTarget>
      );
    case "link":
      return (
        <TouchTarget>
          <Button
            nativeButton={false}
            render={<Link to={act.to} />}
            variant="outline"
            size="sm"
            aria-keyshortcuts={keyShortcuts}
          >
            {act.label}
            {hint}
          </Button>
        </TouchTarget>
      );
    case "resume_project":
      return (
        <TouchTarget>
          <ResumeProjectAction item={act.item} reload={act.reload} markActed={act.markActed} />
        </TouchTarget>
      );
    case "badge":
      return <CheckBadge label={act.label} />;
  }
}

function PhoneBar({
  acts,
  keys,
  subject,
}: {
  readonly acts: readonly BoardAct[];
  readonly keys: ReadonlyMap<string, string>;
  readonly subject: string;
}) {
  const { lead, others, last, badges } = phoneActsOf(acts);
  const count = others.length + (last === null ? 0 : 1);
  const control = (act: BoardAct) => (
    <ActControl key={act.id} act={act} shortcut={keys.get(act.id) ?? null} />
  );

  return (
    <>
      <div className="flex items-center gap-2">
        {lead !== null && <div className="flex min-w-0 flex-1 flex-col">{control(lead)}</div>}
        {count > 0 && (
          <BoardMoreSheet subject={subject} count={count} last={last && control(last)}>
            {others.map(control)}
          </BoardMoreSheet>
        )}
        {badges.map(control)}
      </div>
      {lead?.type === "gated" && <p className="text-sm text-muted-foreground">{lead.need}</p>}
    </>
  );
}

export function BoardActBar() {
  const { acts, needs, read } = useBoardActs();
  const { widthClass, subject } = useBoardActsFrame();
  const { enabled } = useShortcutSetting();
  if (acts.length === 0) return null;
  const keys = enabled ? actKeysOf(acts.map((act) => act.id)) : NO_KEYS;
  const phone = widthClass === BOARD_WIDTH.Compact;

  return (
    <div
      role="group"
      aria-label="Acts"
      className="flex flex-col gap-2 pb-[env(safe-area-inset-bottom)]"
    >
      {phone ? (
        <PhoneBar acts={acts} keys={keys} subject={subject} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {acts.map((act) => (
              <ActControl key={act.id} act={act} shortcut={keys.get(act.id) ?? null} />
            ))}
          </div>
          {needs.map((need) => (
            <p key={need} className="text-sm text-muted-foreground">
              {need}
            </p>
          ))}
        </>
      )}
      {read?.failed === true && (
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm break-words text-destructive">{read.text}</p>
          <TouchTarget>
            <Button variant="outline" size="sm" onClick={read.retry}>
              Retry
            </Button>
          </TouchTarget>
        </div>
      )}
    </div>
  );
}
