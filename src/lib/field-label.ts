const ACRONYMS: Readonly<Record<string, string>> = { api: "API", id: "ID", ssh: "SSH", url: "URL" };

function wordLabel(word: string): string {
  const lower = word.toLowerCase();
  return ACRONYMS[lower] ?? lower.charAt(0).toUpperCase() + lower.slice(1);
}

export function fieldLabel(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_]+/)
    .filter((word) => word.length > 0)
    .map(wordLabel)
    .join(" ");
}
