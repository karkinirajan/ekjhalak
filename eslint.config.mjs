import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Scratch directories belonging to local tooling, not to this project.
    // They are untracked, so a CI runner never sees them and a clean checkout
    // lints differently from a working copy — which is the same local/CI drift
    // that the lockfile note in .github/workflows/ci.yml describes. ESLint does
    // not read nested .gitignore files, so it has to be told here.
    ".remember/**",
    ".playwright-mcp/**",
  ]),
]);

export default eslintConfig;
