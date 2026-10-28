export default {
  "*.{ts,tsx,js,mjs}": ["eslint --fix --max-warnings 0", "prettier --write"],
  "*.{json,yml,yaml,md,css,html}": "prettier --write",
};
