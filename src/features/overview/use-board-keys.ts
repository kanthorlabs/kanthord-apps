import { useEffect } from "react";
import { type NavigateFunction, useNavigate } from "react-router-dom";

import type { Project } from "@/api/types";
import type { AttentionItem } from "@/lib/attention";
import { actKeysOf, type BoardCommand, boardKeyOf, type BoardMove } from "@/lib/board-keys";
import { BOARD_WIDTH, type BoardWidth } from "@/lib/board-width";

import type { BoardAct } from "./components/board-acts";
import type { Board } from "./use-board";
import { useShortcutSetting } from "./use-shortcut-setting";

type KeyBoard = Pick<
  Board,
  | "cards"
  | "selectedId"
  | "openId"
  | "projectId"
  | "select"
  | "open"
  | "close"
  | "step"
  | "selectTab"
  | "selectProject"
  | "focusCard"
  | "focusTitle"
>;

export interface BoardKeysInput {
  readonly board: KeyBoard;
  readonly widthClass: BoardWidth;
  readonly projects: readonly Project[];
  readonly acts: readonly BoardAct[];
  readonly openShortcuts: () => void;
  readonly announce: (text: string | null) => void;
}

interface KeyContext extends BoardKeysInput {
  readonly navigate: NavigateFunction;
  readonly target: Element | null;
}

const TEXT_FIELD =
  'input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="combobox"]';
const BLOCKING_DIALOG = '[role="alertdialog"], [role="dialog"]:not([data-board-detail])';
const LIST = "[data-board-list]";
const PANE = "[data-board-detail]";

function isInside(target: Element | null, selector: string): boolean {
  return target?.closest(selector) != null;
}

function isBlocked(target: Element | null): boolean {
  return isInside(target, TEXT_FIELD) || document.querySelector(BLOCKING_DIALOG) !== null;
}

function isExpanded({ widthClass }: KeyContext): boolean {
  return widthClass === BOARD_WIDTH.Expanded;
}

function isSheetOpen(context: KeyContext): boolean {
  return !isExpanded(context) && context.board.openId !== null;
}

function cardAt(
  cards: readonly AttentionItem[],
  selectedId: string | null,
  to: BoardMove,
): AttentionItem | undefined {
  const index = cards.findIndex((card) => card.id === selectedId);
  if (to === "first") return cards[0];
  if (to === "last") return cards[cards.length - 1];
  if (to === "next") return cards[index + 1];
  return cards[Math.max(index - 1, 0)];
}

function moveInList({ board }: KeyContext, to: BoardMove): boolean {
  const target = cardAt(board.cards, board.selectedId, to);
  if (target === undefined) return true;
  board.focusCard(target.id);
  if (target.id !== board.selectedId) board.select(target.id);
  return true;
}

function stepIn(context: KeyContext, delta: 1 | -1): boolean {
  if (isInside(context.target, LIST)) return moveInList(context, delta === 1 ? "next" : "previous");
  if (!isSheetOpen(context)) return false;
  context.board.step(delta);
  return true;
}

function showTab(context: KeyContext, tab: Parameters<Board["selectTab"]>[0]): boolean {
  if (context.board.openId !== null) context.board.close();
  context.board.selectTab(tab);
  return true;
}

function cycleFilter({ board, projects }: KeyContext): boolean {
  if (projects.length === 0) return false;
  const ids = [null, ...projects.map((project) => project.id)];
  const next = (ids.indexOf(board.projectId) + 1) % ids.length;
  board.selectProject(ids[next] ?? null);
  return true;
}

function runAct(context: KeyContext, key: string): boolean {
  const keys = actKeysOf(context.acts.map((act) => act.id));
  const act = context.acts.find((candidate) => keys.get(candidate.id) === key);
  if (act === undefined) return false;
  if (act.type === "button" && !act.disabled) act.press();
  if (act.type === "link") context.navigate(act.to);
  if (act.type === "external") window.open(act.href, "_blank", "noreferrer");
  if (act.type === "gated") context.announce(act.need);
  return true;
}

function openCard(context: KeyContext): boolean {
  if (!isInside(context.target, LIST)) return false;
  const { board } = context;
  const card = board.cards.find((candidate) => candidate.id === board.selectedId) ?? board.cards[0];
  if (card === undefined) return false;
  board.open(card.id);
  if (isExpanded(context)) board.focusTitle();
  return true;
}

function leavePane(context: KeyContext): boolean {
  const { board, target } = context;
  if (!isExpanded(context) || !isInside(target, PANE) || board.selectedId === null) return false;
  board.focusCard(board.selectedId);
  return true;
}

function runCommand(context: KeyContext, command: BoardCommand): boolean {
  switch (command.type) {
    case "move":
      return isInside(context.target, LIST) && moveInList(context, command.to);
    case "enter":
      return openCard(context);
    case "escape":
      return leavePane(context);
  }
  if (isBlocked(context.target)) return false;
  switch (command.type) {
    case "step":
      return stepIn(context, command.delta);
    case "tab":
      return showTab(context, command.tab);
    case "filter":
      return cycleFilter(context);
    case "shortcuts":
      context.openShortcuts();
      return true;
    case "act":
      return runAct(context, command.key);
  }
}

export function useBoardKeys(input: BoardKeysInput) {
  const { enabled } = useShortcutSetting();
  const navigate = useNavigate();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const command = boardKeyOf(event, enabled);
      if (command === null) return;
      input.announce(null);
      const target = event.target instanceof Element ? event.target : null;
      if (runCommand({ ...input, navigate, target }, command)) event.preventDefault();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  });
}
