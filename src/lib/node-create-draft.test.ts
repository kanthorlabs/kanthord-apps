import { describe, expect, it } from "vitest";

import type { ExternalLink, ProjectBindingRecord } from "@/api/types";

import {
  conversationBindingIdsOf,
  emptyNodeCreateDraft,
  nodeCreateBodyOf,
  nodeCreateErrorsOf,
} from "./node-create-draft";

const LINK: ExternalLink = {
  kind: "github_issue",
  resource_identity: "conversation:github:acme/shop",
  number: 42,
};

function binding(
  id: string,
  kind: ProjectBindingRecord["kind"],
  overrides: Partial<ProjectBindingRecord> = {},
): ProjectBindingRecord {
  return {
    id,
    project_id: "prj-1",
    name: id,
    kind,
    resource_identity: `${kind}:x`,
    revision: 1,
    config: {},
    created_at: 1,
    removed_at: null,
    ...overrides,
  };
}

const BINDINGS = [
  binding("repo", "repository"),
  binding("chat", "conversation", { resource_identity: LINK.resource_identity }),
  binding("other-chat", "conversation"),
];

const FILLED = {
  ...emptyNodeCreateDraft(),
  filename: "fix-login.md",
  name: "Fix login",
  requirement: "Fix it.",
  criterion: "It works.",
  verifications: ["pnpm test"],
  bindings: ["repo", "chat"],
};

describe("conversationBindingIdsOf", () => {
  it("answers the conversation binding of the resource of the link", () => {
    expect(conversationBindingIdsOf(BINDINGS, LINK)).toEqual(["chat"]);
  });

  it("skips a removed binding", () => {
    expect(
      conversationBindingIdsOf(
        [
          binding("chat", "conversation", {
            removed_at: 5,
            resource_identity: LINK.resource_identity,
          }),
        ],
        LINK,
      ),
    ).toEqual([]);
  });
});

describe("emptyNodeCreateDraft", () => {
  it("holds no text, one empty verification and the implement intent", () => {
    expect(emptyNodeCreateDraft()).toEqual({
      filename: "",
      name: "",
      requirement: "",
      criterion: "",
      verifications: [""],
      intent: "implement",
      bindings: [],
    });
  });
});

describe("nodeCreateErrorsOf", () => {
  it("answers no error for a complete draft", () => {
    expect(nodeCreateErrorsOf(FILLED, BINDINGS)).toEqual({});
  });

  it("names each empty field", () => {
    expect(Object.keys(nodeCreateErrorsOf(emptyNodeCreateDraft(), BINDINGS)).sort()).toEqual([
      "bindings",
      "criterion",
      "filename",
      "name",
      "requirement",
      "verifications",
    ]);
  });

  it("refuses a file name without .md or with a path", () => {
    expect(
      nodeCreateErrorsOf({ ...FILLED, filename: "fix-login" }, BINDINGS).filename,
    ).toBeDefined();
    expect(nodeCreateErrorsOf({ ...FILLED, filename: "a/b.md" }, BINDINGS).filename).toBeDefined();
  });

  it("refuses a draft whose verifications are blank", () => {
    expect(
      nodeCreateErrorsOf({ ...FILLED, verifications: ["  ", ""] }, BINDINGS).verifications,
    ).toBe("Add at least one verification.");
  });

  it("refuses an implement node without a repository binding", () => {
    expect(nodeCreateErrorsOf({ ...FILLED, bindings: ["chat"] }, BINDINGS).bindings).toBeDefined();
  });

  it("asks no repository binding of an examine node", () => {
    expect(
      nodeCreateErrorsOf({ ...FILLED, intent: "examine", bindings: ["chat"] }, BINDINGS),
    ).toEqual({});
  });
});

describe("nodeCreateBodyOf", () => {
  it("holds the link, the bindings, no task and the reason", () => {
    expect(
      nodeCreateBodyOf({ ...FILLED, verifications: [" pnpm test ", ""] }, LINK, "Because."),
    ).toEqual({
      filename: "fix-login.md",
      content: {
        name: "Fix login",
        requirement: "Fix it.",
        criterion: "It works.",
        verifications: ["pnpm test"],
        bindings: ["repo", "chat"],
        intent: "implement",
        external_links: [LINK],
      },
      tasks: [],
      reason: "Because.",
    });
  });
});
