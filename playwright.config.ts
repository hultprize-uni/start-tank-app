import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

/*
 * Configuración de las pruebas end-to-end del flujo de una ronda. Las pruebas usan una base
 * Postgres local con el proxy HTTP de Neon (ver docs/testing.md), de modo que no requieren Neon.
 * Las variables de conexión se toman del entorno y tienen valores por omisión del compose local.
 */

const APP_PORT = 3200;
const BASE_URL = `http://localhost:${APP_PORT}`;
const DB_PORT = process.env.E2E_DB_PORT ?? "55433";
const PROXY_PORT = process.env.E2E_PROXY_PORT ?? "55434";

/** Conexión directa a Postgres para las pruebas, que restablecen las tablas de negocio. */
process.env.E2E_DATABASE_URL ??= `postgres://postgres:postgres@localhost:${DB_PORT}/startank`;

/** Conexión de la aplicación. El host db.localtest.me identifica el endpoint del proxy de Neon. */
const APP_DATABASE_URL = `postgres://postgres:postgres@db.localtest.me:${DB_PORT}/startank`;

/** Valores ficticios para las variables de Neon Auth y de sesión. Solo sirven en el entorno de pruebas. */
const TEST_SESSION_SECRET = "e2e-session-secret-0123456789abcdef";
const TEST_NEON_AUTH_COOKIE_SECRET = "e2e-neon-auth-cookie-secret-0123456789";

/** Con E2E_SKIP_BUILD=1 se reutiliza el build existente; de lo contrario, se compila antes de iniciar. */
const SKIP_BUILD = process.env.E2E_SKIP_BUILD === "1" && existsSync(".next/BUILD_ID");
const START_COMMAND = `pnpm start -p ${APP_PORT}`;

export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false,
  // Las pruebas comparten una sola base de datos: se ejecutan en serie.
  workers: 1,
  // El proxy local añade latencia a cada consulta; un flujo completo de ronda supera 30 segundos.
  timeout: 90_000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never" }]]
    : [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: SKIP_BUILD ? START_COMMAND : `pnpm build && ${START_COMMAND}`,
    url: `${BASE_URL}/screen`,
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      ...process.env,
      NEXT_TELEMETRY_DISABLED: "1",
      DATABASE_URL: APP_DATABASE_URL,
      NEON_LOCAL_PROXY_URL: `http://localhost:${PROXY_PORT}`,
      SESSION_SECRET: TEST_SESSION_SECRET,
      NEON_AUTH_BASE_URL: "https://e2e-auth.example.test/auth",
      NEON_AUTH_COOKIE_SECRET: TEST_NEON_AUTH_COOKIE_SECRET,
    },
  },
});
