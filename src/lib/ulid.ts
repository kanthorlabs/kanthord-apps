const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const TIME_LENGTH = 10;
const RANDOM_LENGTH = 16;

function encodeTime(ms: number): string {
  let rest = ms;
  let out = "";
  for (let i = 0; i < TIME_LENGTH; i += 1) {
    out = ALPHABET.charAt(rest % 32) + out;
    rest = Math.floor(rest / 32);
  }
  return out;
}

function encodeRandom(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += ALPHABET.charAt(byte % 32);
  return out;
}

export function newUlid(now: number = Date.now()): string {
  const random = crypto.getRandomValues(new Uint8Array(RANDOM_LENGTH));
  return encodeTime(now) + encodeRandom(random);
}
