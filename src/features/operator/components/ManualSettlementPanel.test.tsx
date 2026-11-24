// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ManualSettlementPanel } from "./ManualSettlementPanel";

afterEach(cleanup);

describe("ManualSettlementPanel", () => {
  it("no se muestra fuera de los estados cerrada y en votación", () => {
    render(<ManualSettlementPanel available={false} onSettle={vi.fn()} />);
    expect(screen.queryByRole("button", { name: /Liquidar a mano/ })).toBeNull();
  });

  it("muestra el multiplicador que resulta del puntaje", async () => {
    const user = userEvent.setup();
    render(<ManualSettlementPanel available onSettle={vi.fn()} />);

    const score = screen.getByLabelText("Puntaje de la startup (1 a 5)");
    await user.clear(score);
    await user.type(score, "4");

    expect(screen.getByText("Multiplicador resultante: 1.4x")).toBeInTheDocument();
  });

  it("exige el motivo y confirma antes de liquidar", async () => {
    const user = userEvent.setup();
    const onSettle = vi.fn().mockResolvedValue({ multiplier: 1.4 });
    render(<ManualSettlementPanel available onSettle={onSettle} />);

    const score = screen.getByLabelText("Puntaje de la startup (1 a 5)");
    await user.clear(score);
    await user.type(score, "4");
    await user.click(screen.getByRole("button", { name: /Liquidar a mano/ }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Escribe el motivo para continuar.")).toBeInTheDocument();

    await user.type(screen.getByLabelText("Motivo (queda en el log)"), "Falla del portal");
    await user.click(screen.getByRole("button", { name: /Liquidar a mano/ }));
    expect(screen.getByRole("dialog", { name: "Confirmar liquidación manual" })).toBeInTheDocument();
    expect(onSettle).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Liquidar ronda" }));

    expect(onSettle).toHaveBeenCalledWith(4, "Falla del portal");
    expect(await screen.findByRole("status")).toHaveTextContent("Ronda liquidada a mano con 1.4x.");
  });

  it("muestra el rechazo del servidor", async () => {
    const user = userEvent.setup();
    const onSettle = vi.fn().mockResolvedValue({ error: "La ronda ya fue liquidada." });
    render(<ManualSettlementPanel available onSettle={onSettle} />);

    await user.type(screen.getByLabelText("Motivo (queda en el log)"), "x");
    await user.click(screen.getByRole("button", { name: /Liquidar a mano/ }));
    await user.click(screen.getByRole("button", { name: "Liquidar ronda" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("La ronda ya fue liquidada.");
  });
});
