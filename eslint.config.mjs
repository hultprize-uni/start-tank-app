import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/*
 * Reglas de dependencia entre módulos (ver docs/architecture.md):
 * app -> features -> shared y server. Cada funcionalidad expone solo su index.ts y sus tipos.
 */

/** Fuera de las funcionalidades: solo se admite el index.ts y los tipos de cada funcionalidad. */
const featureDeepImports = {
  group: ["@/features/*/*", "!@/features/*/types"],
  message:
    "Importar desde el index.ts de la funcionalidad (@/features/<nombre>) o desde sus tipos (@/features/<nombre>/types).",
};

/** Dentro de las funcionalidades: no depender de otra funcionalidad, salvo por sus tipos. */
const crossFeatureImports = {
  group: ["@/features/*", "@/features/*/*", "!@/features/*/types"],
  message:
    "Las funcionalidades no dependen entre sí, salvo por sus tipos (@/features/<nombre>/types). Mover el código común a src/shared o src/server.",
};

/** Capas compartidas: no dependen de las funcionalidades. */
const sharedLayerImports = {
  group: ["@/features", "@/features/*", "@/features/*/*"],
  message: "Las capas src/shared y src/server no dependen de las funcionalidades.",
};

const appImports = {
  group: ["@/app", "@/app/*"],
  message: "Las rutas de src/app no se importan desde otras capas.",
};

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/features/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [featureDeepImports] }],
    },
  },
  {
    files: ["src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [crossFeatureImports, appImports] }],
    },
  },
  {
    files: ["src/shared/**/*.{ts,tsx}", "src/server/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [sharedLayerImports, appImports] }],
    },
  },
];

export default eslintConfig;
