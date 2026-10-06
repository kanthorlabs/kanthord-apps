import { jsonTokens, type JsonTokenKind } from "@/lib/json-tokens";

const TOKEN_CLASS: Readonly<Record<JsonTokenKind, string | undefined>> = {
  key: "text-syntax-key",
  string: "text-syntax-string",
  number: "text-syntax-number",
  literal: "text-syntax-literal",
  plain: undefined,
};

export function ToolDetail({ detail }: { detail: string }) {
  const tokens = jsonTokens(detail);
  return (
    <pre className="max-h-64 overflow-auto px-3 pb-3 font-mono text-xs break-words whitespace-pre-wrap">
      {tokens === null
        ? detail
        : tokens.map((token, index) => (
            <span key={index} className={TOKEN_CLASS[token.kind]}>
              {token.text}
            </span>
          ))}
    </pre>
  );
}
