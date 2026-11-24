// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAlertSound } from "../hooks/useAlertSound";
import type { HealthAlert } from "../types";

import { AlertBanner } from "./AlertBanner";

afterEach(cleanup);

const JUROR_DOWN: HealthAlert = {
  id: "juror-3",
  level: "critical",
  title: "Jurado 3 desconectado hace 45 s",
  detail: "Su portal dejó de responder.",
  action: "rescue",
};

const SLOW_DB: HealthAlert = {
  id: "db-warning",
  level: "warning",
  title: "Base de datos lenta",
  detail: "",
  action: null,
};

describe("AlertBanner (tarea 5.9)", () => {
  it("muestra la alerta con su acción sugerida", async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    render(
      <AlertBanner
        alerts={[JUROR_DOWN]}
        canAct
        canRescue
        muted={false}
        onToggleMuted={vi.fn()}
        onAction={onAction}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Jurado 3 desconectado hace 45 s");
    await user.click(screen.getByRole("button", { name: "Revelar con presentes" }));
    expect(onAction).toHaveBeenCalledWith("rescue");
  });

  it("no ofrece el rescate al soporte", () => {
    render(
      <AlertBanner
        alerts={[JUROR_DOWN]}
        canAct={false}
        canRescue
        muted={false}
        onToggleMuted={vi.fn()}
        onAction={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Revelar con presentes" })).toBeNull();
  });
});

describe("useAlertSound", () => {
  it("suena una sola vez por alerta crítica nueva y no por las ámbar", () => {
    const play = vi.fn();
    const { rerender } = renderHook(({ alerts }) => useAlertSound(alerts, play), {
      initialProps: { alerts: [SLOW_DB] },
    });
    expect(play).not.toHaveBeenCalled();

    rerender({ alerts: [JUROR_DOWN, SLOW_DB] });
    expect(play).toHaveBeenCalledTimes(1);

    rerender({ alerts: [JUROR_DOWN] });
    expect(play).toHaveBeenCalledTimes(1);

    // Resuelta y vuelve a aparecer: suena otra vez.
    rerender({ alerts: [] });
    rerender({ alerts: [JUROR_DOWN] });
    expect(play).toHaveBeenCalledTimes(2);
  });
});
