import type { InstanceDraft } from "@/features/auth/instances/instance-validation";

const DEVELOPMENT_DAEMON_PORT = "31415";
const IPV4_ADDRESS = /^\d{1,3}(\.\d{1,3}){3}$/;

function isDomainName(hostname: string): boolean {
  return hostname.includes(".") && !IPV4_ADDRESS.test(hostname);
}

function developmentBaseUrl(): string {
  const { protocol, hostname } = window.location;
  const host = isDomainName(hostname) ? hostname : `${hostname}:${DEVELOPMENT_DAEMON_PORT}`;
  return `${protocol}//${host}`;
}

export function defaultBaseUrl(): string {
  return import.meta.env.PROD ? window.location.origin : developmentBaseUrl();
}

export function firstInstanceDraft(): InstanceDraft {
  return {
    name: window.location.hostname,
    baseUrl: defaultBaseUrl(),
    token: "",
  };
}

export function blankInstanceDraft(): InstanceDraft {
  return { name: "", baseUrl: defaultBaseUrl(), token: "" };
}
