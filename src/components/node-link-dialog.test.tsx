import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import * as missionApi from "@/api/resources/mission";
import * as projectsApi from "@/api/resources/projects";
import type {
  ExternalLink,
  MissionNodeRecord,
  MissionRevision,
  NodeState,
  ProjectBindingRecord,
} from "@/api/types";
import { useNodeLink } from "@/hooks/use-node-link";

vi.mock("@/api/resources/mission");
vi.mock("@/api/resources/projects");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { NodeLinkDialog } from "./node-link-dialog";

const LINK: ExternalLink = {
  kind: "github_issue",
  resource_identity: "conversation:github:acme/shop",
  number: 42,
};

const TASK = { id: "task_rev", filename: "rev.md", content: { name: "From the revision" } };

function node(
  id: string,
  name: string,
  state: NodeState,
  overrides: Partial<MissionNodeRecord> = {},
): MissionNodeRecord {
  return {
    id,
    filename: `${id}.md`,
    mission_id: "mission_1",
    intent: "implement",
    tags: [],
    tasks: [{ id: "task_claim", filename: "claim.md", content: { name: "From the record" } }],
    state,
    attempt: 1,
    pinned_revision: null,
    priority: 0,
    depends_on: [],
    visible_revision: 4,
    content: {
      name,
      requirement: "r",
      criterion: "c",
      verifications: [],
      bindings: [],
      intent: "implement",
      tags: [],
    },
    retired_at: null,
    pinned_by_attempts: [],
    ...overrides,
  } as unknown as MissionNodeRecord;
}

const NODES = [
  node("n_run", "Running node", "Executing"),
  node("n_done", "Finished node", "Completed"),
  node("n_old", "Retired node", "Pending", { retired_at: 5 }),
];

const REVISION = {
  node_id: "n_run",
  filename: "n_run.md",
  revision: 4,
  content: {
    name: "Running node",
    requirement: "Revision requirement",
    criterion: "c",
    verifications: ["pnpm test"],
    bindings: ["binding_repo"],
    intent: "implement",
    tags: [],
  },
  tasks: [TASK],
} as unknown as MissionRevision;

const CONVERSATION: ProjectBindingRecord = {
  id: "binding_chat",
  project_id: "prj-1",
  name: "shop-github",
  kind: "conversation",
  resource_identity: "conversation:github:acme/shop",
  revision: 1,
  config: {},
  created_at: 1,
  removed_at: null,
};

function Harness({
  nodes,
  onLinked,
}: {
  nodes: readonly MissionNodeRecord[];
  onLinked: () => void;
}) {
  const link = useNodeLink({
    projectId: "prj-1",
    nodes,
    link: LINK,
    subject: "acme/shop#42",
    onClose: vi.fn(),
    onLinked,
  });
  return <NodeLinkDialog subject="acme/shop#42" link={link} />;
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(projectsApi.listBindings).mockResolvedValue([CONVERSATION]);
  vi.mocked(missionApi.readMission).mockResolvedValue({
    id: "mission_1",
    project_id: "prj-1",
    version: 9,
  });
  vi.mocked(missionApi.readNodeRevision).mockResolvedValue(REVISION);
  vi.mocked(missionApi.updateMissionNode).mockResolvedValue({} as never);
});

describe("NodeLinkDialog", () => {
  it("lists the nodes that are not terminal and not retired", async () => {
    render(<Harness nodes={NODES} onLinked={vi.fn()} />);

    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getAllByRole("radio")).toHaveLength(1);
    expect(within(dialog).getByRole("radio", { name: /Running node/ })).toBeVisible();
  });

  it("reads the current revision and sends its content and tasks with the link and the binding", async () => {
    const user = userEvent.setup();
    const onLinked = vi.fn();
    render(<Harness nodes={NODES} onLinked={onLinked} />);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("radio", { name: /Running node/ }));
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: "Link to node" })).toBeEnabled(),
    );

    await user.click(within(dialog).getByRole("button", { name: "Link to node" }));

    await waitFor(() => expect(onLinked).toHaveBeenCalled());
    expect(missionApi.readNodeRevision).toHaveBeenCalledWith("n_run", 4);
    expect(missionApi.updateMissionNode).toHaveBeenCalledWith("n_run", {
      filename: "n_run.md",
      expected_revision: 4,
      expected_mission_version: 9,
      content: {
        ...REVISION.content,
        bindings: ["binding_repo", "binding_chat"],
        external_links: [LINK],
      },
      tasks: [TASK],
      reason: expect.stringContaining("acme/shop#42"),
    });
  });

  it("refuses the link when the project holds no conversation binding for the thread", async () => {
    vi.mocked(projectsApi.listBindings).mockResolvedValue([]);
    render(<Harness nodes={NODES} onLinked={vi.fn()} />);
    const dialog = await screen.findByRole("dialog");

    expect(await within(dialog).findByText(/no conversation binding/)).toBeVisible();
    expect(within(dialog).getByRole("button", { name: "Link to node" })).toBeDisabled();
  });

  it("states that no node can take the link", async () => {
    render(<Harness nodes={[NODES[1] as MissionNodeRecord]} onLinked={vi.fn()} />);

    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByText(/holds no node that is open/)).toBeVisible();
  });
});
