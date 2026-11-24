import { expect, test } from "@playwright/test";
import { resetDatabase } from "./setup-db";
import {
  castJurorVotesByApi,
  currentRoundStep,
  driveRoundToVoting,
  runOperatorAction,
  type ApiDecision,
} from "./support/round-flow";

test.describe("liquidacion de la ronda", () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test("operator reveals the verdict and the screen shows the 1.4x multiplier", async ({
    browser,
    page,
  }) => {
    const baseURL = test.info().project.use.baseURL;
    // Tres jurados con 5 y uno con 1: puntaje 4, multiplicador 0.2 + 1.6 x (4 - 1) / 4 = 1.4.
    const decisions: ApiDecision[] = ["BACK", "BACK", "BACK", "REJECT"];

    await driveRoundToVoting(page);
    await castJurorVotesByApi(browser, baseURL, decisions);

    // Al revelar, la consola pasa a la siguiente ronda; la liquidación se verifica en la pantalla pública.
    await page.getByRole("button", { name: "Revelar veredicto", exact: true }).click();

    const screenContext = await browser.newContext({ baseURL });
    try {
      const screen = await screenContext.newPage();
      await screen.goto("/screen");
      await expect(screen.getByRole("region", { name: "Veredicto de la ronda" })).toBeVisible({
        timeout: 15_000,
      });
      await expect(screen.getByText("1.4x", { exact: true })).toBeVisible();
    } finally {
      await screenContext.close();
    }
  });
});
