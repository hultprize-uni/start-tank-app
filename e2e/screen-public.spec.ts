import { expect, test } from "@playwright/test";
import { resetDatabase } from "./setup-db";
import { API } from "./support/round-flow";

test.describe("pantalla publica", () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test("responds without authentication and shows the waiting phase", async ({ page, request }) => {
    // La solicitud de API y la página se hacen sin cookies de sesión: la pantalla es pública.
    const response = await request.get(API.screen);
    expect(response.status()).toBe(200);
    expect(((await response.json()) as { phase: string }).phase).toBe("BETWEEN_ROUNDS");

    await page.goto("/screen");
    await expect(page.getByText("Entre rondas", { exact: true })).toBeVisible();
    await expect(page.getByText("Clasificación", { exact: true })).toBeVisible();
  });
});
