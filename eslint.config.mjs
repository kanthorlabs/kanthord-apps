import { readFileSync } from "node:fs";
import { relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

import js from "@eslint/js";
import boundaries from "eslint-plugin-boundaries";
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

const element = (types, extra = {}) => ({ element: { types, ...extra } });
const file = (categories) => ({ file: { categories } });
const allow = (...types) => types.map((type) => ({ to: element(type) }));

const testFiles = ["**/*.test.{ts,tsx}", "test/**/*.ts"];
const fetchMessage = "Only src/api talks to a server. See the Architecture section of AGENTS.md.";
const shadcnSyntaxRules = [
  {
    selector: "JSXOpeningElement[name.name=/^(button|input|select|textarea|table)$/]",
    message: "Use the shadcn primitive. See the Design section of AGENTS.md.",
  },
];
const testKnowledgeMessage =
  "No test knowledge in application code. See the Architecture section of AGENTS.md.";
const testKnowledgeRules = [
  {
    selector: "MemberExpression[object.name='process'][property.name='env']",
    message: testKnowledgeMessage,
  },
  {
    selector:
      "MemberExpression[object.object.type='MetaProperty'][object.property.name='env'][property.name=/^MODE$|TEST/]",
    message: testKnowledgeMessage,
  },
  {
    selector:
      "MemberExpression[object.type='MemberExpression'][object.object.type='MetaProperty'][object.property.name='env'][property.value=/^MODE$|TEST/]",
    message: testKnowledgeMessage,
  },
  {
    selector:
      "VariableDeclarator[init.object.type='MetaProperty'][init.property.name='env'] > ObjectPattern > Property[key.name=/^MODE$|TEST/]",
    message: testKnowledgeMessage,
  },
  { selector: "Identifier[name=/^isTest/]", message: testKnowledgeMessage },
];
const reactPackages = "{react,react-dom,react-*,@base-ui/*,lucide-react,next-themes,sonner}";

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
    ignores: ["src/components/ui/**"],
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
      "sort-imports": ["error", { ignoreDeclarationSort: true, ignoreCase: true }],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}", "test/**/*.ts"],
    plugins: { boundaries },
    settings: {
      "boundaries/root-path": configDirectory,
      "import/resolver": {
        "./eslint-alias-resolver.mjs": {},
        node: { extensions: [".ts", ".tsx"] },
      },
      "boundaries/elements": [
        { type: "api", pattern: "src/api" },
        { type: "lib", pattern: "src/lib" },
        { type: "features", pattern: "src/features" },
        { type: "ui", pattern: "src/components/ui" },
        { type: "components", pattern: "src/components" },
        { type: "hooks", pattern: "src/hooks" },
        { type: "assets", pattern: "src/assets" },
        { type: "test-support", pattern: "test" },
      ],
      "boundaries/files": [
        { category: "root", pattern: "src/{App.tsx,main.tsx,vite-env.d.ts,index.css}" },
        { category: "test", pattern: testFiles },
        {
          category: "feature-entry",
          pattern: "src/{App,components/app-router,components/app-shell}{,.test}.tsx",
        },
      ],
    },
    rules: {
      "boundaries/no-unknown-files": "error",
      "boundaries/no-unknown-dependencies": "error",
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          checkInternals: true,
          checkAllOrigins: true,
          policies: [
            { allow: [{ dependency: { relationship: { to: "internal" } } }] },
            { allow: [{ to: { module: { origin: "{external,core}" } } }] },
            { from: element("api"), allow: allow("lib") },
            {
              from: element("lib"),
              allow: [
                { to: element("lib") },
                { to: element("api", { fileInternalPath: "types.ts" }) },
              ],
            },
            {
              from: element({ anyOf: ["features", "components", "hooks", "ui"] }),
              allow: allow("api", "lib", "components", "hooks", "ui", "assets"),
            },
            {
              from: file("root"),
              allow: [
                ...allow("api", "lib", "components", "hooks", "ui", "assets"),
                { to: file("root") },
              ],
            },
            { from: element("features"), allow: allow("features") },
            { from: file("feature-entry"), allow: allow("features") },
            { from: file("test"), allow: allow("test-support") },
            {
              from: element("lib"),
              disallow: [
                { to: { module: { origin: "core" } } },
                { to: { module: { source: reactPackages } } },
              ],
            },
            { disallow: [{ to: { module: { source: "@/**" } } }] },
          ],
        },
      ],
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/api/**"],
    rules: {
      "no-restricted-globals": ["error", { name: "fetch", message: fetchMessage }],
      "no-restricted-properties": [
        "error",
        ...["window", "globalThis", "self"].map((object) => ({
          object,
          property: "fetch",
          message: fetchMessage,
        })),
      ],
    },
  },
  {
    rules: {
      "no-else-return": "error",
      "object-shorthand": "error",
      "no-lonely-if": "error",
      "prefer-object-spread": "error",
      "no-throw-literal": "error",
      "no-useless-rename": "error",
      "@typescript-eslint/consistent-indexed-object-style": "error",
    },
  },
  {
    ignores: ["src/components/ui/**"],
    rules: {
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-param-reassign": "error",
      "@typescript-eslint/no-import-type-side-effects": "error",
    },
  },
  {
    ignores: testFiles,
    rules: {
      "@typescript-eslint/no-non-null-assertion": "error",
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
      "sort-imports": "off",
    },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/components/ui/**", ...testFiles],
    rules: {
      "no-restricted-syntax": ["error", ...testKnowledgeRules],
    },
  },
  {
    files: ["src/**/*.tsx"],
    ignores: ["src/components/ui/**", ...testFiles],
    rules: {
      "no-restricted-syntax": ["error", ...shadcnSyntaxRules, ...testKnowledgeRules],
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
