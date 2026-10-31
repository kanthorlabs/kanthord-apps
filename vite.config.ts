import { fileURLToPath } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

const domTests = [
  "src/**/use-*.test.ts",
  "src/components/base-path.test.ts",
  "src/features/auth/instances/instance-storage.test.ts",
  "src/features/auth/login/default-instance.test.ts",
];

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 27182,
  },
  test: {
    globals: false,
    projects: [
      {
        extends: true,
        test: {
          name: "node",
          environment: "node",
          include: ["src/**/*.test.ts", "scripts/**/*.test.mjs"],
          exclude: [...configDefaults.exclude, ...domTests],
        },
      },
      {
        extends: true,
        test: {
          name: "jsdom",
          environment: "jsdom",
          include: ["src/**/*.test.tsx", ...domTests],
          setupFiles: ["./test/setup.ts"],
        },
      },
    ],
  },
});
