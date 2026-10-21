import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import type * as Sonner from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setConnection } from "@/api/client";
import { ApiError } from "@/api/errors";
import { readLiveness, verifyHumanToken } from "@/api/resources/gateway";
import { SessionProvider, useSession } from "@/features/auth/session/session-context";
import { LoginScreen } from "./login-screen";
import { textContent } from "../../../../test/text-content";

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
const EXPIRY_SECONDS = Date.UTC(2026, 11, 31, 23, 59) / 1000;
const TOKEN_WITH_EXPIRY = `header.${btoa(
  JSON.stringify({ sub: "kanthorlabs", exp: EXPIRY_SECONDS }),
)
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "")}.signature`;

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
  return within(screen.getByRole("list", { name: "Saved servers" }))
    .getAllByRole("listitem")
    .find((item) => within(item).queryAllByText(name).length > 0) as HTMLElement;
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
    expect(screen.getByRole("list", { name: "Saved servers" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("heading", { name: "Saved servers" })).toBeInTheDocument();
    expect(screen.getByText("Sign in to a KanthorD server with a human token.")).toBeTruthy();
  });

  it("hides the list and fills the localhost server when nothing is saved", () => {
    mount();

    expect(screen.queryByRole("list", { name: "Saved servers" })).toBeNull();
    expect(screen.queryByText("Saved servers")).toBeNull();
    expect(within(form()).getByLabelText("Name")).toHaveValue("localhost");
    expect(within(form()).getByLabelText("Endpoint")).toHaveValue("http://localhost:31415");
    expect(within(form()).getByLabelText("JWT token")).toHaveValue("");
  });

  it("starts with the default endpoint and an empty name when a server is saved", () => {
    seed(LOCAL);
    mount();

    expect(within(form()).getByLabelText("Name")).toHaveValue("");
    expect(within(form()).getByLabelText("Endpoint")).toHaveValue("http://localhost:31415");
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
          id: expect.stringMatching(/^[0-9A-HJKMNP-TV-Z]{26}$/),
          name: "localhost",
          baseUrl: "http://localhost:31415",
          token: "dev-human-token",
        },
      ],
    });
  });

  it("states the host and the container form of the token command", () => {
    mount();

    expect(
      within(form()).getByText(
        textContent(
          "Generate a human token with kanthord auth jwt generate <user>. In a container, run podman exec -it <container> kanthord auth jwt generate <user>.",
        ),
      ),
    ).toBeInTheDocument();
  });

  it("takes the token as a hidden field with no autocomplete", () => {
    mount();

    const token = within(form()).getByLabelText("JWT token");
    expect(token).toHaveAttribute("type", "password");
    expect(token).toHaveAttribute("autocomplete", "off");
  });

  it("verifies the token of the form and shows the subject and the expiry", async () => {
    verifyMock.mockResolvedValue(IDENTITY);
    mount();

    await fill("http://localhost:31415/", TOKEN_WITH_EXPIRY);
    await userEvent.click(within(form()).getByRole("button", { name: "Verify" }));

    expect(await within(form()).findByText("Verified")).toBeInTheDocument();
    expect(verifyMock).toHaveBeenCalledWith("http://localhost:31415", TOKEN_WITH_EXPIRY);
    expect(livenessMock).not.toHaveBeenCalled();
    expect(within(form()).getByRole("status")).toHaveTextContent(
      "Subject kanthorlabs. Expires 2026-12-31 23:59 UTC.",
    );
    expect(toastSuccessMock).not.toHaveBeenCalled();
  });

  it("shows the subject only when the token carries no expiry", async () => {
    verifyMock.mockResolvedValue(IDENTITY);
    mount();

    await fill("http://localhost:31415", "jwt-1");
    await userEvent.click(within(form()).getByRole("button", { name: "Verify" }));

    expect(await within(form()).findByText("Verified")).toBeInTheDocument();
    expect(within(form()).getByRole("status")).toHaveTextContent(
      /^Verified\s*Subject kanthorlabs\.$/,
    );
  });

  it("shows a refused token as Failed with the way out", async () => {
    verifyMock.mockRejectedValue(new ApiError("unauthorized", "Unauthorized.", 401));
    mount();

    await fill("http://localhost:31415", "machine-jwt");
    await userEvent.click(within(form()).getByRole("button", { name: "Verify" }));

    expect(await within(form()).findByText("Failed")).toBeInTheDocument();
    expect(
      within(form()).getByText(
        "The server refused the token. Use a human token from kanthord auth jwt generate.",
      ),
    ).toBeInTheDocument();
    expect(within(form()).queryByText("Verified")).toBeNull();
  });

  it("resets the badge when the token changes", async () => {
    verifyMock.mockResolvedValue(IDENTITY);
    mount();

    await fill("http://localhost:31415", "jwt-1");
    await userEvent.click(within(form()).getByRole("button", { name: "Verify" }));
    expect(await within(form()).findByText("Verified")).toBeInTheDocument();

    await userEvent.type(within(form()).getByLabelText("JWT token"), "x");

    expect(within(form()).queryByRole("status")).toBeNull();
  });

  it("names the expiry of a refused token that has expired", async () => {
    const expired = Date.UTC(2020, 0, 2, 3, 4) / 1000;
    const token = `header.${btoa(JSON.stringify({ exp: expired }))}.signature`;
    verifyMock.mockRejectedValue(new ApiError("unauthorized", "Unauthorized.", 401));
    mount();

    await fill("http://localhost:31415", token);
    await userEvent.click(within(form()).getByRole("button", { name: "Verify" }));

    expect(
      await within(form()).findByText(
        "The token expired at 2020-01-02 03:04 UTC. Generate a new one with kanthord auth jwt generate.",
      ),
    ).toBeInTheDocument();
  });

  it("resets the badge when the endpoint changes", async () => {
    verifyMock.mockResolvedValue(IDENTITY);
    mount();

    await fill("http://localhost:31415", "jwt-1");
    await userEvent.click(within(form()).getByRole("button", { name: "Verify" }));
    expect(await within(form()).findByText("Verified")).toBeInTheDocument();

    await userEvent.type(within(form()).getByLabelText("Endpoint"), "0");

    expect(within(form()).queryByRole("status")).toBeNull();
  });

  it("drops a late answer after the token changed", async () => {
    let answer: (identity: typeof IDENTITY) => void = () => undefined;
    verifyMock.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    mount();

    await fill("http://localhost:31415", "jwt-1");
    await userEvent.click(within(form()).getByRole("button", { name: "Verify" }));
    await userEvent.type(within(form()).getByLabelText("JWT token"), "x");
    answer(IDENTITY);

    expect(await within(form()).findByRole("button", { name: "Verify" })).toBeEnabled();
    expect(within(form()).queryByRole("status")).toBeNull();
  });

  it("drops a late answer after the endpoint changed", async () => {
    let answer: (identity: typeof IDENTITY) => void = () => undefined;
    verifyMock.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    mount();

    await fill("http://localhost:31415", "jwt-1");
    await userEvent.click(within(form()).getByRole("button", { name: "Verify" }));
    await userEvent.type(within(form()).getByLabelText("Endpoint"), "0");
    answer(IDENTITY);

    expect(await within(form()).findByRole("button", { name: "Verify" })).toBeEnabled();
    expect(within(form()).queryByRole("status")).toBeNull();
  });

  it("shows the check on the Verify button and renders no chip while it runs", async () => {
    let answerToken: (identity: typeof IDENTITY) => void = () => undefined;
    verifyMock.mockReturnValue(new Promise((resolve) => (answerToken = resolve)));
    seed(LOCAL);
    mount();

    await fill("http://localhost:31415", "jwt-1");
    await userEvent.click(within(form()).getByRole("button", { name: "Verify" }));
    await userEvent.click(screen.getByRole("button", { name: "Verify local" }));

    expect(within(form()).getByRole("button", { name: "Verifying…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Verifying local" })).toBeDisabled();
    expect(screen.queryByRole("status")).toBeNull();

    answerToken(IDENTITY);

    expect(await within(form()).findByRole("button", { name: "Verify" })).toBeEnabled();
    expect(await screen.findByRole("button", { name: "Verify local" })).toBeEnabled();
    expect(within(form()).getByText("Verified")).toBeInTheDocument();
    expect(within(row("local")).getByText("Verified")).toBeInTheDocument();
  });

  it("keeps an unreachable endpoint of the form inline", async () => {
    verifyMock.mockRejectedValue(new ApiError("unreachable", "The daemon did not answer.", 0));
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
        "The server refused the token. Use a human token from kanthord auth jwt generate.",
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
        `The server did not answer. Its configured origins may not include this dashboard origin, ${window.location.origin}.`,
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
        "The server refused the token. Use a human token from kanthord auth jwt generate.",
      ),
    ).toBeInTheDocument();
  });

  it("verifies the saved token of an instance and shows the subject", async () => {
    seed(LOCAL);
    verifyMock.mockResolvedValue(IDENTITY);
    mount();

    await userEvent.click(screen.getByRole("button", { name: "Verify local" }));

    expect(await within(row("local")).findByText("Verified")).toBeInTheDocument();
    expect(verifyMock).toHaveBeenCalledWith("http://localhost:31415", "jwt-local");
    expect(livenessMock).not.toHaveBeenCalled();
    expect(within(row("local")).getByRole("status")).toHaveTextContent("Subject kanthorlabs.");
  });

  it("shows a refused saved token on Verify", async () => {
    seed(LOCAL);
    verifyMock.mockRejectedValue(new ApiError("unauthorized", "Unauthorized.", 401));
    mount();

    await userEvent.click(screen.getByRole("button", { name: "Verify local" }));

    expect(await within(row("local")).findByText("Failed")).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole("button", { name: "Delete server" }));

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
      within(editor).getByText("The server staging already uses this URL."),
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
