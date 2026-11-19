import { beforeEach, describe, expect, it, vi } from "vitest";

const sqlMock = vi.hoisted(() => vi.fn());

vi.mock("@/server/db/client", () => ({ sql: sqlMock }));

import { registerInvestment } from "./queries";

beforeEach(() => {
  sqlMock.mockReset();
});

describe("registerInvestment", () => {
  it("devuelve ROUND_NOT_OPEN sin invocar la función cuando no hay ronda abierta", async () => {
    sqlMock.mockResolvedValueOnce([]);

    const result = await registerInvestment(7, 300);

    expect(result).toEqual({ ok: false, error: "ROUND_NOT_OPEN" });
    expect(sqlMock).toHaveBeenCalledTimes(1);
  });

  it("invoca fn_registrar_inversion con el usuario recibido y devuelve el resultado de la función", async () => {
    sqlMock
      .mockResolvedValueOnce([{ id_ronda: "3" }])
      .mockResolvedValueOnce([{ resultado: { ok: false, error: "TOPE_RONDA_SUPERADO", saldo: 9000 } }]);

    const result = await registerInvestment(7, 300);

    expect(result).toEqual({ ok: false, error: "ROUND_CAP_EXCEEDED", balance: 9000 });
    const [functionText, ...parameters] = sqlMock.mock.calls[1] as [TemplateStringsArray, ...unknown[]];
    expect(functionText.join("?")).toContain("fn_registrar_inversion");
    expect(parameters).toEqual([7, "3", 300]);
  });
});
