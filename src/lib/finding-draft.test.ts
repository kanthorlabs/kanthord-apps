import { describe, expect, it } from "vitest";

import type { MissionAssessment } from "@/api/types";

import {
  deliveryAssessmentsOf,
  emptyFindingDraft,
  FINDING_TEXT_MAX_BYTES,
  findingDraftErrors,
  findingReportOf,
  NODE_TASK,
  refusedFindingErrors,
  taskChoiceText,
} from "./finding-draft";

const COMPLETE = {
  ...emptyFindingDraft("assessment_1"),
  name: "n",
  description: "d",
  fix: "f",
  why: "w",
  cause_owner: "agent",
};

describe("findingDraftErrors", () => {
  it("accepts a complete draft on the node", () => {
    expect(findingDraftErrors(COMPLETE, [], null)).toEqual({});
  });

  it("names a blank text, an oversized text, an unknown task and a missing choice", () => {
    expect(
      findingDraftErrors(
        {
          ...COMPLETE,
          assessment_id: "",
          kind: "",
          task: "task_gone",
          name: "  ",
          fix: "é".repeat(FINDING_TEXT_MAX_BYTES / 2 + 1),
          cause_owner: "",
        },
        ["task_a"],
        null,
      ),
    ).toEqual({
      assessment_id: "Choose the assessment that missed it.",
      kind: "Choose the kind.",
      task: "Choose a task of the revision of that assessment, or the node.",
      name: "Write the text.",
      fix: "The text holds more than 8192 bytes.",
      cause_owner: "Choose the owner of the cause.",
    });
  });
});

describe("findingDraftErrors on create", () => {
  it("refuses an assessment outside the delivery assessments", () => {
    expect(findingDraftErrors(COMPLETE, [], ["assessment_2"])).toEqual({
      assessment_id: "Choose an execution assessment of the attempt that delivered the code.",
    });
    expect(findingDraftErrors(COMPLETE, [], ["assessment_1"])).toEqual({});
  });
});

describe("refusedFindingErrors", () => {
  it("maps the issue paths of a validation refusal to draft fields", () => {
    expect(
      refusedFindingErrors([
        { path: ["assessment_id"], code: "custom" },
        { path: ["body", "task_id"], code: "custom" },
        { path: ["name"], code: "too_big" },
        { path: ["expected_mission_version"], code: "custom" },
        "no issue",
      ]),
    ).toEqual({
      assessment_id:
        "The daemon refused the assessment. Choose an execution assessment of the attempt that delivered the code.",
      task: "The daemon refused the task. Choose a task of the revision of that assessment, or the node.",
      name: "The daemon refused this field.",
    });
    expect(refusedFindingErrors(undefined)).toEqual({});
  });
});

describe("deliveryAssessmentsOf", () => {
  it("keeps only the execution assessments", () => {
    const execution = { execution_id: "execution_1" } as MissionAssessment;
    const human = { execution_id: null } as MissionAssessment;
    expect(deliveryAssessmentsOf([human, execution])).toEqual([execution]);
  });
});

describe("findingReportOf", () => {
  it("maps the node choice to a null task", () => {
    expect(findingReportOf(COMPLETE)).toMatchObject({ task_id: null, cause_owner: "agent" });
    expect(findingReportOf({ ...COMPLETE, task: "task_a" })?.task_id).toBe("task_a");
    expect(findingReportOf({ ...COMPLETE, cause_owner: "" })).toBeNull();
  });
});

describe("taskChoiceText", () => {
  it("names the node, a task of the revision or the bare identity", () => {
    const tasks = [
      {
        id: "task_a",
        filename: "a.md",
        content: {
          name: "Task A",
          requirement: "r",
          criterion: "c",
          verifications: [],
          bindings: [],
        },
      },
    ];
    expect(taskChoiceText(NODE_TASK, tasks)).toBe("The node");
    expect(taskChoiceText("task_a", tasks)).toBe("Task A");
    expect(taskChoiceText("task_b", tasks)).toBe("task_b");
  });
});
