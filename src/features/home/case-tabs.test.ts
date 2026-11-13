import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { createWorkbenchSession, sendWorkbenchMessage } from "@/api/resources/workbench";
import type { WorkbenchConfiguration, WorkbenchSession } from "@/api/types";
import { basePath } from "@/components/base-path";

vi.mock("@/api/resources/workbench");
vi.mock("@/components/base-path");

import { type CaseAsk, type CaseToasts, createCaseTabs } from "./case-tabs";

const CONFIGURATION: WorkbenchConfiguration = {
  agent_provider: "atlas-llm",
  model_identifier: "qwen3-coder",
  reasoning_effort: "off",
};

const REQUEST =
  "Case: node `node_1` (Blocked). Explain why it is blocked and recommend how to unblock it.";
const KEY = "blocked:node_1";
const NAME = "kanthord-case-blocked:node_1";

interface FakeTab {
  closed: boolean;
  readonly location: { readonly replace: ReturnType<typeof vi.fn> };
  readonly focus: ReturnType<typeof vi.fn>;
  readonly close: ReturnType<typeof vi.fn>;
}

function fakeTab(): FakeTab {
  return { closed: false, location: { replace: vi.fn() }, focus: vi.fn(), close: vi.fn() };
}

function toasts() {
  return {
    blocked: vi.fn(),
    missingConfiguration: vi.fn(),
    createFailed: vi.fn(),
    unsent: vi.fn(),
  } satisfies CaseToasts;
}

function askOf(overrides: Partial<CaseAsk> = {}): CaseAsk {
  return {
    key: KEY,
    request: REQUEST,
    configuration: CONFIGURATION,
    toasts: toasts(),
    ...overrides,
  };
}

function session(id: string): WorkbenchSession {
  return {
    id,
    agent_name: "ops@1",
    configuration: CONFIGURATION,
    entries: [],
    run_active: false,
    resume_command: "pi",
  };
}

let tab: FakeTab;
let open: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
  tab = fakeTab();
  open = vi.fn(() => tab);
  vi.stubGlobal("window", { open });
  vi.mocked(basePath).mockReturnValue("/");
  vi.mocked(createWorkbenchSession).mockResolvedValue(session("session_1"));
  vi.mocked(sendWorkbenchMessage).mockResolvedValue({
    session_id: "session_1",
    run_active: true,
    queued_message_id: null,
    cleared: [],
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function settled(replaces = 1) {
  await vi.waitFor(() => expect(tab.location.replace).toHaveBeenCalledTimes(replaces));
}

describe("createCaseTabs", () => {
  it("opens the named tab synchronously, before the create call", () => {
    const tabs = createCaseTabs();

    tabs.askYumi(askOf());

    expect(open).toHaveBeenCalledTimes(1);
    expect(createWorkbenchSession).toHaveBeenCalledTimes(1);
    expect(open.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(createWorkbenchSession).mock.invocationCallOrder[0]!,
    );
  });

  it("passes exactly two arguments to window.open and no noopener", () => {
    createCaseTabs().askYumi(askOf());

    expect(open.mock.calls[0]).toEqual(["", NAME]);
  });

  it("creates, then sends, then points the tab at the conversation", async () => {
    const tabs = createCaseTabs();

    tabs.askYumi(askOf());
    await settled();

    expect(createWorkbenchSession).toHaveBeenCalledWith({ agent_name: "ops@1", ...CONFIGURATION });
    expect(sendWorkbenchMessage).toHaveBeenCalledWith("session_1", REQUEST);
    expect(tab.location.replace).toHaveBeenCalledWith("/workbench/session_1");
    expect(vi.mocked(createWorkbenchSession).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(sendWorkbenchMessage).mock.invocationCallOrder[0]!,
    );
    expect(vi.mocked(sendWorkbenchMessage).mock.invocationCallOrder[0]).toBeLessThan(
      tab.location.replace.mock.invocationCallOrder[0]!,
    );
  });

  it("joins the base path and the conversation path with one slash", async () => {
    vi.mocked(basePath).mockReturnValue("/s/kanthord");
    const tabs = createCaseTabs();

    tabs.askYumi(askOf());
    await settled();

    expect(tab.location.replace).toHaveBeenCalledWith("/s/kanthord/workbench/session_1");
  });

  it("starts one create and one message on a double click", async () => {
    const tabs = createCaseTabs();

    tabs.askYumi(askOf());
    tabs.askYumi(askOf());
    await settled();
    tabs.askYumi(askOf());

    expect(createWorkbenchSession).toHaveBeenCalledTimes(1);
    expect(sendWorkbenchMessage).toHaveBeenCalledTimes(1);
  });

  it("opens the same name, focuses it and calls no resource after a sent request", async () => {
    const tabs = createCaseTabs();
    tabs.askYumi(askOf());
    await settled();
    vi.mocked(createWorkbenchSession).mockClear();
    vi.mocked(sendWorkbenchMessage).mockClear();

    tabs.askYumi(askOf());

    expect(open).toHaveBeenCalledTimes(2);
    expect(open.mock.calls[1]).toEqual(["", NAME]);
    expect(tab.focus).toHaveBeenCalledTimes(1);
    expect(createWorkbenchSession).not.toHaveBeenCalled();
    expect(sendWorkbenchMessage).not.toHaveBeenCalled();
  });

  it("reopens a closed tab at the same conversation and sends nothing", async () => {
    const tabs = createCaseTabs();
    tabs.askYumi(askOf());
    await settled();
    vi.mocked(sendWorkbenchMessage).mockClear();
    tab.closed = true;
    const reopened = fakeTab();
    open.mockReturnValue(reopened);

    tabs.askYumi(askOf());

    expect(open).toHaveBeenLastCalledWith("", NAME);
    expect(reopened.location.replace).toHaveBeenCalledWith("/workbench/session_1");
    expect(reopened.focus).toHaveBeenCalledTimes(1);
    expect(createWorkbenchSession).toHaveBeenCalledTimes(1);
    expect(sendWorkbenchMessage).not.toHaveBeenCalled();
  });

  it("shows a toast and creates nothing when the tab is blocked", () => {
    open.mockReturnValue(null);
    const tabs = createCaseTabs();
    const notices = toasts();

    tabs.askYumi(askOf({ toasts: notices }));

    expect(notices.blocked).toHaveBeenCalledTimes(1);
    expect(createWorkbenchSession).not.toHaveBeenCalled();
  });

  it("closes the tab and creates nothing when the configuration is missing", () => {
    const tabs = createCaseTabs();
    const notices = toasts();

    tabs.askYumi(askOf({ configuration: null, toasts: notices }));

    expect(tab.close).toHaveBeenCalledTimes(1);
    expect(notices.missingConfiguration).toHaveBeenCalledTimes(1);
    expect(createWorkbenchSession).not.toHaveBeenCalled();
  });

  it("closes the tab and sends nothing when create fails", async () => {
    vi.mocked(createWorkbenchSession).mockRejectedValue(
      new ApiError("unavailable", "The daemon is down.", 503),
    );
    const tabs = createCaseTabs();
    const notices = toasts();

    tabs.askYumi(askOf({ toasts: notices }));

    await vi.waitFor(() =>
      expect(notices.createFailed).toHaveBeenCalledWith("The daemon is down."),
    );
    expect(tab.close).toHaveBeenCalledTimes(1);
    expect(sendWorkbenchMessage).not.toHaveBeenCalled();
  });

  it("keeps the session after a message failure and sends once to it on Retry", async () => {
    vi.mocked(sendWorkbenchMessage).mockRejectedValueOnce(
      new ApiError("unavailable", "The daemon is down.", 503),
    );
    const tabs = createCaseTabs();
    const notices = toasts();

    tabs.askYumi(askOf({ toasts: notices }));
    await vi.waitFor(() => expect(notices.unsent).toHaveBeenCalledTimes(1));

    expect(notices.unsent).toHaveBeenCalledWith("The daemon is down.", expect.any(Function));
    expect(tab.location.replace).toHaveBeenCalledTimes(1);
    expect(tab.location.replace).toHaveBeenCalledWith("/workbench/session_1");
    const retry = notices.unsent.mock.calls[0]![1] as () => void;
    retry();
    await settled(2);

    expect(createWorkbenchSession).toHaveBeenCalledTimes(1);
    expect(sendWorkbenchMessage).toHaveBeenCalledTimes(2);
    expect(sendWorkbenchMessage).toHaveBeenLastCalledWith("session_1", REQUEST);
    expect(tab.location.replace).toHaveBeenCalledWith("/workbench/session_1");
  });

  it("sends once to the same session on a click while the request is unsent", async () => {
    vi.mocked(sendWorkbenchMessage).mockRejectedValueOnce(
      new ApiError("unavailable", "The daemon is down.", 503),
    );
    const tabs = createCaseTabs();
    const notices = toasts();
    tabs.askYumi(askOf({ toasts: notices }));
    await vi.waitFor(() => expect(notices.unsent).toHaveBeenCalledTimes(1));

    tabs.askYumi(askOf({ toasts: notices }));
    await settled(2);

    expect(createWorkbenchSession).toHaveBeenCalledTimes(1);
    expect(sendWorkbenchMessage).toHaveBeenCalledTimes(2);
    expect(sendWorkbenchMessage).toHaveBeenLastCalledWith("session_1", REQUEST);
  });

  it("keeps one registry for each instance", async () => {
    const first = createCaseTabs();
    first.askYumi(askOf());
    await settled();

    createCaseTabs().askYumi(askOf());

    await vi.waitFor(() => expect(createWorkbenchSession).toHaveBeenCalledTimes(2));
  });
});
