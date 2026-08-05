import { execSync } from "node:child_process";

function dartCommand() {
  try {
    execSync("command -v fvm", { stdio: "ignore", shell: "/bin/sh" });
    return "fvm dart";
  } catch {
    return "dart";
  }
}

export default {
  "*.dart": `${dartCommand()} format`,
  "*.{json,yml,yaml,md,mjs,js}": "prettier --write",
};
