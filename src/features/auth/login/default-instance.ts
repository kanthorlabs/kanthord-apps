import type { InstanceDraft } from "@/features/auth/instances/instance-validation";

const DEVELOPMENT_BASE_URL = "http://localhost:31415";
const DEVELOPMENT_NAME = "localhost";

export function defaultBaseUrl(): string {
  return import.meta.env.PROD ? window.location.origin : DEVELOPMENT_BASE_URL;
}

export function firstInstanceDraft(): InstanceDraft {
  return {
    name: import.meta.env.PROD ? window.location.hostname : DEVELOPMENT_NAME,
    baseUrl: defaultBaseUrl(),
    token: "",
  };
}

export function blankInstanceDraft(): InstanceDraft {
  return { name: "", baseUrl: defaultBaseUrl(), token: "" };
}
