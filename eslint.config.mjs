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
    // Static HTML/CSS/JS design prototype (references/templates/) — no
    // build step, plain React-via-CDN JSX, not part of the Next.js app.
    // It's a design reference to port from, not code to lint. See
    // CLAUDE.md ("Design reference: references/templates/").
    "references/templates/**",
  ]),
]);

export default eslintConfig;
