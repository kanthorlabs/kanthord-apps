const LAYER_TAG_LINE = /^<\/?prompt-layer(?:\s[^>]*)?>$/gm;

export function promptMarkdown(text: string): string {
  return text.replace(LAYER_TAG_LINE, (tag) => `\n\`${tag}\`\n`);
}
