import { expect, test } from "@playwright/test";
import { resetDatabase } from "./setup-db";
import { currentRoundStep, runOperatorAction, signInOperator } from "./support/round-flow";

test.describe("consola del operador", () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test("opens the market, calls the last call, closes and enables voting", async ({ page }) => {
    await signInOperator(page);

    await runOperatorAction(page, "Abrir mercado");
    await expect(currentRoundStep(page)).toContainText("Abierta");

    await runOperatorAction(page, "Última llamada");
    await expect(currentRoundStep(page)).toContainText("Última llamada");

    // Cerrar el mercado envía también la habilitación de la votación.
    await runOperatorAction(page, "Cerrar mercado");
    await expect(currentRoundStep(page)).toContainText("En votación");
    await expect(page.getByText("Habilitar votación", { exact: true })).toBeVisible();
  });

  test("keeps the reveal action locked until the four jurors vote", async ({ page }) => {
    await signInOperator(page);
    await runOperatorAction(page, "Abrir mercado");
    await runOperatorAction(page, "Última llamada");
    await runOperatorAction(page, "Cerrar mercado");

    const reveal = page.getByRole("button", { name: "Revelar veredicto", exact: true });
    await expect(reveal).toBeDisabled();
    await expect(page.getByText("Faltan 4 voto(s)", { exact: true })).toBeVisible();
  });
});
