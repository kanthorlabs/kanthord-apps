import { act, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ReactNode } from "react";
import { toast } from "sonner";

import { ApiError } from "@/api/errors";
import { archiveWorkerInstance, readWorkerInstance } from "@/api/resources/worker-instances";
import type { WorkerInstance, WorkerInstanceDetail } from "@/api/types";
import { ArchiveInstanceDialog } from "./components/archive-instance-dialog";
import { type ArchiveSubject, useInstanceArchive } from "./use-instance-archive";

vi.mock("@/api/resources/worker-instances", () => ({
  archiveWorkerInstance: vi.fn(),
  readWorkerInstance: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const FREE: ArchiveSubject = {
  name: "mac-studio",
  revision: 2,
  bindingCount: 0,
  liveExecutions: [],
};

const DETAIL: WorkerInstanceDetail = {
  id: "worker_instance_1",
  name: "mac-studio",
  worker: "coder@1",
  placement: "worker",
  revision: 3,
  public_key: "k",
  fingerprint: "f",
  created_at: 0,
  ended_at: null,
  connection: null,
  bindings: [],
  registrations: [],
  credentials: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readWorkerInstance).mockResolvedValue(DETAIL);
});

function blockedOf(subject: ArchiveSubject): ReactNode {
  const { result } = renderHook(() =>
    useInstanceArchive(subject, vi.fn(), vi.fn(), { current: null }),
  );
  return result.current.blocked;
}

describe("the block reason of Archive", () => {
  it("names the detach while a binding lists the instance", () => {
    const { container } = render(<p>{blockedOf({ ...FREE, bindingCount: 2 })}</p>);
    expect(container.textContent).toBe(
      "A binding lists mac-studio. Detach mac-studio from each listing binding first.",
    );
    expect(screen.getAllByText("mac-studio", { selector: "strong" })).toHaveLength(2);
  });

  it("waits for a live execution", () => {
    const { container } = render(<p>{blockedOf({ ...FREE, liveExecutions: ["exec_1"] })}</p>);
    expect(container.textContent).toBe(
      "A registration of mac-studio holds a live execution. Wait until the execution ends.",
    );
    expect(screen.getByText("mac-studio", { selector: "strong" })).toBeInTheDocument();
  });

  it("answers null for a free instance", () => {
    expect(blockedOf(FREE)).toBeNull();
  });
});

describe("useInstanceArchive", () => {
  it("opens no dialog for a blocked instance", () => {
    const { result } = renderHook(() =>
      useInstanceArchive({ ...FREE, bindingCount: 1 }, vi.fn(), vi.fn(), { current: null }),
    );
    act(() => result.current.request());
    expect(result.current.open).toBe(false);
  });

  it("archives at the revision that it reads again and calls onArchived", async () => {
    vi.mocked(archiveWorkerInstance).mockResolvedValue({} as WorkerInstance);
    const onArchived = vi.fn();
    const { result } = renderHook(() =>
      useInstanceArchive(FREE, onArchived, vi.fn(), { current: null }),
    );
    act(() => result.current.request());
    await waitFor(() => expect(result.current.open).toBe(true));
    expect(readWorkerInstance).toHaveBeenCalledWith("mac-studio");
    act(() => result.current.confirm());
    await waitFor(() => expect(onArchived).toHaveBeenCalled());
    expect(archiveWorkerInstance).toHaveBeenCalledWith("mac-studio", 3);
    expect(result.current.open).toBe(false);
  });

  it("opens no dialog when the read again shows a listing binding", async () => {
    vi.mocked(readWorkerInstance).mockResolvedValue({
      ...DETAIL,
      bindings: [{ project_id: "prj-a", binding: "mac-main" }],
    });
    const onStale = vi.fn();
    const { result } = renderHook(() =>
      useInstanceArchive(FREE, vi.fn(), onStale, { current: null }),
    );
    act(() => result.current.request());
    await waitFor(() => expect(onStale).toHaveBeenCalled());
    expect(result.current.open).toBe(false);
    expect(toast.error).toHaveBeenCalledWith("mac-studio was not archived.", {
      description: expect.anything(),
    });
    const notice = vi.mocked(toast.error).mock.calls[0]![1]!.description as ReactNode;
    const { container } = render(<p>{notice}</p>);
    expect(container.textContent).toBe(
      "A binding lists mac-studio. Detach mac-studio from each listing binding first.",
    );
    expect(screen.getAllByText("mac-studio", { selector: "strong" })).toHaveLength(2);
    expect(archiveWorkerInstance).not.toHaveBeenCalled();
  });
});

const OPEN: ArchiveSubject = { name: "mac-studio", revision: 2 };

const LISTED: WorkerInstanceDetail = {
  ...DETAIL,
  bindings: [{ project_id: "prj-a", binding: "mac-main" }],
};

const EXECUTING: WorkerInstanceDetail = {
  ...DETAIL,
  registrations: [
    {
      runtime_identity: "worker_registration_1",
      project_id: "prj-a",
      resource_identity: "worker:kanthord:coder@1",
      worker_name: "coder@1",
      instance: "mac-studio",
      activity: "executing",
      draining: false,
      execution_id: "execution_a",
      registered: true,
      host: "kanthord",
      placement: "worker",
    },
  ],
};

function ArchiveHarness({ subject }: { subject: ArchiveSubject }) {
  const archive = useInstanceArchive(subject, vi.fn(), vi.fn(), { current: null });
  return (
    <MemoryRouter>
      <button type="button" onClick={archive.request}>
        Request
      </button>
      <ArchiveInstanceDialog
        name="mac-studio"
        archive={archive}
        projectNameOf={(id) => (id === "prj-a" ? "kanthord" : id)}
      />
    </MemoryRouter>
  );
}

async function openDialog(): Promise<HTMLElement> {
  render(<ArchiveHarness subject={OPEN} />);
  await userEvent.click(screen.getByRole("button", { name: "Request" }));
  return screen.findByRole("alertdialog");
}

describe("the archive dialog", () => {
  it("lists a listing binding with its link, states the removal and disables the confirm", async () => {
    vi.mocked(readWorkerInstance).mockResolvedValue(LISTED);
    const dialog = await openDialog();
    const link = within(dialog).getByRole("link", { name: "mac-main" });
    expect(link).toHaveAttribute("href", "/projects/prj-a?tab=bindings");
    expect(dialog).toHaveTextContent("of kanthord");
    expect(
      within(dialog).getByText("Remove the instance from these bindings first."),
    ).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Archive mac-studio" })).toBeDisabled();
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("keeps the confirm disabled until the human checks Stop the live execution, then sends force", async () => {
    vi.mocked(readWorkerInstance).mockResolvedValue(EXECUTING);
    vi.mocked(archiveWorkerInstance).mockResolvedValue({} as WorkerInstance);
    const dialog = await openDialog();
    const confirm = within(dialog).getByRole("button", { name: "Archive mac-studio" });
    expect(confirm).toBeDisabled();
    expect(within(dialog).getByText("Execution execution_a")).toBeInTheDocument();
    await userEvent.click(
      within(dialog).getByRole("checkbox", { name: "Stop the live execution" }),
    );
    expect(confirm).toBeEnabled();
    await userEvent.click(confirm);
    await waitFor(() =>
      expect(archiveWorkerInstance).toHaveBeenCalledWith("mac-studio", 3, { force: true }),
    );
  });

  it("sends no force when no execution is live", async () => {
    vi.mocked(archiveWorkerInstance).mockResolvedValue({} as WorkerInstance);
    const dialog = await openDialog();
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Archive mac-studio" }));
    await waitFor(() => expect(archiveWorkerInstance).toHaveBeenCalledWith("mac-studio", 3));
  });

  it("offers Reset key only for the worker placement", async () => {
    vi.mocked(readWorkerInstance).mockResolvedValue({ ...DETAIL, placement: "server" });
    const dialog = await openDialog();
    expect(dialog).not.toHaveTextContent("Reset key");
  });

  it("shows the bindings and the executions of a worker.instance.in_use refusal", async () => {
    vi.mocked(archiveWorkerInstance).mockRejectedValue(
      new ApiError(
        "conflict",
        "A binding lists the worker instance.",
        409,
        "worker.instance.in_use",
        {
          bindings: [{ project_id: "prj-a", binding: "mac-main" }],
          executions: ["execution_b"],
        },
      ),
    );
    const dialog = await openDialog();
    await userEvent.click(within(dialog).getByRole("button", { name: "Archive mac-studio" }));
    const alert = await within(dialog).findByRole("alert");
    expect(alert).toHaveTextContent("A binding lists the worker instance.");
    expect(within(alert).getByText("Binding mac-main of kanthord")).toBeInTheDocument();
    expect(within(alert).getByText("Execution execution_b")).toBeInTheDocument();
  });
});
