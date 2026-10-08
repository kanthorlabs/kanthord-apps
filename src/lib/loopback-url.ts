const LOOPBACK_NAMES: readonly string[] = ["localhost", "[::1]"];
const IPV4_LOOPBACK_PREFIX = "127.";

export function isLoopbackUrl(baseUrl: string): boolean {
  const hostname = URL.parse(baseUrl)?.hostname;
  if (hostname === undefined) return false;
  return LOOPBACK_NAMES.includes(hostname) || hostname.startsWith(IPV4_LOOPBACK_PREFIX);
}
