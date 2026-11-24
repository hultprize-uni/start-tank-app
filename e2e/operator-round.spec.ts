import { expect, test } from "@playwright/test";
import { resetDatabase } from "./setup-db";
import { currentRoundStep, runOperatorAction, signInOperator } from "./support/round-flow";

test.describe("consola del operador", () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test("shows only the valid step and walks the round to voting (RF-06)", async ({ page }) => {
    await signInOperator(page);

    // Con la ronda 1 programada solo aparece Abrir mercado.
    await expect(page.getByRole("button", { name: "Abrir mercado", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Revelar veredicto", exact: true })).toHaveCount(0);

    await runOperatorAction(page, "Abrir mercado");
    await expect(currentRoundStep(page)).toContainText("Última llamada");

    await runOperatorAction(page, "Anunciar última llamada");
    await expect(currentRoundStep(page)).toContainText("Cerrar");
    await expect(page.getByText("Se cierra sola al llegar a 0:00.")).toBeVisible();

    await runOperatorAction(page, "Cerrar mercado");
    await runOperatorAction(page, "Habilitar votación");
    await expect(currentRoundStep(page)).toContainText("Revelar");
  });

  test("keeps the reveal action locked until the four jurors send (RF-18)", async ({ page }) => {
    await signInOperator(page);
    await runOperatorAction(page, "Abrir mercado");
    await runOperatorAction(page, "Anunciar última llamada");
    await runOperatorAction(page, "Cerrar mercado");
    await runOperatorAction(page, "Habilitar votación");

    const reveal = page.getByRole("button", { name: "Revelar veredicto", exact: true });
    await expect(reveal).toBeDisabled();
    await expect(page.getByText("Faltan 4 jurados por enviar", { exact: true })).toBeVisible();
  });

  test("logs each action with the operator name (RF-09)", async ({ page }) => {
    await signInOperator(page);
    await runOperatorAction(page, "Abrir mercado");

    await page.getByRole("button", { name: "Log de acciones", exact: true }).click();
    const row = page.getByRole("row").filter({ hasText: "Abrió el mercado" });
    await expect(row).toContainText("Conductor de ejemplo");
  });
});
