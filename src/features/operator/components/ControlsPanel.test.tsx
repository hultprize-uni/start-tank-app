// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ControlsPanel } from "./ControlsPanel";

afterEach(cleanup);

const handlers = () => ({
  onUndo: vi.fn(),
  onOpenCancel: vi.fn(),
  onExport: vi.fn(),
  onToggleManual: vi.fn(),
  onSetManualBacks: vi.fn(),
});

describe("ControlsPanel", () => {
  it("deshabilita deshacer y modo manual con la nota Pendiente de API cuando la API no los soporta", () => {
    render(
      <ControlsPanel
        canUndo={false}
        canCancel
        canManualSettle={false}
        manualMode={{ enabled: false, backs: 2 }}
        jurySize={4}
        apiPending
        {...handlers()}
      />,
    );

    const deshacer = screen.getByRole("button", { name: "Deshacer última acción" });
    expect(deshacer).toBeDisabled();
    expect(deshacer).toHaveAccessibleDescription("Pendiente de API");

    const manual = screen.getByRole("switch", { name: "Modo manual" });
    expect(manual).toBeDisabled();
    expect(manual).toHaveAccessibleDescription("Pendiente de API");
  });

  it("muestra las opciones de respaldo cuando el modo manual está activo", async () => {
    const user = userEvent.setup();
    const props = handlers();
    render(
      <ControlsPanel
        canUndo
        canCancel
        canManualSettle
        manualMode={{ enabled: true, backs: 2 }}
        jurySize={4}
        apiPending={false}
        {...props}
      />,
    );

    expect(screen.queryByText("Pendiente de API")).toBeNull();
    expect(screen.getByRole("switch", { name: "Modo manual" })).toBeChecked();
    expect(screen.getByRole("button", { name: "2" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("button", { pressed: false })).toHaveLength(4);

    await user.click(screen.getByRole("button", { name: "4" }));
    expect(props.onSetManualBacks).toHaveBeenCalledWith(4);
  });

  it("deshabilita Anular ronda cuando no es posible anular", () => {
    render(
      <ControlsPanel
        canUndo={false}
        canCancel={false}
        canManualSettle={false}
        manualMode={{ enabled: false, backs: 2 }}
        jurySize={4}
        apiPending={false}
        {...handlers()}
      />,
    );

    expect(screen.getByRole("button", { name: "Anular ronda…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Exportar saldos" })).toBeEnabled();
  });
});
