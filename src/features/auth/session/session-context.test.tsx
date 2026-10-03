import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { setConnection } from "@/api/client";
import { Button } from "@/components/ui/button";
import { SessionProvider, useSession } from "./session-context";

vi.mock("@/api/resources/gateway", () => ({
  readLiveness: vi.fn(),
  verifyHumanToken: vi.fn(),
}));

vi.mock("@/api/client", () => ({
  setConnection: vi.fn(),
}));

const setConnectionMock = vi.mocked(setConnection);

const STORED = {
  instance: { id: "i-local", name: "local", baseUrl: "http://localhost:31415" },
  token: "jwt-1",
  identity: { kind: "human", sub: "kanthorlabs", name: "Ulrich" },
};

function Probe() {
  const { session, signOut } = useSession();
  if (session === null) return <p>Signed out</p>;
  return (
    <>
      <p>
        {session.identity.name} on {session.instance.name}
      </p>
      <Button onClick={signOut}>Sign out</Button>
    </>
  );
}

function mount() {
  return render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );
}

describe("SessionProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("restores the session and the connection from sessionStorage", () => {
    window.sessionStorage.setItem("kanthord.session", JSON.stringify(STORED));
    mount();

    expect(screen.getByText("Ulrich on local")).toBeTruthy();
    expect(setConnectionMock).toHaveBeenCalledWith({
      baseUrl: "http://localhost:31415",
      token: "jwt-1",
    });
  });

  it("starts signed out when the stored session is corrupt", () => {
    window.sessionStorage.setItem("kanthord.session", JSON.stringify({ token: 7 }));
    mount();

    expect(screen.getByText("Signed out")).toBeTruthy();
    expect(setConnectionMock).not.toHaveBeenCalled();
  });

  it("forgets the session and the connection on sign out", async () => {
    window.sessionStorage.setItem("kanthord.session", JSON.stringify(STORED));
    mount();

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(screen.getByText("Signed out")).toBeTruthy();
    expect(window.sessionStorage.getItem("kanthord.session")).toBeNull();
    expect(setConnectionMock).toHaveBeenLastCalledWith(null);
  });
});
