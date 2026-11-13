export const AVATAR_TOKENS = [
  "avatar-1",
  "avatar-2",
  "avatar-3",
  "avatar-4",
  "avatar-5",
  "avatar-6",
  "avatar-7",
  "avatar-8",
] as const;

export type AvatarToken = (typeof AVATAR_TOKENS)[number];

const HASH_MULTIPLIER = 31;

export function avatarToken(agentName: string): AvatarToken {
  let hash = 0;
  for (let index = 0; index < agentName.length; index += 1) {
    hash = (Math.imul(hash, HASH_MULTIPLIER) + agentName.charCodeAt(index)) >>> 0;
  }
  const token = AVATAR_TOKENS[hash % AVATAR_TOKENS.length];
  if (token === undefined) throw new Error("The avatar palette is empty.");
  return token;
}
