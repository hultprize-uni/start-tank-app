import { expect, test } from "@playwright/test";
import pg from "pg";
import { DIRECT_DATABASE_URL, resetDatabase } from "./setup-db";
import {
  JUROR_CODES,
  castVoteByApi,
  currentRoundStep,
  driveRoundToVoting,
  runOperatorAction,
  signInJurorByApi,
  signInOperator,
} from "./support/round-flow";

/*
 * Tarea 9.5: pausa, rescate con los presentes, anulación, ajuste de saldo y permisos por rol
 * (RF-05, RF-07, RF-10, RF-11, RF-18).
 */

/** Crea una asistente con saldo 7,000 IC, como si hubiera ingresado con Google. */
async function insertAttendee(): Promise<void> {
  const client = new pg.Client({ connectionString: DIRECT_DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `insert into usuario (proveedor_oauth, id_externo, correo, nombre, saldo_actual, ultima_conexion)
       values ('google', 'e2e-juanita', 'juanita@uni.pe', 'Juanita P.', 7000, now())`,
    );
  } finally {
    await client.end();
  }
}

test.describe("pausa, rescate y correcciones", () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test("pauses and resumes the phase keeping the remaining time (RF-07)", async ({ page }) => {
    await signInOperator(page);
    await runOperatorAction(page, "Abrir mercado");

    await page.getByRole("button", { name: "Pausa", exact: true }).click();
    const timer = page.getByRole("timer");
    await expect(page.getByText(/· En pausa/)).toBeVisible();
    const frozen = await timer.textContent();
    await page.waitForTimeout(2_500);
    await expect(timer).toHaveText(frozen ?? "");

    await page.getByRole("button", { name: "Reanudar", exact: true }).click();
    await expect(page.getByText(/· En pausa/)).toHaveCount(0);

    await page.getByRole("button", { name: "+1 min", exact: true }).click();
    await page.getByRole("button", { name: "Log de acciones", exact: true }).click();
    await expect(page.getByRole("row").filter({ hasText: "Pausó la fase" })).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: "Sumó 1 minuto" })).toBeVisible();
  });

  test("reveals with the present jurors after confirmation and reason (RF-18)", async ({
    browser,
    page,
  }) => {
    const baseURL = test.info().project.use.baseURL;
    await driveRoundToVoting(page);

    // Envían tres de los cuatro jurados.
    for (const code of JUROR_CODES.slice(0, 3)) {
      const context = await browser.newContext({ baseURL });
      try {
        await signInJurorByApi(context, code);
        expect((await castVoteByApi(context, "BACK")).status()).toBe(200);
      } finally {
        await context.close();
      }
    }

    await expect(page.getByText("Falta 1 jurado por enviar", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Revelar con presentes…" }).click();
    const dialog = page.getByRole("dialog", { name: "¿Revelar con 3 de 4 jurados?" });
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Revelar con 3 jurados" }).click();
    await expect(dialog.getByText("Escribe el motivo para continuar.")).toBeVisible();

    await dialog.getByLabel("Motivo (queda en el log)").fill("El jurado 4 perdió la conexión");
    await dialog.getByRole("button", { name: "Revelar con 3 jurados" }).click();
    await expect(dialog).toBeHidden();

    // La consola pasa a la ronda 2, programada.
    await expect(page.getByRole("button", { name: "Abrir mercado", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Log de acciones", exact: true }).click();
    await expect(
      page.getByRole("row").filter({ hasText: "El jurado 4 perdió la conexión" }),
    ).toContainText("Reveló con los jurados presentes");
  });

  test("cancels the round with a reason (RF-10)", async ({ page }) => {
    await signInOperator(page);
    await runOperatorAction(page, "Abrir mercado");
    await expect(currentRoundStep(page)).toContainText("Última llamada");

    await page.getByRole("button", { name: "Anular ronda…" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: /Devolver lo invertido/ }).click();
    await dialog.getByRole("button", { name: "Anular ronda", exact: true }).click();
    await expect(dialog.getByText("Escribe el motivo para continuar.")).toBeVisible();

    await dialog.getByLabel("Motivo (queda en el log)").fill("Falla del proyector");
    await dialog.getByRole("button", { name: "Anular ronda", exact: true }).click();
    await expect(page.getByRole("button", { name: "Abrir mercado", exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Log de acciones", exact: true }).click();
    await expect(page.getByRole("row").filter({ hasText: "Falla del proyector" })).toContainText(
      "Anuló la ronda y devolvió lo invertido",
    );
  });

  test("adjusts a balance with a mandatory reason (RF-11)", async ({ page }) => {
    await insertAttendee();
    await signInOperator(page);

    await page.getByRole("button", { name: "Asistentes", exact: true }).click();
    await page.getByLabel("Buscar por nombre o correo").fill("Juanita");
    await expect(page.getByRole("heading", { name: "Juanita P." })).toBeVisible();

    await page.getByRole("button", { name: "Ajustar saldo…" }).click();
    const dialog = page.getByRole("dialog", { name: "Ajustar el saldo de Juanita P." });
    await dialog.getByLabel("Monto (IC)").fill("500");
    await dialog.getByLabel("Motivo (queda en el log)").fill("Error del sistema");
    await dialog.getByRole("button", { name: "Confirmar ajuste" }).click();

    await expect(page.getByText("Saldo de Juanita P. actualizado a 7,500 IC.")).toBeVisible();
    await page.getByRole("button", { name: "Log de acciones", exact: true }).click();
    await expect(page.getByRole("row").filter({ hasText: "Error del sistema" })).toContainText(
      "Ajustó un saldo",
    );
  });
});
