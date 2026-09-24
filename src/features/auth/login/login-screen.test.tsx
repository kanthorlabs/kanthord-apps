import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/api/errors";
import { signIn } from "@/api/resources/session";
import { SessionProvider } from "@/features/auth/session/session-context";
import { LoginScreen } from "./login-screen";

vi.mock("@/api/resources/session", () => ({
  signIn: vi.fn(),
  signOut: vi.fn(),
  currentSession: vi.fn(),
}));

const signInMock = vi.mocked(signIn);

function mount() {
  return render(
    <SessionProvider>
      <LoginScreen />
    </SessionProvider>,
  );
}

describe("LoginScreen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the typed username and password to the daemon", async () => {
    signInMock.mockResolvedValue({ token: "tok-1", username: "ulrich" });
    mount();

    await userEvent.type(screen.getByLabelText("Username"), "ulrich");
    await userEvent.type(screen.getByLabelText("Password"), "kanthord");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(signInMock).toHaveBeenCalledWith("ulrich", "kanthord");
  });

  it("asks for both fields before it calls the daemon", async () => {
    mount();

    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(signInMock).not.toHaveBeenCalled();
    expect(await screen.findByText("Type the username and the password.")).toBeTruthy();
  });

  it("reads back the refusal of the daemon", async () => {
    signInMock.mockRejectedValue(
      new ApiError("unauthorized", "The username or the password is wrong.", 401),
    );
    mount();

    await userEvent.type(screen.getByLabelText("Username"), "ulrich");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("The username or the password is wrong.")).toBeTruthy();
  });

  it("tells the human to start the daemon when it does not answer", async () => {
    signInMock.mockRejectedValue(new ApiError("unreachable", "The daemon did not answer.", 0));
    mount();

    await userEvent.type(screen.getByLabelText("Username"), "ulrich");
    await userEvent.type(screen.getByLabelText("Password"), "kanthord");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(
      await screen.findByText("The daemon did not answer. Start it and try again."),
    ).toBeTruthy();
  });

  it("never puts the password into the document as readable text", async () => {
    mount();
    const password = screen.getByLabelText("Password");
    expect(password.getAttribute("type")).toBe("password");
  });
});
