import { readFileSync } from "node:fs";
import { relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const configDirectory = fileURLToPath(new URL(".", import.meta.url));
const allowedComments = JSON.parse(
  readFileSync(new URL("./.kanthord/comments.json", import.meta.url), "utf8"),
);

const repositoryPath = (filename) => relative(configDirectory, filename).split(sep).join("/");
const isTripleSlashReference = (comment) =>
  comment.type === "Line" && comment.value.startsWith("/ <reference ");
const isAllowedComment = (path, text) =>
  allowedComments.some((entry) => entry.path === path && entry.text === text);

const noComments = {
  meta: {
    type: "problem",
    schema: [],
    messages: {
      comment: "Remove the comment. Only a human adds a comment, through .kanthord/comments.json.",
    },
  },
  create: (context) => ({
    Program: () => {
      const path = repositoryPath(context.filename);
      for (const comment of context.sourceCode.getAllComments()) {
        if (comment.type === "Shebang" || isTripleSlashReference(comment)) continue;
        if (isAllowedComment(path, context.sourceCode.getText(comment))) continue;
        context.report({ loc: comment.loc, messageId: "comment" });
      }
    },
  }),
};

const kanthordPlugin = { rules: { "no-comments": noComments } };

const inlineConfigPattern = /^\/[/*]\s*(eslint|global|exported)\b/;
const pathsWithAllowedInlineConfig = allowedComments
  .filter((entry) => inlineConfigPattern.test(entry.text))
  .map((entry) => entry.path);

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/dist/**"],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    ignores: ["src/components/ui/**"],
    plugins: { kanthord: kanthordPlugin },
    rules: {
      "kanthord/no-comments": "error",
    },
  },
  {
    ignores: ["src/components/ui/**", ...pathsWithAllowedInlineConfig],
    linterOptions: { noInlineConfig: true },
  },
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "jsx-a11y": jsxA11y,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["src/hooks/use-mobile.ts"],
    rules: {
      "react-hooks/set-state-in-effect": "off",
    },
  },
  {
    files: ["src/components/ui/**/*.tsx"],
    rules: {
      "jsx-a11y/click-events-have-key-events": "off",
      "jsx-a11y/no-noninteractive-element-interactions": "off",
      "jsx-a11y/label-has-associated-control": "off",
    },
  },
  {
    files: ["src/features/**/*.tsx", "src/components/*.tsx"],
    ignores: ["**/*.test.tsx"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXOpeningElement[name.name=/^(button|input|select|textarea|table)$/]",
          message: "Use the shadcn primitive. See the Design section of AGENTS.md.",
        },
      ],
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["radix-ui", "@radix-ui/*"],
              message: "Use the shadcn base-vega primitive. See the Design section of AGENTS.md.",
            },
          ],
          paths: [
            {
              name: "@/components/ui/table",
              message: "Render a collection as an Item list. See the Design section of AGENTS.md.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.test.{ts,tsx}", "test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["**/*.{mjs,js}"],
    languageOptions: {
      globals: globals.node,
    },
  },
);
