import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

/*
 * Utilidades compartidas por las pruebas del flujo de una ronda. Las pruebas usan los selectores
 * por rol y texto accesible de las pantallas reales. Los códigos son los de db/seed.sql.
 */

/** Código de acceso del conductor de ejemplo. */
export const OPERATOR_CODE = "OPE-EJ-001";

/** Código de acceso del operador de soporte de ejemplo (solo lectura). */
export const SUPPORT_CODE = "OPE-EJ-002";

/** Códigos de acceso de los cuatro jurados de ejemplo. */
export const JUROR_CODES = ["JUR-EJ-001", "JUR-EJ-002", "JUR-EJ-003", "JUR-EJ-004"] as const;

/** Rutas de la API consumidas por las pruebas. */
export const API = {
  jury: {
    login: "/api/jury/login",
    state: "/api/jury/state",
    vote: "/api/jury/vote",
  },
  operator: {
    login: "/api/operator/login",
    state: "/api/operator/state",
    action: "/api/operator/action",
    export: "/api/operator/export",
    balance: "/api/operator/balance",
    config: "/api/operator/config",
    manualMode: "/api/operator/manual-mode",
    attendees: "/api/operator/attendees",
  },
  screen: "/api/screen",
  participant: {
    state: "/api/participant/state",
  },
} as const;

/** Abre la consola del operador e ingresa con el código de acceso (por defecto, el conductor). */
export async function signInOperator(page: Page, code: string = OPERATOR_CODE): Promise<void> {
  await page.goto("/operator");
  await page.getByLabel("Código de acceso").fill(code);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Controles del operador" })).toBeVisible({
    timeout: 20_000,
  });
}

/**
 * Ejecuta el paso de la ronda con el botón principal y espera a que la consola pase al siguiente:
 * el botón principal muestra solo el paso válido (RF-06), así que el pulsado desaparece.
 */
export async function runOperatorAction(page: Page, label: string): Promise<void> {
  const button = page.getByRole("button", { name: label, exact: true });
  await button.click();
  await expect(button).toBeHidden({ timeout: 10_000 });
}

/** Lleva la ronda de ejemplo a votación: abre, anuncia la última llamada, cierra y habilita el voto. */
export async function driveRoundToVoting(page: Page): Promise<void> {
  await signInOperator(page);
  await runOperatorAction(page, "Abrir mercado");
  await runOperatorAction(page, "Anunciar última llamada");
  await runOperatorAction(page, "Cerrar mercado");
  await runOperatorAction(page, "Habilitar votación");
  await expect(currentRoundStep(page)).toContainText("Revelar");
}

/** Paso actual de la ronda en la línea de pasos de la consola. */
export function currentRoundStep(page: Page) {
  return page
    .getByRole("navigation", { name: "Pasos de la ronda" })
    .locator('[aria-current="step"]');
}

/**
 * Ingresa un jurado con su código mediante la ruta de la API que usa el formulario de /jury. El
 * formulario de la pantalla del jurado acepta solo cuatro dígitos y los códigos de db/seed.sql no
 * los cumplen, por lo que las pruebas no pueden ingresar por la interfaz. La cookie de sesión queda
 * en el contexto del navegador.
 */
export async function signInJurorByApi(context: BrowserContext, code: string): Promise<void> {
  const response = await context.request.post(API.jury.login, { data: { code } });
  expect(response.status(), `ingreso del jurado ${code}`).toBe(200);
}

/** Decisiones de la API para el voto del jurado. */
export type ApiDecision = "BACK" | "REJECT" | "ABSTAIN";

/** Emite un voto mediante la API con la sesión del contexto indicado. */
export async function castVoteByApi(context: BrowserContext, decision: ApiDecision) {
  return context.request.post(API.jury.vote, { data: { decision } });
}

/** Emite un voto por cada decisión, cada uno desde un contexto de navegador separado. */
export async function castJurorVotesByApi(
  browser: Browser,
  baseURL: string | undefined,
  decisions: readonly ApiDecision[],
): Promise<void> {
  for (const [index, decision] of decisions.entries()) {
    const context = await browser.newContext({ baseURL });
    try {
      await signInJurorByApi(context, JUROR_CODES[index]);
      const response = await castVoteByApi(context, decision);
      expect(response.status(), `voto del jurado ${JUROR_CODES[index]}`).toBe(200);
    } finally {
      await context.close();
    }
  }
}
