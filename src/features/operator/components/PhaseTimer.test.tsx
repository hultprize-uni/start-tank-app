// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PhaseTimer, phaseDisplay } from "./PhaseTimer";

afterEach(cleanup);

describe("phaseDisplay", () => {
  it("separa el pitch del toma y dame con el mercado abierto", () => {
    expect(phaseDisplay("PITCH", 161)).toEqual({ label: "Pitch", seconds: 161 });
    expect(phaseDisplay("OPEN", 500)).toEqual({ label: "Toma y dame", seconds: 500 });
    expect(phaseDisplay("VOTING", 90)).toEqual({ label: "Votación", seconds: 90 });
    expect(phaseDisplay("CLOSED", null).seconds).toBeNull();
  });
});

describe("PhaseTimer (RF-07)", () => {
  const paused = { serverTime: new Date().toISOString(), phaseEndsAt: null, paused: true, pausedSeconds: 90 };

  it("muestra los segundos congelados en pausa y ofrece Reanudar al conductor", async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(
      <PhaseTimer
        status="LAST_CALL"
        clock={paused}
        schedule={{ deltaSeconds: 180, plannedAt: "2026-11-26T19:56:00.000Z" }}
        adjustable
        canControl
        busy={false}
        onCommand={onCommand}
      />,
    );

    expect(screen.getByRole("timer")).toHaveTextContent("01:30");
    expect(screen.getByText("Última llamada · En pausa")).toBeInTheDocument();
    expect(screen.getByText(/Evento 3 min atrasado respecto a las 14:56/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Reanudar" }));
    await user.click(screen.getByRole("button", { name: "+1 min" }));
    expect(onCommand.mock.calls).toEqual([["resume"], ["add_minute"]]);
  });

  it("oculta los controles al soporte", () => {
    render(
      <PhaseTimer
        status="LAST_CALL"
        clock={paused}
        schedule={{ deltaSeconds: null, plannedAt: null }}
        adjustable
        canControl={false}
        busy={false}
        onCommand={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "+1 min" })).toBeNull();
  });
});
