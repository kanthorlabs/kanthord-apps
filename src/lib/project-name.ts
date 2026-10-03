const PROJECT_NAME = /^[a-z][a-z0-9-]*$/;
const MAX_LENGTH = 63;

export function projectNameError(name: string): string | null {
  if (name.length === 0) return "Enter a name.";
  if (name.length > MAX_LENGTH) return `Use at most ${MAX_LENGTH} characters.`;
  if (!PROJECT_NAME.test(name)) {
    return "Start with a lowercase letter. Use only lowercase letters, digits and hyphens.";
  }
  return null;
}
