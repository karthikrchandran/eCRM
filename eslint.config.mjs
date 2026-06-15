import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTypescript,
  {
    settings: {
      react: {
        // ESLint 10 / Next lint compatibility shim; "detect" crashes in eslint-plugin-react's version resolver.
        version: "19.2.7"
      }
    }
  },
  {
    ignores: [".next/**", "node_modules/**", "coverage/**", "playwright-report/**"]
  }
];

export default eslintConfig;
