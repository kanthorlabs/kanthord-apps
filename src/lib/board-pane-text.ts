export function healthMessageOf(components: readonly string[], failure: string | null): string {
  return failure === null
    ? `${components.join(", ")}. Operate the host.`
    : `The liveness of the daemon could not be read: ${failure}`;
}
