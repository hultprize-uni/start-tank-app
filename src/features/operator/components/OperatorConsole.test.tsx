// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OperatorRole, OperatorViewModel } from "../types";
import { buildOperatorView, type SnapshotRound } from "../view";

import { OperatorConsole } from "./OperatorConsole";

afterEach(cleanup);

function round(number: number, status: SnapshotRound["status"]): SnapshotRound {
  return {
    number,
    startupName: number === 2 ? "AguaClara" : `Startup ${number}`,
    sdg: "ODS 6",
    status,
    multiplier: null,
    juryScore: null,
    phaseEndsAt: null,
    pausedSeconds: null,
    accumulated: 56500,
    uniqueInvestors: 47,
    price: 128.4,
  };
}

function view(role: OperatorRole, status: SnapshotRound["status"] = "SCHEDULED"): OperatorViewModel {
  const built = buildOperatorView({
    now: new Date(),
    operator: { name: "Diego", role },
    flags: { eventStarted: true, manualMode: false },
    durations: { pitch: 300, qa: 600, lastCall: 60, voting: 150, result: 90 },
    rounds: [{ ...round(1, "SETTLED"), juryScore: 4, multiplier: 1.4 }, round(2, status)],
    firstOpenAt: null,
    jurors: [],
    cancelMode: null,
    attendeesOnline: 78,
    attendeesTotal: 80,
    actions: [],
    balances: [],
    positions: [],
  });
  if (built === null) throw new Error("sin rondas");
  return built;
}

function renderConsole(viewModel: OperatorViewModel) {
  const onRun = vi.fn();
  render(
    <OperatorConsole
      viewModel={viewModel}
      busy={false}
      dialog={null}
      onDialog={vi.fn()}
      onRun={onRun}
      onTimer={vi.fn()}
      onCancel={vi.fn()}
      onRestartRound={vi.fn()}
      onResetEvent={vi.fn()}
      onRescue={vi.fn()}
      onManualSettle={vi.fn()}
      onExport={vi.fn()}
    />,
  );
  return { onRun };
}

describe("OperatorConsole", () => {
  it("con la ronda 2 programada, el conductor ve solo Iniciar pitch (RF-06)", async () => {
    const user = userEvent.setup();
    const { onRun } = renderConsole(view("CONDUCTOR"));

    expect(screen.getByRole("heading", { name: "AguaClara" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar pitch" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Anunciar última llamada" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Revelar veredicto" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "Iniciar pitch" }));
    expect(onRun).toHaveBeenCalledWith("open");
  });

  it("el soporte ve la consola en solo lectura (RF-03)", () => {
    renderConsole(view("SUPPORT", "OPEN"));

    expect(screen.getByText(/Estás como soporte/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Anunciar última llamada" })).toBeNull();
    expect(screen.queryByRole("button", { name: /Anular ronda/ })).toBeNull();
    expect(screen.getByText("56,500 IC")).toBeInTheDocument();
  });
});
