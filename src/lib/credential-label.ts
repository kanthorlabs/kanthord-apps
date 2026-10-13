import { platformLabel } from "./credential-platforms";

export function credentialLabel(name: string, platform: string): string {
  return `${name} (${platformLabel(platform)})`;
}
