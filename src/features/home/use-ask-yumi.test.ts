import { renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { createWorkbenchSession, sendWorkbenchMessage } from "@/api/resources/workbench";
import type { WorkbenchConfiguration, WorkbenchSession } from "@/api/types";
import type { AttentionItem } from "@/lib/attention";

vi.mock("@/api/resources/workbench");
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

import { caseRequestOf } from "./case-request";
import { createCaseTabs } from "./case-tabs";
import { useAskYumi } from "./use-ask-yumi";

const CONFIGURATION: WorkbenchConfiguration = {
  agent_provider: "atlas-llm",
  model_identifier: "qwen3-coder",
  reasoning_effort: "off",
};

const ENABLED = {
  enabled: true,
  configuration: { ok: true, configuration: CONFIGURATION },
} as const;

const BLOCKED = {
  id: "blocked:node_1",
  kind: "blocked",
  group: "decisions",
  subject: "SECRET-NAME",
  node: { id: "node_1", state: "Blocked" },
} as unknown as AttentionItem;

const APPROVAL = { id: "tool_approval:s1", kind: "tool_approval" } as unknown as AttentionItem;
const INBOX = {
  id: "link_update_1",
  kind: "inbox_item",
  group: "inbox",
} as unknown as AttentionItem;

const NAME = "kanthord-case-blocked:node_1";

interface FakeTab {
  closed: boolean;
  readonly location: { readonly replace: ReturnType<typeof vi.fn> };
  readonly focus: ReturnType<typeof vi.fn>;
  readonly close: ReturnType<typeof vi.fn>;
}

let tab: FakeTab;
let open: ReturnType<typeof vi.spyOn>;

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

function press(home: Parameters<typeof useAskYumi>[0] = ENABLED, item = BLOCKED) {
  const caseTabs = createCaseTabs();
  const { result } = renderHook(() => useAskYumi(home, caseTabs));
  const act = result.current(item);
  if (act === null) throw new Error("The item offers no Ask Yumi");
  return { act, caseTabs };
}

beforeEach(() => {
  vi.resetAllMocks();
  tab = { closed: false, location: { replace: vi.fn() }, focus: vi.fn(), close: vi.fn() };
  open = vi.spyOn(window, "open").mockReturnValue(tab as unknown as Window);
  vi.mocked(createWorkbenchSession).mockResolvedValue(session("session_1"));
  vi.mocked(sendWorkbenchMessage).mockResolvedValue({ session_id: "session_1", run_active: true });
});

afterEach(() => {
  open.mockRestore();
  document.head.querySelectorAll("base").forEach((element) => element.remove());
});

describe("useAskYumi", () => {
  it("offers no act for a tool_approval item, an Inbox item or while Yumi is not enabled", () => {
    const caseTabs = createCaseTabs();
    const { result } = renderHook(() => useAskYumi(ENABLED, caseTabs));
    const off = renderHook(() =>
      useAskYumi({ enabled: false, configuration: ENABLED.configuration }, caseTabs),
    );

    expect(result.current(APPROVAL)).toBeNull();
    expect(result.current(INBOX)).toBeNull();
    expect(off.result.current(BLOCKED)).toBeNull();
  });

  it("opens the named tab before the create call with exactly two arguments", () => {
    const { act } = press();

    act();

    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0]).toEqual(["", NAME]);
    expect(open.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(createWorkbenchSession).mock.invocationCallOrder[0]!,
    );
  });

  it("creates, sends the case request and points the tab at the conversation", async () => {
    const { act, caseTabs } = press();

    act();
    await waitFor(() => expect(caseTabs.tabs.get("blocked:node_1")?.sent).toBe(true));

    expect(createWorkbenchSession).toHaveBeenCalledWith({ agent_name: "ops@1", ...CONFIGURATION });
    expect(sendWorkbenchMessage).toHaveBeenCalledWith("session_1", caseRequestOf(BLOCKED));
    expect(caseRequestOf(BLOCKED)).not.toContain("SECRET-NAME");
    expect(tab.location.replace).toHaveBeenCalledWith("/workbench/session_1");
  });

  it("points the tab at the base path under a base element", async () => {
    document.head.insertAdjacentHTML("beforeend", '<base href="/s/kanthord/">');
    const { act, caseTabs } = press();

    act();
    await waitFor(() => expect(caseTabs.tabs.get("blocked:node_1")?.sent).toBe(true));

    expect(tab.location.replace).toHaveBeenCalledWith("/s/kanthord/workbench/session_1");
  });

  it("points the tab at /workbench with no base element and no double slash", async () => {
    const { act, caseTabs } = press();

    act();
    await waitFor(() => expect(caseTabs.tabs.get("blocked:node_1")?.sent).toBe(true));

    expect(tab.location.replace).toHaveBeenCalledWith("/workbench/session_1");
    expect(tab.location.replace).not.toHaveBeenCalledWith("//workbench/session_1");
  });

  it("opens the same name and calls no resource on a click after a sent request", async () => {
    const { act, caseTabs } = press();
    act();
    await waitFor(() => expect(caseTabs.tabs.get("blocked:node_1")?.sent).toBe(true));
    vi.mocked(createWorkbenchSession).mockClear();
    vi.mocked(sendWorkbenchMessage).mockClear();

    act();

    expect(open).toHaveBeenLastCalledWith("", NAME);
    expect(tab.focus).toHaveBeenCalledTimes(1);
    expect(createWorkbenchSession).not.toHaveBeenCalled();
    expect(sendWorkbenchMessage).not.toHaveBeenCalled();
  });

  it("shows a toast and stores nothing when the tab is blocked", () => {
    open.mockReturnValue(null);
    const { act, caseTabs } = press();

    act();

    expect(toast.error).toHaveBeenCalledWith("The browser blocked the case tab.");
    expect(createWorkbenchSession).not.toHaveBeenCalled();
    expect(caseTabs.tabs.size).toBe(0);
  });

  it("closes the tab and shows a toast when the Yumi configuration is missing", () => {
    const { act, caseTabs } = press({
      enabled: true,
      configuration: { ok: false, errors: { agentProvider: "Choose a value." } },
    });

    act();

    expect(tab.close).toHaveBeenCalledTimes(1);
    expect(toast.error).toHaveBeenCalledWith("Yumi has no default configuration.");
    expect(createWorkbenchSession).not.toHaveBeenCalled();
    expect(caseTabs.tabs.size).toBe(0);
  });

  it("closes the tab and shows a toast when create fails", async () => {
    vi.mocked(createWorkbenchSession).mockRejectedValue(
      new ApiError("unavailable", "The daemon is down.", 503),
    );
    const { act, caseTabs } = press();

    act();

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("The case conversation could not start.", {
        description: "The daemon is down.",
      }),
    );
    expect(tab.close).toHaveBeenCalledTimes(1);
    expect(caseTabs.tabs.size).toBe(0);
  });

  it("shows the unsent toast with Retry that sends once to the same session", async () => {
    vi.mocked(sendWorkbenchMessage).mockRejectedValueOnce(
      new ApiError("unavailable", "The daemon is down.", 503),
    );
    const { act, caseTabs } = press();

    act();
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    const [message, options] = vi.mocked(toast.error).mock.calls[0]!;
    expect(message).toBe("The case request was not sent.");
    expect(options).toMatchObject({ description: "The daemon is down." });
    const action = (options as { action: { label: string; onClick: () => void } }).action;
    expect(action.label).toBe("Retry");
    expect(tab.location.replace).not.toHaveBeenCalled();
    action.onClick();
    await waitFor(() => expect(caseTabs.tabs.get("blocked:node_1")?.sent).toBe(true));

    expect(createWorkbenchSession).toHaveBeenCalledTimes(1);
    expect(sendWorkbenchMessage).toHaveBeenCalledTimes(2);
    expect(sendWorkbenchMessage).toHaveBeenLastCalledWith("session_1", caseRequestOf(BLOCKED));
    expect(tab.location.replace).toHaveBeenCalledWith("/workbench/session_1");
  });
});
