// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AttendeeView } from "../types";

import { BalanceAdjustDialog } from "./BalanceAdjustDialog";

afterEach(cleanup);

const JUANITA: AttendeeView = {
  id: "12",
  name: "Juanita P.",
  email: null,
  balance: 7000,
  position: 7,
  online: true,
  lastSeenSeconds: 3,
  lastInvestment: null,
};

describe("BalanceAdjustDialog (RF-11)", () => {
  it("suma 500 IC con motivo y muestra el saldo resultante", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(null);
    render(<BalanceAdjustDialog attendee={JUANITA} onClose={vi.fn()} onConfirm={onConfirm} />);

    await user.type(screen.getByLabelText("Monto (IC)"), "500");
    expect(screen.getByText("Saldo resultante: 7,500 IC (+500)")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Confirmar ajuste" }));
    expect(onConfirm).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Motivo (queda en el log)"), "Error del sistema");
    await user.click(screen.getByRole("button", { name: "Confirmar ajuste" }));

    expect(onConfirm).toHaveBeenCalledWith(500, "Error del sistema");
  });

  it("resta y no permite dejar el saldo negativo", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(null);
    render(<BalanceAdjustDialog attendee={JUANITA} onClose={vi.fn()} onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: "Restar" }));
    await user.type(screen.getByLabelText("Monto (IC)"), "8000");
    await user.type(screen.getByLabelText("Motivo (queda en el log)"), "x");
    await user.click(screen.getByRole("button", { name: "Confirmar ajuste" }));

    expect(screen.getByText("El saldo no puede quedar por debajo de 0.")).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
