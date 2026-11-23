import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

/*
 * Utilidades compartidas por las pruebas del flujo de una ronda. Las pruebas usan los selectores
 * por rol y texto accesible de las pantallas reales. Los códigos son los de db/seed.sql.
 */

/** Código de acceso del operador de ejemplo. */
export const OPERATOR_CODE = "OPE-EJ-001";

/** Códigos de acceso de los cuatro jurados de ejemplo. */
export const JUROR_CODES = ["JUR-EJ-001", "JUR-EJ-002", "JUR-EJ-003", "JUR-EJ-004"] as const;

/** Rutas de la API consumidas por las pruebas. */
export const API = {
  jury: {
    login: "/api/jury/login",
    state: "/api/jury/state",
    draft: "/api/jury/draft",
    vote: "/api/jury/vote",
  },
  operator: {
    state: "/api/operator/state",
    action: "/api/operator/action",
    export: "/api/operator/export",
  },
  screen: "/api/screen",
  participant: {
    state: "/api/participant/state",
  },
} as const;

/** Abre la consola del operador e ingresa con el código de acceso. */
export async function signInOperator(page: Page): Promise<void> {
  await page.goto("/operator");
  await page.getByLabel("Código de acceso").fill(OPERATOR_CODE);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Controles del operador" })).toBeVisible({
    timeout: 20_000,
  });
}

/**
 * Ejecuta una acción de la lista del operador y espera a que quede marcada como hecha. Los nombres
 * corresponden a las etiquetas visibles de ActionsPanel.
 */
export async function runOperatorAction(page: Page, label: string): Promise<void> {
  await page.getByRole("button", { name: label, exact: true }).click();
  await expect(
    page
      .getByRole("listitem")
      .filter({ has: page.getByRole("button", { name: label, exact: true }) })
      .getByText("Hecho"),
  ).toBeVisible();
}

/** Lleva la ronda de ejemplo a votación: abre el mercado, declara la última llamada y cierra. */
export async function driveRoundToVoting(page: Page): Promise<void> {
  await signInOperator(page);
  await runOperatorAction(page, "Abrir mercado");
  await runOperatorAction(page, "Declarar última llamada");
  await runOperatorAction(page, "Cerrar mercado");
  await expect(currentRoundStep(page)).toContainText("En votación");
}

/** Elemento que marca el estado actual de la ronda en la línea de estados del operador. */
export function currentRoundStep(page: Page) {
  return page
    .getByRole("navigation", { name: "Estados de la ronda" })
    .locator('[aria-current="step"]');
}

/** Abre el portal del jurado e ingresa por la interfaz con su código personal. */
export async function signInJuror(page: Page, code: string): Promise<void> {
  await page.goto("/jury");
  await page.getByLabel("Código de acceso").fill(code);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("region", { name: "Estado de la ronda" })).toBeVisible({
    timeout: 20_000,
  });
}

/** Ingresa un jurado con su código mediante la ruta de la API y conserva la cookie en el contexto. */
export async function signInJurorByApi(context: BrowserContext, code: string): Promise<void> {
  const response = await context.request.post(API.jury.login, { data: { code } });
  expect(response.status(), `ingreso del jurado ${code}`).toBe(200);
}

/** Carga aceptada por el endpoint /api/jury/vote. */
export type ScoreVotePayload =
  | { abstain: true }
  | { abstain: false; notes: { criterionId: string; value: number }[] };

/** Guarda una nota en borrador mediante la API con la sesión del contexto indicado. */
export async function saveDraftByApi(
  context: BrowserContext,
  criterionId: string,
  value: number,
) {
  return context.request.post(API.jury.draft, { data: { criterionId, value } });
}

/** Envía notas por criterio o abstención mediante la API con la sesión del contexto indicado. */
export async function castScoreVoteByApi(
  context: BrowserContext,
  payload: ScoreVotePayload,
) {
  return context.request.post(API.jury.vote, { data: payload });
}

/** Lee los criterios de calificación vigentes desde el estado del jurado. */
export async function readJuryCriteriaByApi(
  context: BrowserContext,
): Promise<{ id: string }[]> {
  const state = await context.request.get(API.jury.state);
  expect(state.status()).toBe(200);
  const body = (await state.json()) as { criteria: { id: string }[] };
  return body.criteria;
}

/** Decisiones equivalentes heredadas para las pruebas de liquidación existentes. */
export type ApiDecision = "BACK" | "REJECT" | "ABSTAIN";

/** Emite un voto equivalente (5 en todo para BACK, 1 en todo para REJECT) mediante la API. */
export async function castVoteByApi(context: BrowserContext, decision: ApiDecision) {
  if (decision === "ABSTAIN") {
    return castScoreVoteByApi(context, { abstain: true });
  }
  const criteria = await readJuryCriteriaByApi(context);
  const value = decision === "BACK" ? 5 : 1;
  return castScoreVoteByApi(context, {
    abstain: false,
    notes: criteria.map((criterion) => ({ criterionId: criterion.id, value })),
  });
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
