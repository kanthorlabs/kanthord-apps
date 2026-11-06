import { describe, expect, it } from "vitest";

import type { ExternalLink } from "@/api/types";

import { externalLinkOf } from "./external-link";

describe("externalLinkOf", () => {
  it("names a GitHub issue by owner, repository and number and targets its page", () => {
    const link: ExternalLink = {
      kind: "github_issue",
      resource_identity: "conversation:github:kanthorlabs/kanthord",
      number: 42,
    };

    expect(externalLinkOf(link)).toEqual({
      text: "kanthorlabs/kanthord#42",
      href: "https://github.com/kanthorlabs/kanthord/issues/42",
    });
  });

  it("shows a Jira issue as text with no target", () => {
    const link: ExternalLink = {
      kind: "jira_issue",
      resource_identity: "conversation:jira:acme.atlassian.net/KAN",
      key: "KAN-7",
    };

    expect(externalLinkOf(link)).toEqual({ text: "Jira issue KAN-7", href: null });
  });

  it("shows a Slack thread as text with no target", () => {
    const link: ExternalLink = {
      kind: "slack_thread",
      resource_identity: "conversation:slack:T01",
      channel: "C0123",
      thread_ts: "1700000000.000100",
    };

    expect(externalLinkOf(link)).toEqual({
      text: "Slack thread 1700000000.000100 in C0123",
      href: null,
    });
  });

  it("shows a GitHub issue with an unreadable identity as text with no target", () => {
    const link: ExternalLink = {
      kind: "github_issue",
      resource_identity: "conversation:github:broken",
      number: 3,
    };

    expect(externalLinkOf(link)).toEqual({ text: "GitHub issue 3", href: null });
  });
});
