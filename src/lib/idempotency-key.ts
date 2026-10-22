import { newUlid } from "./ulid";

const IDEMPOTENCY_KEY_PREFIX = "idempotency_key";

export function newIdempotencyKey(): string {
  return `${IDEMPOTENCY_KEY_PREFIX}_${newUlid()}`;
}
