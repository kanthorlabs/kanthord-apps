import { describe, expect, it } from "vitest";

import type {
  EnvironmentFailure,
  EnvironmentState,
  MissionEvidence,
  MissionEvidenceAsset,
  MissionNodeRecord,
  Project,
  SchedulerExecutionRecord,
  TraceSpan,
} from "@/api/types";
import type { ToolApprovalItem } from "@/lib/approval-attention";

import type { AttentionItem, DetailRead, OutsideRequest } from "./attention";
import { evidenceOf, type EvidenceReads } from "./board-evidence";
import type { EnvironmentFailedItem } from "./fix-attention";

const PROJECT: Project = {
  id: "prj-1",
  name: "kanthord",
  binding_set_version: 1,
  created_at: 1,
  paused_at: null,
  workspace_directory: "/state/prj-1",
};

const NODE = { id: "node_1", attempt: 2, intent: "implement" } as MissionNodeRecord;

const NO_READS: EvidenceReads = {
  session: null,
  discard: null,
  evidence: null,
  transition: null,
  cause: null,
  executions: [],
};

function ready<T>(data: T): DetailRead<T> {
  return { status: "ready", data };
}

function reads(overrides: Partial<EvidenceReads>): EvidenceReads {
  return { ...NO_READS, ...overrides };
}

const NODE_BASE = {
  group: "decisions",
  project: PROJECT,
  subject: "Team",
  missionVersion: 1,
  node: NODE,
  nodes: [NODE],
  at: null,
} as const;

const PAUSED = {
  ...NODE_BASE,
  id: "paused:node_1",
  kind: "paused",
  pause: null,
  cause: null,
} as unknown as AttentionItem;

const BLOCKED = {
  ...NODE_BASE,
  id: "blocked:node_1",
  kind: "blocked",
  cause: "Criterion not met",
} as unknown as AttentionItem;

function execution(
  id: string,
  attempt: number,
  created: string,
  ended: string | null,
  extra: Partial<SchedulerExecutionRecord> = {},
): SchedulerExecutionRecord {
  return {
    execution_id: id,
    trace_id: `trace_${id}`,
    attempt,
    created_at: Date.parse(created),
    ended_at: ended === null ? null : Date.parse(ended),
    claim_state: "ended",
    expired_at: 0,
    stop: { reason: "provider_failed", code: "unauthorized" },
    agent_selections: [{ agent_name: "swe@1" }],
    ...extra,
  } as unknown as SchedulerExecutionRecord;
}

function repository(id: string, bindingId: string, commit: string): MissionEvidenceAsset {
  return {
    id,
    kind: "repository",
    published_at: null,
    expired_at: null,
    address: { kind: "repository", binding_id: bindingId, commit },
  };
}

function evidence(id: string, extra: Partial<MissionEvidence>): MissionEvidence {
  return {
    id,
    node_id: "node_1",
    attempt: 2,
    subject: "Add the team",
    assets: [],
    provenance: { kind: "service", service: "mission" },
    created_at: 1,
    ...extra,
  };
}

function textsOf(
  item: AttentionItem,
  readSet: EvidenceReads,
  environments: readonly EnvironmentState[] | null = null,
) {
  return evidenceOf(item, readSet, environments).lines.map((line) => line.text);
}

function transitionSpan(attributes: TraceSpan["attributes"]): TraceSpan {
  return { operation: "scheduler.transition", attributes } as unknown as TraceSpan;
}

describe("evidenceOf for a paused item", () => {
  it("lists each execution of the attempt with its times, agent and end label", () => {
    const lines = evidenceOf(
      PAUSED,
      reads({
        executions: [
          execution("e2", 2, "2026-05-01T10:30:00Z", "2026-05-01T10:45:00Z"),
          execution("e1", 2, "2026-05-01T09:00:00Z", "2026-05-01T09:12:00Z"),
          execution("e0", 1, "2026-04-30T09:00:00Z", "2026-04-30T09:12:00Z"),
        ],
      }),
      null,
    ).lines;

    expect(lines.map((line) => line.text)).toEqual([
      "implement 09:00 to 09:12 UTC · swe@1 · Provider failed: unauthorized",
      "implement 10:30 to 10:45 UTC · swe@1 · Provider failed: unauthorized",
    ]);
  });

  it("links each execution id to the trace of that execution", () => {
    const [line] = evidenceOf(
      PAUSED,
      reads({ executions: [execution("e1", 2, "2026-05-01T09:00:00Z", "2026-05-01T09:12:00Z")] }),
      null,
    ).lines;

    expect(line?.links).toEqual([{ label: "e1", to: "/traces/trace_e1" }]);
  });

  it("encodes the trace id in the link", () => {
    const [line] = evidenceOf(
      PAUSED,
      reads({
        executions: [
          execution("e1", 2, "2026-05-01T09:00:00Z", null, { trace_id: "a/b", stop: null }),
        ],
      }),
      null,
    ).lines;

    expect(line?.links[0]?.to).toBe("/traces/a%2Fb");
    expect(line?.text).toBe("implement 09:00 to now UTC · swe@1 · no stop");
  });

  it("answers failures from the failure-limit transition span", () => {
    const transition = ready([
      transitionSpan({
        "kanthord.transition.rule": "failure_limit",
        "kanthord.transition.count": 3,
        "kanthord.transition.limit": 3,
      }),
    ]);

    expect(evidenceOf(PAUSED, reads({ transition }), null).failures).toEqual({
      count: 3,
      limit: 3,
    });
  });

  it("answers no failures for another rule, another operation or a failed read", () => {
    const other = ready([
      transitionSpan({
        "kanthord.transition.rule": "further_work_limit",
        "kanthord.transition.count": 3,
        "kanthord.transition.limit": 3,
      }),
    ]);

    expect(evidenceOf(PAUSED, reads({ transition: other }), null).failures).toBeNull();
    expect(
      evidenceOf(PAUSED, reads({ transition: { status: "failed", message: "x" } }), null).failures,
    ).toBeNull();
    expect(evidenceOf(PAUSED, NO_READS, null).failures).toBeNull();
  });
});

describe("evidenceOf for a blocked item", () => {
  const ENVIRONMENTS = [
    { binding_id: "binding_main_000001", binding_name: "main" },
  ] as unknown as readonly EnvironmentState[];

  it("lists the subject, the commit on the named binding and each result", () => {
    const record = evidence("ev1", {
      assets: [repository("a1", "binding_main_000001", "0123456789abcdef0123")],
      verification: {
        tested_input: { kind: "repository", binding_id: "b", commit: "c" },
        results: [
          { command: "pnpm test", exit_code: 0, signal: null, timed_out: false },
          { command: "pnpm lint", exit_code: 1, signal: null, timed_out: false },
          { command: "pnpm build", exit_code: null, signal: "SIGKILL", timed_out: false },
          { command: "pnpm e2e", exit_code: null, signal: null, timed_out: true },
        ],
      },
    });

    expect(textsOf(BLOCKED, reads({ evidence: ready([record]) }), ENVIRONMENTS)).toEqual([
      "Add the team",
      "commit 0123456789ab on binding main",
      "✓ pnpm test · exit 0",
      "✗ pnpm lint · exit 1",
      "✗ pnpm build · signal SIGKILL",
      "✗ pnpm e2e · timed out",
    ]);
  });

  it("names a binding with no environment record by the first 12 characters of its id", () => {
    const record = evidence("ev1", {
      assets: [repository("a1", "binding_unknown_999", "0123456789abcdef0123")],
    });

    expect(textsOf(BLOCKED, reads({ evidence: ready([record]) }))).toContain(
      "commit 0123456789ab on binding binding_unkn",
    );
  });

  it("ignores an asset that is not a repository", () => {
    const record = evidence("ev1", {
      assets: [
        {
          id: "a1",
          kind: "produced",
          published_at: null,
          expired_at: null,
          address: { kind: "produced", sha256: "abc" },
        },
      ],
    });

    expect(textsOf(BLOCKED, reads({ evidence: ready([record]) }))).toEqual(["Add the team"]);
  });

  it("adds the trace line from the cause read, linked to the trace", () => {
    const lines = evidenceOf(
      BLOCKED,
      reads({
        evidence: ready([]),
        cause: ready({ traceId: "trace_9", cause: null }),
      }),
      null,
    ).lines;

    expect(lines).toHaveLength(1);
    expect(lines[0]?.text).toBe("trace");
    expect(lines[0]?.links).toEqual([{ label: "trace_9", to: "/traces/trace_9" }]);
  });

  it("lists nothing while the reads are pending or failed", () => {
    expect(textsOf(BLOCKED, NO_READS)).toEqual([]);
    expect(textsOf(BLOCKED, reads({ evidence: { status: "failed", message: "x" } }))).toEqual([]);
  });
});

describe("evidenceOf for the other kinds", () => {
  it("names the pull request and the repository of an outside item", () => {
    const request: OutsideRequest = {
      action: {} as OutsideRequest["action"],
      evidence: evidence("ev1", {
        assets: [
          {
            id: "a1",
            kind: "platform",
            published_at: null,
            expired_at: null,
            address: {
              kind: "pull_request",
              resource_identity: "repository:github:kanthorlabs/kanthord",
              number: 42,
            },
          },
        ],
      }),
    };
    const item = {
      ...NODE_BASE,
      id: "merge_wait:node_1",
      group: "outside",
      kind: "merge_wait",
      cause: "Waits for merge",
      request,
    } as unknown as AttentionItem;

    expect(textsOf(item, NO_READS)).toEqual(["pull request #42 · github.com/kanthorlabs/kanthord"]);
  });

  it("lists nothing for an outside item without request evidence", () => {
    const item = {
      ...NODE_BASE,
      id: "merge_wait:node_1",
      group: "outside",
      kind: "merge_wait",
      cause: "Waits for merge",
      request: { action: {}, evidence: null },
    } as unknown as AttentionItem;

    expect(textsOf(item, NO_READS)).toEqual([]);
  });

  function environmentItem(failure: Partial<EnvironmentFailure> | null): AttentionItem {
    const item: EnvironmentFailedItem = {
      id: "environment_failed:prj-1:binding_1",
      kind: "environment_failed",
      group: "fixes",
      project: PROJECT,
      subject: "main",
      at: 1,
      cause: "Environment failed",
      nodeIds: [],
      projects: [PROJECT],
      binding: "main",
      bindingId: "binding_1",
      failure:
        failure === null
          ? null
          : {
              class: "setup_failed",
              origin: "onboarding",
              execution_id: null,
              command: "npm test",
              exit_code: 1,
              tail: "line one\nline two",
              reproduce: "npm test --watch=false",
              ended_at: 1,
              ...failure,
            },
      failureClass: "setup_failed",
    };
    return item;
  }

  it("shows the failure command, the log tail and the reproduce command", () => {
    const lines = evidenceOf(environmentItem({}), NO_READS, null).lines;

    expect(lines.map((line) => [line.kind, line.text, line.command])).toEqual([
      ["text", "npm test · exit 1", null],
      ["log", "line one\nline two", null],
      ["command", "Reproduce:", "npm test --watch=false"],
    ]);
  });

  it("says that a command did not finish, and skips an empty tail", () => {
    const lines = evidenceOf(environmentItem({ exit_code: null, tail: "" }), NO_READS, null).lines;

    expect(lines.map((line) => line.text)).toEqual(["npm test · did not finish", "Reproduce:"]);
  });

  it("lists nothing for an environment without a failure record", () => {
    expect(textsOf(environmentItem(null), NO_READS)).toEqual([]);
  });

  it("names the session and the operation of a tool approval", () => {
    const item: ToolApprovalItem = {
      id: "tool_approval:s1",
      group: "decisions",
      kind: "tool_approval",
      subject: "Create",
      at: 2,
      sessionId: "s1",
      toolCallId: "c1",
      agent: "swe@1",
      operationId: "project.create",
    };

    expect(textsOf(item, NO_READS)).toEqual(["session s1 · operation project.create"]);
  });

  it("lists nothing for a kind with no evidence", () => {
    const item = { id: "project_paused:prj-1", kind: "project_paused", group: "fixes" };

    expect(textsOf(item as unknown as AttentionItem, NO_READS)).toEqual([]);
  });
});
