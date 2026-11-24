import { expect, test } from "@playwright/test";
import { resetDatabase } from "./setup-db";
import {
  API,
  JUROR_CODES,
  castScoreVoteByApi,
  castVoteByApi,
  currentRoundStep,
  driveRoundToVoting,
  readJuryCriteriaByApi,
  runOperatorAction,
  signInJuror,
  signInJurorByApi,
  signInOperator,
} from "./support/round-flow";

const CRITERION_SCORES = [
  { group: "Puntaje para Problema y mercado", value: 4 },
  { group: "Puntaje para Modelo de negocio", value: 3 },
  { group: "Puntaje para Impacto ODS", value: 5 },
  { group: "Puntaje para Equipo y pitch", value: 4 },
] as const;

test.describe("votacion del jurado", () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test("laptop: recovers draft on reload, locks send until voting, and rejects duplicate submission", async ({
    browser,
    page,
  }) => {
    const baseURL = test.info().project.use.baseURL;

    await signInOperator(page);
    await runOperatorAction(page, "Abrir mercado");
    await expect(currentRoundStep(page)).toContainText("Abierta");

    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1280, height: 800 },
    });
    try {
      const jurorPage = await context.newPage();

      await jurorPage.goto("/jury");
      await jurorPage.getByLabel("Código de acceso").fill("CODIGO-INVALIDO");
      await jurorPage.getByRole("button", { name: "Entrar", exact: true }).click();
      // Next.js agrega su propio anunciador de rutas con role="alert"; se filtra por el texto.
      await expect(
        jurorPage.getByRole("alert").filter({ hasText: "Ese código no existe" }),
      ).toBeVisible();

      await signInJuror(jurorPage, JUROR_CODES[0]);

      const sendButton = jurorPage.getByRole("button", { name: "Enviar notas", exact: true });
      await expect(sendButton).toBeDisabled();

      for (const item of CRITERION_SCORES) {
        // El radio está oculto visualmente: se hace clic en su etiqueta, que es lo que ve la persona.
        await jurorPage
          .getByRole("radiogroup", { name: item.group })
          .locator("label", { hasText: new RegExp(`^${item.value} `) })
          .click();
      }
      await expect(jurorPage.getByRole("status")).toHaveText("Borrador guardado");

      await jurorPage.reload();
      await expect(
        jurorPage.getByRole("radiogroup", { name: CRITERION_SCORES[0].group }),
      ).toBeVisible();
      for (const item of CRITERION_SCORES) {
        await expect(
          jurorPage
            .getByRole("radiogroup", { name: item.group })
            .getByRole("radio", { name: new RegExp(`^${item.value} `) }),
        ).toBeChecked();
      }

      await runOperatorAction(page, "Declarar última llamada");
      await runOperatorAction(page, "Cerrar mercado");
      await expect(currentRoundStep(page)).toContainText("En votación");

      await expect(sendButton).toBeEnabled({ timeout: 10_000 });
      await sendButton.click();

      const dialog = jurorPage.getByRole("dialog", { name: "¿Confirmas el envío de tus notas?" });
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: "Confirmar envío", exact: true }).click();

      await expect(jurorPage.getByText("Notas enviadas", { exact: true })).toBeVisible();
      await expect(jurorPage.getByRole("heading", { name: "Puntaje: 4.0 / 5" })).toBeVisible();

      const second = await castVoteByApi(context, "BACK");
      expect(second.status()).toBe(409);
      expect(((await second.json()) as { error: string }).error).toBe("DUPLICATE_VOTE");

      const state = await context.request.get(API.jury.state);
      expect(state.status()).toBe(200);
      expect(((await state.json()) as { reveal: unknown }).reveal).toBeNull();
    } finally {
      await context.close();
    }
  });

  test("phone: supports conflict-of-interest abstention and shows revealed verdict", async ({
    browser,
    page,
  }) => {
    const baseURL = test.info().project.use.baseURL;

    await driveRoundToVoting(page);

    const phoneContext = await browser.newContext({
      baseURL,
      viewport: { width: 390, height: 844 },
    });
    try {
      const jurorPage = await phoneContext.newPage();
      await signInJuror(jurorPage, JUROR_CODES[1]);

      await jurorPage.getByRole("button", { name: "Declarar conflicto de interés", exact: true }).click();
      const dialog = jurorPage.getByRole("dialog", { name: "Declarar conflicto de interés" });
      const confirmAbstain = dialog.getByRole("button", { name: "Confirmar abstención", exact: true });
      await expect(confirmAbstain).toBeDisabled();

      // El radio está oculto visualmente y su texto lo cubre: se hace clic en el texto, como el usuario.
      await dialog.getByText("Vínculo familiar o personal con el equipo", { exact: true }).click();
      await expect(confirmAbstain).toBeEnabled();
      await confirmAbstain.click();

      await expect(jurorPage.getByText("Abstención registrada", { exact: true })).toBeVisible();

      for (const code of [JUROR_CODES[0], JUROR_CODES[2], JUROR_CODES[3]]) {
        const other = await browser.newContext({ baseURL });
        try {
          await signInJurorByApi(other, code);
          const criteria = await readJuryCriteriaByApi(other);
          const response = await castScoreVoteByApi(other, {
            abstain: false,
            notes: criteria.map((criterion) => ({ criterionId: criterion.id, value: 4 })),
          });
          expect(response.status()).toBe(200);
        } finally {
          await other.close();
        }
      }

      const revealButton = page.getByRole("button", { name: "Revelar veredicto", exact: true });
      await expect(revealButton).toBeEnabled({ timeout: 10_000 });
      await revealButton.click();

      await expect(jurorPage.getByText("1.4x", { exact: true })).toBeVisible({ timeout: 10_000 });
      await expect(jurorPage.getByText("4.0 / 5", { exact: true }).first()).toBeVisible();
      // El panel lateral de escritorio también dice "Se abstuvo" pero está oculto en el teléfono.
      await expect(
        jurorPage.getByText("Se abstuvo", { exact: true }).filter({ visible: true }).first(),
      ).toBeVisible();
    } finally {
      await phoneContext.close();
    }
  });
});
