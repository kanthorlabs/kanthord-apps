import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GuestScreen } from "./guest-screen";
import { JoinScreen } from "./join-screen";

vi.mock("./guest-chat", () => ({
  GuestChat: () => <p>Guest chat</p>,
}));

const INVITE = "5b0f8f0e-3a54-4a0b-9d5e-2f3f6a1c7a10";
const ISSUED = "issued-guest-credential";
const JOINED = {
  guest_token: ISSUED,
  guest_id: "guest_1",
  name: "Dana Lee",
  session_id: "workbench_session_1",
  expires_at: 1790000000000,
};

interface Sent {
  readonly url: string;
  readonly method: string;
  readonly body: string;
  readonly authorization: string | null;
}

const sent: Sent[] = [];

function answer(status: number, body: unknown) {
  return vi.fn((url: string, init: RequestInit) => {
    sent.push({
      url,
      method: init.method ?? "GET",
      body: typeof init.body === "string" ? init.body : "",
      authorization: new Headers(init.headers).get("authorization"),
    });
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  });
}

function renderJoin() {
  return render(
    <MemoryRouter initialEntries={[`/join/${INVITE}`]}>
      <Routes>
        <Route path="join/:token" element={<JoinScreen />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  sent.length = 0;
  window.history.pushState({}, "", `/join/${INVITE}#name=Dana%20Lee`);
  vi.stubGlobal("fetch", answer(200, JOINED));
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.querySelector("base")?.remove();
});

const NAME_LABEL = "Your name (prefilled from the invite, you can change it)";

describe("JoinScreen", () => {
  it("prefills the name from the fragment and keeps it editable", async () => {
    renderJoin();

    expect(screen.getByText("Join a shared conversation")).toBeInTheDocument();
    const field = screen.getByLabelText(NAME_LABEL);
    expect(field).toHaveValue("Dana Lee");

    await userEvent.clear(field);
    await userEvent.type(field, "Sam");

    expect(field).toHaveValue("Sam");
  });

  it("drops the token and the fragment from the address", () => {
    renderJoin();

    expect(window.location.pathname).toBe("/guest");
    expect(window.location.hash).toBe("");
    expect(window.location.href).not.toContain(INVITE);
  });

  it("replaces the address under the base path", () => {
    const base = document.createElement("base");
    base.setAttribute("href", "/dash/");
    document.head.append(base);

    renderJoin();

    expect(window.location.pathname).toBe("/dash/guest");
    expect(window.location.hash).toBe("");
  });

  it("posts the edited name, stores the answer and shows the guest chat", async () => {
    renderJoin();
    const field = screen.getByLabelText(NAME_LABEL);
    await userEvent.clear(field);
    await userEvent.type(field, "Sam");

    await userEvent.click(screen.getByRole("button", { name: "Join" }));

    expect(await screen.findByText("Guest chat")).toBeInTheDocument();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.method).toBe("POST");
    expect(sent[0]!.url).toMatch(/\/api\/workbench\/invite\/join$/);
    expect(JSON.parse(sent[0]!.body)).toEqual({ invite_token: INVITE, name: "Sam" });
    expect(sent[0]!.authorization).toBeNull();
    expect(JSON.parse(window.sessionStorage.getItem("kanthord.guest") ?? "null")).toEqual(JOINED);
    expect(window.localStorage.length).toBe(0);
    expect(document.cookie).toBe("");
  });

  it("sends no request that carries the fragment", async () => {
    renderJoin();

    await userEvent.click(screen.getByRole("button", { name: "Join" }));
    await screen.findByText("Guest chat");

    for (const request of sent) {
      expect(request.url).not.toContain("#");
      expect(request.url).not.toContain("name=");
      expect(request.body).not.toContain("#name=");
    }
  });

  it("requires a name of 1 to 64 nonblank characters before it sends", async () => {
    renderJoin();
    const field = screen.getByLabelText(NAME_LABEL);

    await userEvent.clear(field);
    await userEvent.type(field, "   ");
    await userEvent.click(screen.getByRole("button", { name: "Join" }));

    expect(screen.getByText("Enter a name of 1 to 64 characters.")).toBeInTheDocument();

    await userEvent.clear(field);
    await userEvent.type(field, "x".repeat(65));
    await userEvent.click(screen.getByRole("button", { name: "Join" }));

    expect(screen.getByText("Enter a name of 1 to 64 characters.")).toBeInTheDocument();
    expect(sent).toHaveLength(0);
  });

  it("counts the name after trim and NFC, as the engine does", async () => {
    renderJoin();
    const field = screen.getByLabelText(NAME_LABEL);
    await userEvent.clear(field);
    await userEvent.click(field);
    await userEvent.paste(` ${"é".repeat(64)} `);

    await userEvent.click(screen.getByRole("button", { name: "Join" }));

    expect(await screen.findByText("Guest chat")).toBeInTheDocument();
    expect(JSON.parse(sent[0]!.body)).toEqual({ invite_token: INVITE, name: "é".repeat(64) });
  });

  it("shows one error line under the form for an unknown invite", async () => {
    vi.stubGlobal(
      "fetch",
      answer(404, {
        error: { code: "workbench.invite.not_found", message: "The invite does not exist." },
      }),
    );
    renderJoin();

    await userEvent.click(screen.getByRole("button", { name: "Join" }));

    const line = await screen.findByRole("alert");
    expect(line).toHaveTextContent("workbench.invite.not_found The invite does not exist.");
    expect(line.closest("[data-slot=card]")).toHaveClass("border-destructive");
    expect(window.sessionStorage.getItem("kanthord.guest")).toBeNull();
  });

  it("shows the name error line under the name field", async () => {
    vi.stubGlobal(
      "fetch",
      answer(400, {
        error: { code: "workbench.invite.name_invalid", message: "The name is not valid." },
      }),
    );
    renderJoin();

    await userEvent.click(screen.getByRole("button", { name: "Join" }));

    const line = await screen.findByRole("alert");
    expect(line).toHaveTextContent("workbench.invite.name_invalid The name is not valid.");
    expect(screen.getByLabelText(NAME_LABEL)).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(NAME_LABEL).parentElement).toContainElement(line);
  });
});

describe("JoinScreen with a stored session", () => {
  it("shows the join form for the token of the link and keeps the stored session until the join answers", async () => {
    const ENDED = { ...JOINED, guest_token: "ended-guest-credential" };
    window.sessionStorage.setItem("kanthord.guest", JSON.stringify(ENDED));

    renderJoin();

    expect(screen.getByRole("form", { name: "Join" })).toBeInTheDocument();
    expect(screen.queryByText("Guest chat")).not.toBeInTheDocument();
    expect(JSON.parse(window.sessionStorage.getItem("kanthord.guest") ?? "null")).toEqual(ENDED);

    await userEvent.click(screen.getByRole("button", { name: "Join" }));

    expect(await screen.findByText("Guest chat")).toBeInTheDocument();
    expect(JSON.parse(window.sessionStorage.getItem("kanthord.guest") ?? "null")).toEqual(JOINED);
  });
});

describe("GuestScreen", () => {
  it("renders the guest chat after a reload with a stored guest session", () => {
    window.sessionStorage.setItem("kanthord.guest", JSON.stringify(JOINED));

    render(<GuestScreen />);

    expect(screen.getByText("Guest chat")).toBeInTheDocument();
  });

  it("asks for the invite link again with no stored guest session", () => {
    render(<GuestScreen />);

    expect(screen.getByText("Open your invite link again.")).toBeInTheDocument();
  });
});
