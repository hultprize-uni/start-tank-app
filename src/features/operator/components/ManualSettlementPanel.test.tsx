// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { submitManualSettlement } from "../api/client";

import { ManualSettlementPanel } from "./ManualSettlementPanel";

vi.mock("../api/client", () => ({ submitManualSettlement: vi.fn() }));

const submit = vi.mocked(submitManualSettlement);

beforeEach(() => {
  submit.mockReset();
});

afterEach(cleanup);

describe("ManualSettlementPanel", () => {
  it("no se muestra fuera de los estados CERRADA y EN_VOTACION", () => {
    render(<ManualSettlementPanel available={false} />);

    expect(screen.queryByRole("button", { name: "Liquidar a mano" })).toBeNull();
    expect(screen.queryByRole("radiogroup", { name: "Respaldos del jurado" })).toBeNull();
  });

  it("ofrece las opciones de 0 a 4 respaldos y no muestra la nota Pendiente de API", () => {
    render(<ManualSettlementPanel available />);

    const group = screen.getByRole("radiogroup", { name: "Respaldos del jurado" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(5);
    expect(screen.queryByText("Pendiente de API")).toBeNull();
  });

  it("pide confirmación antes de llamar al cliente y no liquida al cancelar", async () => {
    const user = userEvent.setup();
    render(<ManualSettlementPanel available />);

    await user.click(screen.getByRole("button", { name: "Liquidar a mano" }));
    expect(
      screen.getByText(/¿Confirmas liquidar la ronda con 0 de 4 respaldos\?/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(submit).not.toHaveBeenCalled();
  });

  it("llama al cliente con los respaldos elegidos y muestra el resultado", async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue({ ok: true, value: { multiplicador: 1.4, fraccionRespaldo: 0.75 } });
    render(<ManualSettlementPanel available />);

    await user.click(screen.getByRole("radio", { name: "3" }));
    await user.click(screen.getByRole("button", { name: "Liquidar a mano" }));
    await user.click(screen.getByRole("button", { name: "Liquidar ronda" }));

    await waitFor(() => expect(submit).toHaveBeenCalledWith(3));
    expect(await screen.findByText("Ronda liquidada con multiplicador 1.400x.")).toBeInTheDocument();
  });

  it("muestra el motivo del rechazo en español cuando la liquidación falla", async () => {
    const user = userEvent.setup();
    submit.mockResolvedValue({
      ok: false,
      sessionExpired: false,
      message: "La ronda ya fue liquidada. No es posible liquidarla de nuevo.",
    });
    render(<ManualSettlementPanel available />);

    await user.click(screen.getByRole("button", { name: "Liquidar a mano" }));
    await user.click(screen.getByRole("button", { name: "Liquidar ronda" }));

    expect(
      await screen.findByText("La ronda ya fue liquidada. No es posible liquidarla de nuevo."),
    ).toBeInTheDocument();
  });
});
