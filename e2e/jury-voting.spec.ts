import { expect, test } from "@playwright/test";
import { resetDatabase } from "./setup-db";
import {
  API,
  JUROR_CODES,
  castVoteByApi,
  driveRoundToVoting,
  signInJurorByApi,
  type ApiDecision,
} from "./support/round-flow";

test.describe("votacion del jurado", () => {
  test.beforeEach(async () => {
    await resetDatabase();
  });

  test("four jurors vote from separate sessions and a second vote is rejected", async ({
    browser,
    page,
  }) => {
    const baseURL = test.info().project.use.baseURL;
    // Tres respaldos y un rechazo. Cada jurado usa su propio contexto, con cookies independientes.
    const decisions: ApiDecision[] = ["BACK", "BACK", "BACK", "REJECT"];

    await driveRoundToVoting(page);

    for (const [index, decision] of decisions.entries()) {
      const context = await browser.newContext({ baseURL });
      try {
        await signInJurorByApi(context, JUROR_CODES[index]);

        const vote = await castVoteByApi(context, decision);
        expect(vote.status(), `voto del jurado ${JUROR_CODES[index]}`).toBe(200);

        const state = await context.request.get(API.jury.state);
        expect(((await state.json()) as { screen: string }).screen).toBe("vote_registered");

        // Un segundo voto de la misma sesión se rechaza con DUPLICATE_VOTE.
        const second = await castVoteByApi(context, decision);
        expect(second.status()).toBe(409);
        expect(((await second.json()) as { error: string }).error).toBe("DUPLICATE_VOTE");
      } finally {
        await context.close();
      }

      // La consola del operador consulta el estado cada 3 segundos; no requiere recargar la página.
      const reveal = page.getByRole("button", { name: "Revelar veredicto", exact: true });
      if (index < decisions.length - 1) {
        await expect(reveal).toBeDisabled();
      } else {
        await expect(reveal).toBeEnabled({ timeout: 10_000 });
      }
    }
  });
});
