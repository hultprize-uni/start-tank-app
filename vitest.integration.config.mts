import { defineConfig } from "vitest/config";

// Configuración de las pruebas de integración de la capa SQL. Requiere TEST_DATABASE_URL.
export default defineConfig({
  test: {
    environment: "node",
    include: ["db/tests/**/*.itest.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
