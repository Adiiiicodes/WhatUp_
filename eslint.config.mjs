import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

// Relax some rules for faster local iteration (ignore unused vars warnings)
eslintConfig.push({
  rules: {
    '@typescript-eslint/no-unused-vars': 'off',
    'no-unused-vars': 'off'
  }
});

// Disable some image/accessibility rules that are non-blocking for this project
eslintConfig.push({
  rules: {
    'jsx-a11y/alt-text': 'off',
    '@next/next/no-img-element': 'off'
  }
});

export default eslintConfig;
