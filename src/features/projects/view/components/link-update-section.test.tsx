import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import * as missionApi from "@/api/resources/mission";
import type { ExternalLink, MissionLinkUpdate } from "@/api/types";
import { utcDateTime } from "@/lib/format";

vi.mock("@/api/resources/mission");

import { LinkUpdateSection } from "./link-update-section";

const LINK: ExternalLink = {
  kind: "github_issue",
  resource_identity: "conversation:github:kanthorlabs/kanthord",
  number: 42,
};

const NEWER: MissionLinkUpdate = {
  id: "link_update_2",
  external_link: LINK,
  update_key: "comment:2",
  inbound_event_id: "inbound_event_2",
  actor_id: "octocat",
  occurred_at: Date.UTC(2025, 0, 2, 10, 0),
  new: true,
};

const OLDER: MissionLinkUpdate = {
  id: "link_update_1",
  external_link: LINK,
  update_key: "comment:1",
  inbound_event_id: "inbound_event_1",
  actor_id: "hubot",
  occurred_at: Date.UTC(2025, 0, 1, 9, 0),
  new: false,
};

describe("LinkUpdateSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(missionApi.listNodeLinkUpdates).mockResolvedValue([NEWER, OLDER]);
  });

  it("shows the link as a link to its page and the updates in the order of the read", async () => {
    render(<LinkUpdateSection nodeId="node_1" links={[LINK]} />);

    const section = await screen.findByRole("region", { name: "External links" });
    const links = within(section).getAllByRole("link", { name: "kanthorlabs/kanthord#42" });
    expect(links[0]).toHaveAttribute("href", "https://github.com/kanthorlabs/kanthord/issues/42");
    const updates = await within(section).findByRole("list", { name: "Link updates" });
    const items = within(updates).getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("octocat");
    expect(items[0]).toHaveTextContent(utcDateTime(NEWER.occurred_at));
    expect(items[0]).toHaveTextContent("New");
    expect(items[1]).toHaveTextContent("hubot");
    expect(items[1]).toHaveTextContent(utcDateTime(OLDER.occurred_at));
    expect(within(section).getAllByText("New")).toHaveLength(1);
    expect(missionApi.listNodeLinkUpdates).toHaveBeenCalledWith("node_1");
  });

  it("shows No update yet. when the read is empty", async () => {
    vi.mocked(missionApi.listNodeLinkUpdates).mockResolvedValue([]);
    render(<LinkUpdateSection nodeId="node_1" links={[LINK]} />);

    expect(await screen.findByText("No update yet.")).toBeTruthy();
  });

  it("shows the fields of another kind as text", async () => {
    vi.mocked(missionApi.listNodeLinkUpdates).mockResolvedValue([]);
    render(
      <LinkUpdateSection
        nodeId="node_1"
        links={[
          { kind: "jira_issue", resource_identity: "conversation:jira:acme/KAN", key: "KAN-7" },
        ]}
      />,
    );

    expect(await screen.findByText("Jira issue KAN-7")).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("shows no section and reads nothing without a link", () => {
    render(<LinkUpdateSection nodeId="node_1" links={[]} />);

    expect(screen.queryByRole("region", { name: "External links" })).toBeNull();
    expect(missionApi.listNodeLinkUpdates).not.toHaveBeenCalled();
  });

  it("shows the refusal of the read with a retry", async () => {
    vi.mocked(missionApi.listNodeLinkUpdates).mockRejectedValue(
      new ApiError("unavailable", "The daemon is not reachable.", 0),
    );
    render(<LinkUpdateSection nodeId="node_1" links={[LINK]} />);

    expect(await screen.findByText("The daemon is not reachable.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });
});
