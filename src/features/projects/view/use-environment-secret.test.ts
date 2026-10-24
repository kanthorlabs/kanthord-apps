import { act, renderHook, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import {
  createEnvironmentSecret,
  readBindingSet,
  readEnvironmentSecret,
  rotateEnvironmentSecret,
  writeBindingSet,
} from "@/api/resources/projects";
import type {
  BindingSet,
  BindingSetWriteResult,
  Credential,
  RepositoryBindingConfig,
} from "@/api/types";
import { useEnvironmentSecret } from "./use-environment-secret";

vi.mock("@/api/resources/projects", () => ({
  createEnvironmentSecret: vi.fn(),
  readBindingSet: vi.fn(),
  readEnvironmentSecret: vi.fn(),
  rotateEnvironmentSecret: vi.fn(),
  writeBindingSet: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn(), info: vi.fn() }),
}));

const CREDENTIAL: Credential = {
  name: "registry-auth",
  platform: "environment_secret",
  holder: "server",
  sealed_to: null,
  sealed_current: true,
  revisions: [
    { id: "rev-1", revision: 1, metadata: null, created_at: 1, ended_at: 5 },
    { id: "rev-2", revision: 2, metadata: null, created_at: 2, ended_at: null },
  ],
};

const REPOSITORY: RepositoryBindingConfig = {
  available: true,
  platform: "github",
  address: "git@github.com:kanthorlabs/kanthord.git",
  strategy: { base_branch: "main" },
  ssh_credential: "github-ssh",
  credential: "github-main",
};

const OTHER = {
  kind: "worker",
  config: { worker: "coder@1", placement: "server" },
} as const;

function bindingSet(secrets?: Readonly<Record<string, string>>): BindingSet {
  return {
    version: 4,
    bindings: {
      engine: {
        kind: "repository",
        config:
          secrets === undefined ? REPOSITORY : { ...REPOSITORY, environment_secrets: secrets },
      },
      coder: OTHER,
    },
  };
}

function absent() {
  return new ApiError("not_found", "Credential not found.", 404, "credential.credential.not_found");
}

function mounted(secrets: Readonly<Record<string, string>> = {}) {
  const onWritten = vi.fn();
  const hook = renderHook(() => useEnvironmentSecret("prj-1", "engine", secrets, onWritten));
  return { hook, onWritten };
}

function fill(
  hook: ReturnType<typeof mounted>["hook"],
  draft: { variable: string; credential: string; value: string },
) {
  act(() => hook.result.current.open());
  act(() => hook.result.current.edit(draft));
}

const VALID = { variable: "REGISTRY_AUTH", credential: "registry-auth", value: "token-1" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(readEnvironmentSecret).mockResolvedValue(CREDENTIAL);
  vi.mocked(createEnvironmentSecret).mockResolvedValue(CREDENTIAL);
  vi.mocked(rotateEnvironmentSecret).mockResolvedValue(CREDENTIAL);
  vi.mocked(readBindingSet).mockResolvedValue(bindingSet());
  vi.mocked(writeBindingSet).mockResolvedValue({} as BindingSetWriteResult);
});

function expectNoRequest() {
  expect(readEnvironmentSecret).not.toHaveBeenCalled();
  expect(createEnvironmentSecret).not.toHaveBeenCalled();
  expect(rotateEnvironmentSecret).not.toHaveBeenCalled();
  expect(readBindingSet).not.toHaveBeenCalled();
  expect(writeBindingSet).not.toHaveBeenCalled();
}

describe("useEnvironmentSecret", () => {
  it("opens with the variable and its credential name prefilled", () => {
    const { hook } = mounted({ REGISTRY_AUTH: "registry-auth" });

    act(() => hook.result.current.open("REGISTRY_AUTH"));

    expect(hook.result.current.editing).toBe(true);
    expect(hook.result.current.draft).toEqual({
      variable: "REGISTRY_AUTH",
      credential: "registry-auth",
      value: "",
    });
  });

  it("opens empty without a variable", () => {
    const { hook } = mounted({ REGISTRY_AUTH: "registry-auth" });

    act(() => hook.result.current.open());

    expect(hook.result.current.draft).toEqual({ variable: "", credential: "", value: "" });
  });

  it("refuses a variable name outside the pattern", () => {
    const { hook } = mounted();
    fill(hook, { ...VALID, variable: "registry-auth" });

    act(() => hook.result.current.send());

    expect(hook.result.current.errors.variable).toBeTruthy();
    expectNoRequest();
  });

  it("refuses a blank credential name", () => {
    const { hook } = mounted();
    fill(hook, { ...VALID, credential: "  " });

    act(() => hook.result.current.send());

    expect(hook.result.current.errors.credential).toBeTruthy();
    expectNoRequest();
  });

  it("refuses a blank value", () => {
    const { hook } = mounted();
    fill(hook, { ...VALID, value: "" });

    act(() => hook.result.current.send());

    expect(hook.result.current.errors.value).toBeTruthy();
    expectNoRequest();
  });

  it("refuses a seventeenth new variable", () => {
    const sixteen = Object.fromEntries(
      Array.from({ length: 16 }, (_, index) => [`VAR_${index}`, "registry-auth"]),
    );
    const { hook } = mounted(sixteen);
    fill(hook, VALID);

    act(() => hook.result.current.send());

    expect(hook.result.current.errors.variable).toBe(
      "A binding holds at most 16 secret variables.",
    );
    expectNoRequest();
  });

  it("accepts the sixteenth variable and a known variable at the limit", async () => {
    const sixteen = Object.fromEntries(
      Array.from({ length: 16 }, (_, index) => [`VAR_${index}`, "registry-auth"]),
    );
    const { hook } = mounted(sixteen);
    fill(hook, { ...VALID, variable: "VAR_3" });

    act(() => hook.result.current.send());

    expect(hook.result.current.errors).toEqual({});
    await waitFor(() => expect(writeBindingSet).toHaveBeenCalled());
  });

  it("creates an absent credential, then writes the binding key", async () => {
    vi.mocked(readEnvironmentSecret).mockRejectedValue(absent());
    const { hook, onWritten } = mounted();
    fill(hook, VALID);

    act(() => hook.result.current.send());

    await waitFor(() => expect(onWritten).toHaveBeenCalled());
    expect(createEnvironmentSecret).toHaveBeenCalledWith({
      name: "registry-auth",
      platform: "environment_secret",
      metadata: null,
      secret: { key: "token-1" },
    });
    expect(rotateEnvironmentSecret).not.toHaveBeenCalled();
    expect(readBindingSet).toHaveBeenCalledWith("prj-1");
    const [projectId, version, bindings] = vi.mocked(writeBindingSet).mock.calls[0] ?? [];
    expect(projectId).toBe("prj-1");
    expect(version).toBe(4);
    expect(bindings?.["engine"]).toEqual({
      kind: "repository",
      config: { ...REPOSITORY, environment_secrets: { REGISTRY_AUTH: "registry-auth" } },
    });
    expect(bindings?.["coder"]).toEqual(OTHER);
  });

  it("keeps the variables that the binding holds", async () => {
    vi.mocked(readBindingSet).mockResolvedValue(bindingSet({ NPM_TOKEN: "npm-token" }));
    const { hook, onWritten } = mounted({ NPM_TOKEN: "npm-token" });
    fill(hook, VALID);

    act(() => hook.result.current.send());

    await waitFor(() =>
      expect(onWritten).toHaveBeenCalledWith({
        NPM_TOKEN: "npm-token",
        REGISTRY_AUTH: "registry-auth",
      }),
    );
  });

  it("rotates an existing credential at its newest live revision", async () => {
    const { hook, onWritten } = mounted();
    fill(hook, VALID);

    act(() => hook.result.current.send());

    await waitFor(() => expect(onWritten).toHaveBeenCalled());
    expect(rotateEnvironmentSecret).toHaveBeenCalledWith("registry-auth", {
      expected_revision: 2,
      secret: { key: "token-1" },
    });
    expect(createEnvironmentSecret).not.toHaveBeenCalled();
    expect(writeBindingSet).toHaveBeenCalledTimes(1);
  });

  it("names an archived credential and writes nothing", async () => {
    vi.mocked(readEnvironmentSecret).mockResolvedValue({
      ...CREDENTIAL,
      revisions: [{ id: "rev-1", revision: 1, metadata: null, created_at: 1, ended_at: 5 }],
    });
    const { hook } = mounted();
    fill(hook, VALID);

    act(() => hook.result.current.send());

    await waitFor(() => expect(hook.result.current.sendError).toContain("archived"));
    expect(rotateEnvironmentSecret).not.toHaveBeenCalled();
    expect(writeBindingSet).not.toHaveBeenCalled();
    expect(hook.result.current.draft.value).toBe("");
  });

  it("sets sendError to the message of a refused binding write and clears the value", async () => {
    vi.mocked(writeBindingSet).mockRejectedValue(
      new ApiError(
        "malformed",
        "The credential registry-auth is absent, archived or of another platform.",
        400,
        "project.bindings.repository.environment_secret_invalid",
      ),
    );
    const { hook, onWritten } = mounted();
    fill(hook, VALID);

    act(() => hook.result.current.send());

    await waitFor(() =>
      expect(hook.result.current.sendError).toBe(
        "The credential registry-auth is absent, archived or of another platform.",
      ),
    );
    expect(hook.result.current.sending).toBe(false);
    expect(hook.result.current.draft.value).toBe("");
    expect(hook.result.current.editing).toBe(true);
    expect(onWritten).not.toHaveBeenCalled();
  });

  it("sets sendError for a failed credential read other than not found", async () => {
    vi.mocked(readEnvironmentSecret).mockRejectedValue(
      new ApiError("unavailable", "The daemon is down.", 503),
    );
    const { hook } = mounted();
    fill(hook, VALID);

    act(() => hook.result.current.send());

    await waitFor(() => expect(hook.result.current.sendError).toBe("The daemon is down."));
    expect(createEnvironmentSecret).not.toHaveBeenCalled();
    expect(writeBindingSet).not.toHaveBeenCalled();
  });

  it("clears the value, closes the sheet and reports after a success", async () => {
    const { hook, onWritten } = mounted();
    fill(hook, VALID);

    act(() => hook.result.current.send());

    await waitFor(() => expect(onWritten).toHaveBeenCalledWith({ REGISTRY_AUTH: "registry-auth" }));
    expect(hook.result.current.draft.value).toBe("");
    expect(hook.result.current.editing).toBe(false);
    expect(hook.result.current.sending).toBe(false);
    expect(toast.success).toHaveBeenCalledWith("Set the secret REGISTRY_AUTH of engine.");
  });

  describe("remove", () => {
    it("writes the binding set without the variable and calls no credential route", async () => {
      vi.mocked(readBindingSet).mockResolvedValue(
        bindingSet({ REGISTRY_AUTH: "registry-auth", NPM_TOKEN: "npm-token" }),
      );
      const { hook, onWritten } = mounted({
        REGISTRY_AUTH: "registry-auth",
        NPM_TOKEN: "npm-token",
      });

      act(() => hook.result.current.remove("REGISTRY_AUTH"));

      await waitFor(() => expect(onWritten).toHaveBeenCalledWith({ NPM_TOKEN: "npm-token" }));
      const bindings = vi.mocked(writeBindingSet).mock.calls[0]?.[2];
      expect(bindings?.["engine"]).toEqual({
        kind: "repository",
        config: { ...REPOSITORY, environment_secrets: { NPM_TOKEN: "npm-token" } },
      });
      expect(readEnvironmentSecret).not.toHaveBeenCalled();
      expect(createEnvironmentSecret).not.toHaveBeenCalled();
      expect(rotateEnvironmentSecret).not.toHaveBeenCalled();
    });

    it("shows an error toast with the message of a failed write", async () => {
      vi.mocked(readBindingSet).mockResolvedValue(bindingSet({ REGISTRY_AUTH: "registry-auth" }));
      vi.mocked(writeBindingSet).mockRejectedValue(
        new ApiError("conflict", "The bindings changed.", 409),
      );
      const { hook, onWritten } = mounted({ REGISTRY_AUTH: "registry-auth" });

      act(() => hook.result.current.remove("REGISTRY_AUTH"));

      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("The bindings changed."));
      expect(onWritten).not.toHaveBeenCalled();
      expect(hook.result.current.sending).toBe(false);
    });
  });
});
