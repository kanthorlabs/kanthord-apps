export const DONE_ACT = {
  Resume: "resume",
  Unblock: "unblock",
  Override: "override",
  Discard: "discard",
  Decide: "decide",
  DecideFinding: "decide_finding",
  RemoveDependency: "remove_dependency",
  ResumeProject: "resume_project",
  Approve: "approve",
  Reject: "reject",
  Rotate: "rotate",
  Onboarding: "onboarding",
  MarkDone: "mark_done",
  Snooze: "snooze",
} as const;

export type DoneActId = (typeof DONE_ACT)[keyof typeof DONE_ACT];

export type ActedAct =
  | { readonly id: Exclude<DoneActId, "remove_dependency" | "rotate"> }
  | { readonly id: "remove_dependency"; readonly dependency: string }
  | {
      readonly id: "rotate";
      readonly revision: number;
      readonly holders: readonly string[];
      readonly paused: number;
    };
