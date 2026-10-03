import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setConnection } from "@/api/client";
import { ApiError } from "@/api/errors";
import { verifyHumanToken } from "@/api/resources/gateway";
import { SessionProvider, useSession } from "@/features/auth/session/session-context";
import { LoginScreen } from "./login-screen";

vi.mock("@/api/resources/gateway", () => ({
  readLiveness: vi.fn(),
  verifyHumanToken: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  setConnection: vi.fn(),
}));

const verifyMock = vi.mocked(verifyHumanToken);
const setConnectionMock = vi.mocked(setConnection);

const LOCAL = { id: "i-local", name: "local", baseUrl: "http://localhost:31415" };
const STAGING = { id: "i-staging", name: "staging", baseUrl: "https://kd.example.com" };
const IDENTITY = { kind: "human", sub: "kanthorlabs", name: "Ulrich" } as const;

function seed(defaultId: string | null) {
  window.localStorage.setItem(
    "kanthord.instances",
    JSON.stringify({ instances: [LOCAL, STAGING], defaultId }),
  );
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

describe("LoginScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preselects the default instance and fills the Instance field", () => {
    seed(STAGING.id);
    mount();

    expect(screen.getByRole("combobox", { name: "KanthorD instance" })).toHaveTextContent(
      "staging",
    );
    expect(screen.getByLabelText("Instance")).toHaveValue("https://kd.example.com");
  });

  it("fills the Instance field from the selected instance", async () => {
    seed(STAGING.id);
    mount();

    await userEvent.click(screen.getByRole("combobox", { name: "KanthorD instance" }));
    await userEvent.click(await screen.findByRole("option", { name: "local" }));

    expect(screen.getByLabelText("Instance")).toHaveValue("http://localhost:31415");
  });

  it("names what is missing before sign in is possible", () => {
    seed(null);
    mount();

    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
    expect(screen.getByText("Select an instance to sign in to.")).toBeTruthy();
    const token = screen.getByLabelText("JWT token");
    expect(token).toHaveAccessibleDescription(
      expect.stringMatching(/^Generate a human token with kanthord jwt generate/),
    );
    expect(token).toHaveAccessibleDescription(expect.stringContaining("Paste a token to sign in."));
  });

  it("takes the token as a hidden field with no autocomplete", () => {
    seed(LOCAL.id);
    mount();

    const token = screen.getByLabelText("JWT token");
    expect(token).toHaveAttribute("type", "password");
    expect(token).toHaveAttribute("autocomplete", "off");
  });

  it("signs in with the selected instance and the pasted token", async () => {
    seed(LOCAL.id);
    verifyMock.mockResolvedValue(IDENTITY);
    mount();

    await userEvent.type(screen.getByLabelText("JWT token"), "jwt-1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Signed in as Ulrich")).toBeTruthy();
    expect(verifyMock).toHaveBeenCalledWith("http://localhost:31415", "jwt-1");
    expect(setConnectionMock).toHaveBeenCalledWith({
      baseUrl: "http://localhost:31415",
      token: "jwt-1",
    });
    expect(JSON.parse(window.sessionStorage.getItem("kanthord.session") ?? "null")).toEqual({
      instance: LOCAL,
      token: "jwt-1",
      identity: IDENTITY,
    });
  });

  it("explains a refused token", async () => {
    seed(LOCAL.id);
    verifyMock.mockRejectedValue(new ApiError("unauthorized", "Unauthorized.", 401));
    mount();

    await userEvent.type(screen.getByLabelText("JWT token"), "machine-jwt");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText(
        "The instance refused the token. Use a human token from kanthord jwt generate.",
      ),
    ).toBeTruthy();
    expect(window.sessionStorage.getItem("kanthord.session")).toBeNull();
    expect(setConnectionMock).not.toHaveBeenCalled();
  });

  it("explains an instance that does not answer", async () => {
    seed(LOCAL.id);
    verifyMock.mockRejectedValue(new ApiError("unreachable", "The daemon did not answer.", 0));
    mount();

    await userEvent.type(screen.getByLabelText("JWT token"), "jwt-1");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("The instance did not answer.")).toBeTruthy();
  });

  it("opens the instance manager from the empty state", async () => {
    mount();

    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Add an instance" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByLabelText("Name")).toBeTruthy();
    expect(within(dialog).queryByRole("button", { name: "Add instance" })).toBeNull();
  });

  it("opens the list from Manage instances", async () => {
    mount();

    await userEvent.click(screen.getByRole("button", { name: "Manage instances" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Add instance" })).toBeTruthy();
  });
});
