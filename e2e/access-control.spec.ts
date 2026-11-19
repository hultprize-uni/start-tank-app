import { expect, test } from "@playwright/test";
import { resetDatabase } from "./setup-db";
import { API, JUROR_CODES, signInJurorByApi } from "./support/round-flow";

test.describe("control de acceso por rol", () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test("a juror session cannot run operator actions", async ({ browser }) => {
    const context = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    try {
      await signInJurorByApi(context, JUROR_CODES[0]);

      const action = await context.request.post(API.operator.action, {
        data: { action: "OPEN" },
      });
      expect(action.status()).toBe(401);

      const state = await context.request.get(API.operator.state);
      expect(state.status()).toBe(401);

      const exported = await context.request.get(API.operator.export);
      expect(exported.status()).toBe(401);
    } finally {
      await context.close();
    }
  });

  test("participant portal shows the sign-in screen and its state requires a session", async ({
    page,
    request,
  }) => {
    await page.goto("/participant");
    await expect(
      page.getByRole("heading", { name: "El público invierte. El jurado decide." }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Ingresar con mi cuenta" })).toBeVisible();

    const state = await request.get(API.participant.state);
    expect(state.status()).toBe(401);
  });
});
