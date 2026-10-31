import { approvalChatPathOf, type ToolApprovalItem } from "./approval-attention";
import {
  type AttentionDetails,
  type DecisionAttentionItem,
  detailOf,
  type DiscardedDependency,
  type OutsideAttentionItem,
} from "./attention";
import type { ActedAct } from "./board-done";
import type { BoardGate } from "./board-items";
import { readFailureText } from "./external-requests";
import {
  type CredentialRefusedItem,
  type EnvironmentFailedItem,
  type FixAttentionItem,
  fixTargetOf,
  type ProjectPausedItem,
} from "./fix-attention";

type ActVariant = "outline" | "destructive";

interface ButtonAct {
  readonly type: "button";
  readonly id: string;
  readonly label: string;
  readonly ariaLabel: string | null;
  readonly variant: ActVariant;
  readonly disabled: boolean;
  readonly press: () => void;
}

interface GatedAct {
  readonly type: "gated";
  readonly id: string;
  readonly label: string;
  readonly ariaLabel: string | null;
  readonly need: string;
  readonly reason?: string;
}

interface LinkAct {
  readonly type: "link";
  readonly id: string;
  readonly label: string;
  readonly to: string;
}

interface ExternalLinkAct {
  readonly type: "external";
  readonly id: string;
  readonly label: string;
  readonly href: string;
}

interface ResumeProjectAct {
  readonly type: "resume_project";
  readonly id: string;
  readonly item: ProjectPausedItem;
  readonly reload: () => void;
  readonly markActed: (itemId: string) => void;
}

interface BadgeAct {
  readonly type: "badge";
  readonly id: string;
  readonly label: string;
}

export type BoardAct =
  ButtonAct | GatedAct | LinkAct | ExternalLinkAct | ResumeProjectAct | BadgeAct;

export interface ReadNote {
  readonly text: string;
  readonly failed: boolean;
  readonly retry: () => void;
}

export interface GateRoute {
  readonly gate: BoardGate;
  readonly jump: (itemId: string) => void;
}

export interface ActControl {
  readonly available: boolean;
  readonly request: () => void;
}

export interface CheckControl {
  readonly available: boolean;
  readonly checking: boolean;
  readonly label: string | null;
  readonly check: () => void;
}

export interface DecisionActControls {
  readonly unblock: ActControl;
  readonly decide: ActControl;
  readonly override: ActControl;
  readonly resume: ActControl;
  readonly discard: ActControl;
  readonly remove: {
    readonly available: boolean;
    readonly request: (dependency: DiscardedDependency) => void;
  };
  readonly check: CheckControl;
  readonly ready: boolean;
  readonly lastTraceId: string | null;
}

export interface ToolApprovalControls {
  readonly need: string | null;
  readonly sending: boolean;
  readonly approve: () => void;
  readonly reject: () => void;
}

export interface CredentialRotateControls {
  readonly missing: string | null;
  readonly start: () => void;
}

export interface CredentialVerifyControls {
  readonly checking: boolean;
  readonly label: string | null;
  readonly verify: () => void;
}

export interface OnboardingControls {
  readonly running: boolean;
  readonly run: () => void;
}

interface Slot {
  readonly id: string;
  readonly gate: string;
  readonly label: string;
  readonly ariaLabel: string | null;
  readonly variant: ActVariant;
  readonly available: boolean;
  readonly disabled: boolean;
  readonly press: () => void;
}

interface Gate {
  readonly gates: readonly string[];
  readonly read: string;
}

const GITHUB_IDENTITY = /^repository:github:(.+)$/;

function slotOf(
  id: string,
  label: string,
  variant: ActVariant,
  available: boolean,
  press: () => void,
  extra: Partial<Pick<Slot, "gate" | "ariaLabel" | "disabled">> = {},
): Slot {
  return {
    id,
    gate: extra.gate ?? id,
    label,
    ariaLabel: extra.ariaLabel ?? null,
    variant,
    available,
    disabled: extra.disabled ?? false,
    press,
  };
}

function actOf(slot: Slot, gate: Gate | null): BoardAct | null {
  if (gate?.gates.includes(slot.gate) === true) {
    return {
      type: "gated",
      id: slot.id,
      label: slot.label,
      ariaLabel: slot.ariaLabel,
      need: `${slot.label} needs: ${gate.read}.`,
    };
  }
  if (!slot.available) return null;
  return {
    type: "button",
    id: slot.id,
    label: slot.label,
    ariaLabel: slot.ariaLabel,
    variant: slot.variant,
    disabled: slot.disabled,
    press: slot.press,
  };
}

function checkActsOf(check: CheckControl, gate: Gate | null): readonly (BoardAct | null)[] {
  return [
    actOf(
      slotOf("check", "Check now", "outline", check.available, check.check, {
        disabled: check.checking,
      }),
      gate,
    ),
    check.label === null ? null : { type: "badge", id: "check_badge", label: check.label },
  ];
}

function present(acts: readonly (BoardAct | null)[]): readonly BoardAct[] {
  return acts.flatMap((act) => (act === null ? [] : [act]));
}

export function needsOf(acts: readonly BoardAct[]): readonly string[] {
  return [...new Set(acts.flatMap((act) => (act.type === "gated" ? [act.need] : [])))];
}

function decisionGateOf(item: DecisionAttentionItem, ready: boolean): Gate | null {
  if (ready) return null;
  if (item.kind === "blocked") {
    return { gates: ["decide", "unblock", "discard"], read: "the proposals read" };
  }
  if (item.kind === "paused") {
    return {
      gates: ["resume", "override", "check", "discard"],
      read: "the executions and external actions read",
    };
  }
  return { gates: ["remove", "check", "discard"], read: "the external actions read" };
}

export function credentialOf(gate: BoardGate): string {
  return gate.itemId.slice(gate.itemId.indexOf(":") + 1);
}

function gatedResumeOf({ gate }: GateRoute): GatedAct {
  return {
    type: "gated",
    id: "resume",
    label: "Resume",
    ariaLabel: null,
    need: `Resume needs: ${gate.need}.`,
    reason: `${gate.need}.`,
  };
}

function goToOf({ gate, jump }: GateRoute): BoardAct | null {
  return actOf(
    slotOf("goto", `Go to ${credentialOf(gate)}`, "outline", true, () => jump(gate.itemId)),
    null,
  );
}

export function decisionActsOf(
  item: DecisionAttentionItem,
  controls: DecisionActControls,
  route: GateRoute | null,
): readonly BoardAct[] {
  const gate = decisionGateOf(item, controls.ready);
  const decide = actOf(
    slotOf("decide", "Decide", "outline", controls.decide.available, controls.decide.request),
    gate,
  );
  const unblock = actOf(
    slotOf("unblock", "Unblock", "outline", controls.unblock.available, controls.unblock.request),
    gate,
  );
  const resume = actOf(
    slotOf("resume", "Resume", "outline", controls.resume.available, controls.resume.request),
    gate,
  );
  const override = actOf(
    slotOf(
      "override",
      "Override",
      "outline",
      controls.override.available,
      controls.override.request,
    ),
    gate,
  );
  const discard = actOf(
    slotOf(
      "discard",
      "Discard",
      "destructive",
      controls.discard.available,
      controls.discard.request,
    ),
    gate,
  );
  const trace: LinkAct | null =
    controls.lastTraceId === null
      ? null
      : {
          type: "link",
          id: "last_trace",
          label: "Last trace",
          to: `/traces/${encodeURIComponent(controls.lastTraceId)}`,
        };
  const check = checkActsOf(controls.check, gate);
  if (item.kind === "paused") {
    return route === null
      ? present([resume, override, ...check, trace, discard])
      : present([gatedResumeOf(route), goToOf(route), override, ...check, trace, discard]);
  }
  if (item.kind === "blocked") {
    return present([decide, unblock, override, ...check, trace, discard]);
  }
  const removals = item.discarded.map((dependency) =>
    actOf(
      slotOf(
        `remove:${dependency.id}`,
        "Remove dependency",
        "outline",
        controls.remove.available,
        () => controls.remove.request(dependency),
        { gate: "remove", ariaLabel: `Remove dependency on ${dependency.name}` },
      ),
      gate,
    ),
  );
  return present([...removals, ...check, trace, discard]);
}

export function outsideReadOf(
  item: OutsideAttentionItem,
  details: AttentionDetails,
  retryDetail: (nodeId: string) => void,
): ReadNote | null {
  const detail = detailOf(details, item.node);
  const { attempt } = item.node;
  if (detail?.kind !== "external") {
    return {
      text: `Reading the external actions of attempt ${attempt}. The acts show after the read.`,
      failed: false,
      retry: () => retryDetail(item.node.id),
    };
  }
  if (detail.actions.status === "failed") {
    return {
      text: readFailureText(attempt, detail.actions.message, false, "Check now waits for them."),
      failed: true,
      retry: () => retryDetail(item.node.id),
    };
  }
  return null;
}

function pullRequestActOf(item: OutsideAttentionItem): ExternalLinkAct | null {
  for (const asset of item.request.evidence?.assets ?? []) {
    if (asset.kind !== "platform" || asset.address.kind !== "pull_request") continue;
    const github = GITHUB_IDENTITY.exec(asset.address.resource_identity);
    if (github?.[1] === undefined) return null;
    return {
      type: "external",
      id: "open_pull_request",
      label: "Open pull request",
      href: `https://github.com/${github[1]}/pull/${asset.address.number}`,
    };
  }
  return null;
}

export function outsideActsOf(
  item: OutsideAttentionItem,
  check: CheckControl,
  read: ReadNote | null,
): readonly BoardAct[] {
  const gate: Gate | null =
    read === null ? null : { gates: ["check"], read: "the external actions read" };
  return present([pullRequestActOf(item), ...checkActsOf(check, gate)]);
}

export function toolApprovalActsOf(
  item: ToolApprovalItem,
  tool: ToolApprovalControls,
): readonly BoardAct[] {
  const approve =
    tool.need === null
      ? actOf(
          slotOf("approve", "Approve", "outline", true, tool.approve, { disabled: tool.sending }),
          null,
        )
      : ({
          type: "gated",
          id: "approve",
          label: "Approve",
          ariaLabel: null,
          need: tool.need,
        } satisfies GatedAct);
  const reject = actOf(
    slotOf("reject", "Reject", "outline", true, tool.reject, { disabled: tool.sending }),
    null,
  );
  const chat: LinkAct = {
    type: "link",
    id: "open_chat",
    label: "Open chat",
    to: approvalChatPathOf(item),
  };
  return present([approve, reject, chat]);
}

function openActOf(item: FixAttentionItem): LinkAct {
  const target = fixTargetOf(item);
  return { type: "link", id: "open", label: target.label, to: target.path };
}

export function credentialRefusedActsOf(
  item: CredentialRefusedItem,
  rotate: CredentialRotateControls,
  verify: CredentialVerifyControls,
): readonly BoardAct[] {
  const gate: Gate | null =
    rotate.missing === null ? null : { gates: ["rotate"], read: rotate.missing };
  return present([
    actOf(slotOf("rotate", "Rotate", "outline", true, rotate.start), gate),
    actOf(
      slotOf("verify", "Verify credential", "outline", true, verify.verify, {
        disabled: verify.checking,
      }),
      null,
    ),
    verify.label === null ? null : { type: "badge", id: "verify_badge", label: verify.label },
    openActOf(item),
  ]);
}

export function environmentFailedActsOf(
  item: EnvironmentFailedItem,
  onboarding: OnboardingControls,
): readonly BoardAct[] {
  return present([
    openActOf(item),
    actOf(
      slotOf("onboarding", "Run onboarding again", "outline", true, onboarding.run, {
        disabled: onboarding.running,
      }),
      null,
    ),
  ]);
}

export function projectPausedActsOf(
  item: ProjectPausedItem,
  reload: () => void,
  markActed: (itemId: string, act?: ActedAct) => void,
): readonly BoardAct[] {
  return [
    {
      type: "resume_project",
      id: "resume_project",
      item,
      reload,
      markActed: (itemId) => markActed(itemId, { id: "resume_project" }),
    },
  ];
}

export function fixTargetActsOf(item: FixAttentionItem): readonly BoardAct[] {
  const target = fixTargetOf(item);
  return [{ type: "link", id: "fix_target", label: target.label, to: target.path }];
}
