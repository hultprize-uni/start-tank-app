// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ControlsPanel } from "./ControlsPanel";

vi.mock("../api/client", () => ({ submitManualSettlement: vi.fn() }));

afterEach(cleanup);

const handlers = () => ({
  onUndo: vi.fn(),
  onOpenCancel: vi.fn(),
  onExport: vi.fn(),
});

describe("ControlsPanel", () => {
  it("deshabilita deshacer con la nota Pendiente de API cuando la API no lo soporta", () => {
    render(
      <ControlsPanel
        canUndo={false}
        canCancel
        canManualSettle={false}
        apiPending
        {...handlers()}
      />,
    );

    const deshacer = screen.getByRole("button", { name: "Deshacer última acción" });
    expect(deshacer).toBeDisabled();
    expect(deshacer).toHaveAccessibleDescription("Pendiente de API");
  });

  it("muestra la liquidación manual solo cuando la ronda está cerrada o en votación", () => {
    const { rerender } = render(
      <ControlsPanel canUndo canCancel canManualSettle={false} apiPending={false} {...handlers()} />,
    );
    expect(screen.queryByRole("button", { name: "Liquidar a mano" })).toBeNull();

    rerender(
      <ControlsPanel canUndo canCancel canManualSettle apiPending={false} {...handlers()} />,
    );
    expect(screen.getByRole("button", { name: "Liquidar a mano" })).toBeInTheDocument();
  });

  it("deshabilita Anular ronda cuando no es posible anular", () => {
    render(
      <ControlsPanel
        canUndo={false}
        canCancel={false}
        canManualSettle={false}
        apiPending={false}
        {...handlers()}
      />,
    );

    expect(screen.getByRole("button", { name: "Anular ronda…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Exportar saldos" })).toBeEnabled();
  });
});
