import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import type * as Sonner from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setConnection } from "@/api/client";
import { ApiError } from "@/api/errors";
import { readLiveness, verifyHumanToken } from "@/api/resources/gateway";
import type { LivenessReport } from "@/api/types";
import { SessionProvider, useSession } from "@/features/auth/session/session-context";
import { LoginScreen } from "./login-screen";

vi.mock("@/api/resources/gateway", () => ({
  readLiveness: vi.fn(),
  verifyHumanToken: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  setConnection: vi.fn(),
}));

vi.mock("sonner", async (importOriginal) => ({
  ...(await importOriginal<typeof Sonner>()),
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));

const verifyMock = vi.mocked(verifyHumanToken);
const livenessMock = vi.mocked(readLiveness);
const setConnectionMock = vi.mocked(setConnection);
const toastSuccessMock = vi.mocked(toast.success);

const LOCAL = {
  id: "i-local",
  name: "local",
  baseUrl: "http://localhost:31415",
  token: "jwt-local",
};
const STAGING = {
  id: "i-staging",
  name: "staging",
  baseUrl: "https://kd.example.com",
  token: "jwt-staging",
};
const IDENTITY = { kind: "human", sub: "kanthorlabs", name: "Ulrich" } as const;

function seed(...instances: (typeof LOCAL)[]) {
  window.localStorage.setItem("kanthord.instances", JSON.stringify({ instances }));
}

function stored(): unknown {
  return JSON.parse(window.localStorage.getItem("kanthord.instances") ?? "null");
}

function SignedIn() {
  const { session } = useSession();
  return session === null ? <LoginScreen /> : <p>Signed in as {session.identity.name}</p>;
}

function mount() {
  return render(
    <SessionProvider>
      <SignedIn />
    </SessionProvider>,
  );
}

function form() {
  return screen.getByRole("form", { name: "Login" });
}

function row(name: string) {
  return within(screen.getByRole("list", { name: "Saved instances" }))
    .getAllByRole("listitem")
    .find((item) => within(item).queryByText(name) !== null) as HTMLElement;
}

async function replace(label: string, value: string) {
  const field = within(form()).getByLabelText(label);
  await userEvent.clear(field);
  if (value !== "") await userEvent.type(field, value);
}

async function fill(endpoint: string, token: string, name = "") {
  await replace("Name", name);
  await replace("Endpoint", endpoint);
  await replace("JWT token", token);
}

describe("LoginScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form and the list on one page with no dialog", () => {
    seed(LOCAL);
    mount();

    expect(form()).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Saved instances" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("hides the list and fills the localhost instance when nothing is saved", () => {
    mount();

    expect(screen.queryByRole("list", { name: "Saved instances" })).toBeNull();
    expect(screen.queryByText("Saved instances")).toBeNull();
    expect(within(form()).getByLabelText("Name")).toHaveValue("localhost");
    expect(within(form()).getByLabelText("Endpoint")).toHaveValue("http://localhost:31415");
    expect(within(form()).getByLabelText("JWT token")).toHaveValue("");
  });

  it("starts with an empty form when an instance is saved", () => {
    seed(LOCAL);
    mount();

    expect(within(form()).getByLabelText("Name")).toHaveValue("");
    expect(within(form()).getByLabelText("Endpoint")).toHaveValue("");
  });

  it("disables Verify and Login until the endpoint and the token are filled", async () => {
    mount();

    const verify = within(form()).getByRole("button", { name: "Verify" });
    const login = within(form()).getByRole("button", { name: "Login" });
    expect(verify).toBeDisabled();
    expect(login).toBeDisabled();

    await replace("JWT token", "jwt-1");
    expect(verify).toBeEnabled();
    expect(login).toBeEnabled();

    await replace("Endpoint", "");
    expect(verify).toBeDisabled();
    expect(login).toBeDisabled();
  });

  it("logs in with the filled localhost instance and saves it", async () => {
    verifyMock.mockResolvedValue(IDENTITY);
    mount();

    await replace("JWT token", "dev-human-token");
    await userEvent.click(within(form()).getByRole("button", { name: "Login" }));

    await screen.findByText("Signed in as Ulrich");
    expect(stored()).toEqual({
      instances: [
        {
          id: expect.any(String),
          name: "localhost",
          baseUrl: "http://localhost:31415",
          token: "dev-human-token",
        },
      ],
    });
  });

  it("takes the token as a hidden field with no autocomplete", () => {
    mount();

    const token = within(form()).getByLabelText("JWT token");
    expect(token).toHaveAttribute("type", "password");
    expect(token).toHaveAttribute("autocomplete", "off");
  });

  it("toasts a reachable endpoint of the form for 3 seconds", async () => {
    livenessMock.mockResolvedValue({ healthy: true, services: {} });
    mount();

    await fill("http://localhost:31415/", "jwt-1");
    await userEvent.click(within(form()).getByRole("button", { name: "Verify" }));

    expect(livenessMock).toHaveBeenCalledWith("http://localhost:31415");
    await vi.waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith("http://localhost:31415 is reachable.", {
        duration: 3000,
      }),
    );
    expect(within(form()).queryByRole("status")).toBeNull();
  });

  it("shows the check on the Verify button and renders no chip while it runs", async () => {
    let answer: (report: LivenessReport) => void = () => undefined;
    livenessMock.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    seed(LOCAL);
    mount();

    await fill("http://localhost:31415", "jwt-1");
    await userEvent.click(within(form()).getByRole("button", { name: "Verify" }));
    await userEvent.click(screen.getByRole("button", { name: "Verify local" }));

    expect(within(form()).getByRole("button", { name: "Verifying…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Verifying local" })).toBeDisabled();
    expect(screen.queryByRole("status")).toBeNull();

    answer({ healthy: true, services: {} });

    expect(await within(form()).findByRole("button", { name: "Verify" })).toBeEnabled();
    expect(await screen.findByRole("button", { name: "Verify local" })).toBeEnabled();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps an unreachable endpoint of the form inline", async () => {
    livenessMock.mockRejectedValue(new ApiError("unreachable", "The daemon did not answer.", 0));
    mount();

    await fill("http://localhost:31415", "jwt-1");
    await userEvent.click(within(form()).getByRole("button", { name: "Verify" }));

    expect(await within(form()).findByText("Unreachable")).toBeInTheDocument();
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("logs in and saves the instance named after its endpoint", async () => {
    verifyMock.mockResolvedValue(IDENTITY);
    mount();

    await fill("http://localhost:31415/", "jwt-1");
    await userEvent.click(within(form()).getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Signed in as Ulrich")).toBeInTheDocument();
    expect(verifyMock).toHaveBeenCalledWith("http://localhost:31415", "jwt-1");
    expect(setConnectionMock).toHaveBeenCalledWith({
      baseUrl: "http://localhost:31415",
      token: "jwt-1",
    });
    expect(stored()).toEqual({
      instances: [
        {
          id: expect.any(String),
          name: "http://localhost:31415",
          baseUrl: "http://localhost:31415",
          token: "jwt-1",
        },
      ],
    });
  });

  it("updates the saved instance that already uses the endpoint", async () => {
    seed(LOCAL, STAGING);
    verifyMock.mockResolvedValue(IDENTITY);
    mount();

    await fill("http://localhost:31415", "jwt-new", "dev");
    await userEvent.click(within(form()).getByRole("button", { name: "Login" }));

    await screen.findByText("Signed in as Ulrich");
    expect(stored()).toEqual({ instances: [{ ...LOCAL, name: "dev", token: "jwt-new" }, STAGING] });
  });

  it("explains a refused token and saves nothing", async () => {
    verifyMock.mockRejectedValue(new ApiError("unauthorized", "Unauthorized.", 401));
    mount();

    await fill("http://localhost:31415", "machine-jwt");
    await userEvent.click(within(form()).getByRole("button", { name: "Login" }));

    expect(
      await screen.findByText(
        "The instance refused the token. Use a human token from kanthord jwt generate.",
      ),
    ).toBeInTheDocument();
    expect(window.localStorage.getItem("kanthord.instances")).toBeNull();
    expect(setConnectionMock).not.toHaveBeenCalled();
  });

  it("explains an instance that does not answer", async () => {
    verifyMock.mockRejectedValue(new ApiError("unreachable", "The daemon did not answer.", 0));
    mount();

    await fill("http://localhost:31415", "jwt-1");
    await userEvent.click(within(form()).getByRole("button", { name: "Login" }));

    expect(
      await screen.findByText(
        `The instance did not answer. Its configured origins may not include this dashboard origin, ${window.location.origin}.`,
      ),
    ).toBeInTheDocument();
  });

  it("signs in with the saved token from a tap on the instance", async () => {
    seed(LOCAL, STAGING);
    verifyMock.mockResolvedValue(IDENTITY);
    mount();

    await userEvent.click(screen.getByRole("button", { name: "Sign in to staging" }));

    expect(await screen.findByText("Signed in as Ulrich")).toBeInTheDocument();
    expect(verifyMock).toHaveBeenCalledWith("https://kd.example.com", "jwt-staging");
  });

  it("shows a refused saved token on its row", async () => {
    seed(LOCAL);
    verifyMock.mockRejectedValue(new ApiError("unauthorized", "Unauthorized.", 401));
    mount();

    await userEvent.click(screen.getByRole("button", { name: "Sign in to local" }));

    expect(
      await within(row("local")).findByText(
        "The instance refused the token. Use a human token from kanthord jwt generate.",
      ),
    ).toBeInTheDocument();
  });

  it("toasts a reachable saved instance", async () => {
    seed(LOCAL);
    livenessMock.mockResolvedValue({ healthy: true, services: {} });
    mount();

    await userEvent.click(screen.getByRole("button", { name: "Verify local" }));

    expect(livenessMock).toHaveBeenCalledWith("http://localhost:31415");
    await vi.waitFor(() =>
      expect(toastSuccessMock).toHaveBeenCalledWith("http://localhost:31415 is reachable.", {
        duration: 3000,
      }),
    );
    expect(within(row("local")).queryByRole("status")).toBeNull();
  });

  it("asks before it deletes and keeps the instance on Keep", async () => {
    seed(LOCAL, STAGING);
    mount();

    await userEvent.click(screen.getByRole("button", { name: "Delete local" }));
    expect(within(row("local")).getByRole("alert")).toHaveTextContent(
      "Delete local? This browser forgets its endpoint and token.",
    );
    expect(screen.queryByRole("dialog")).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Keep" }));
    expect(stored()).toEqual({ instances: [LOCAL, STAGING] });
    expect(screen.getByRole("button", { name: "Delete local" })).toBeInTheDocument();
  });

  it("deletes the instance after the confirmation", async () => {
    seed(LOCAL, STAGING);
    mount();

    await userEvent.click(screen.getByRole("button", { name: "Delete local" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete instance" }));

    expect(stored()).toEqual({ instances: [STAGING] });
    expect(screen.queryByRole("button", { name: "Sign in to local" })).toBeNull();
  });

  it("edits a saved instance inline", async () => {
    seed(LOCAL, STAGING);
    mount();

    await userEvent.click(screen.getByRole("button", { name: "Edit local" }));
    const editor = screen.getByRole("form", { name: "Edit local" });
    expect(screen.queryByRole("dialog")).toBeNull();
    const name = within(editor).getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "dev");
    await userEvent.click(within(editor).getByRole("button", { name: "Save" }));

    expect(stored()).toEqual({ instances: [{ ...LOCAL, name: "dev" }, STAGING] });
    expect(screen.getByRole("button", { name: "Sign in to dev" })).toBeInTheDocument();
  });

  it("refuses an edit that takes the endpoint of another instance", async () => {
    seed(LOCAL, STAGING);
    mount();

    await userEvent.click(screen.getByRole("button", { name: "Edit local" }));
    const editor = screen.getByRole("form", { name: "Edit local" });
    const endpoint = within(editor).getByLabelText("Endpoint");
    await userEvent.clear(endpoint);
    await userEvent.type(endpoint, "https://kd.example.com");
    await userEvent.click(within(editor).getByRole("button", { name: "Save" }));

    expect(
      within(editor).getByText("The instance staging already uses this URL."),
    ).toBeInTheDocument();
    expect(stored()).toEqual({ instances: [LOCAL, STAGING] });
  });

  it("closes the editor on Cancel without a change", async () => {
    seed(LOCAL);
    mount();

    await userEvent.click(screen.getByRole("button", { name: "Edit local" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.queryByRole("form", { name: "Edit local" })).toBeNull();
    expect(stored()).toEqual({ instances: [LOCAL] });
  });
});
