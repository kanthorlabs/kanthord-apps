import { request, setToken } from "../client";
import type { Session } from "../types";

export async function signIn(username: string, password: string): Promise<Session> {
  const session = await request<Session>("/v1/session", {
    method: "POST",
    body: { username, password },
  });
  setToken(session.token);
  return session;
}

export async function currentSession(): Promise<Session> {
  return request<Session>("/v1/session");
}

export function signOut(): void {
  setToken(null);
}
