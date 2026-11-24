// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { JurorView } from "../types";

import { RescueRevealDialog } from "./RescueRevealDialog";

afterEach(cleanup);

const JURORS: JurorView[] = [1, 2, 3, 4].map((n) => ({
  id: String(n),
  name: `Jurado ${n}`,
  status: n === 3 ? "drafting" : "sent",
  online: n !== 3,
  lastSeenSeconds: n === 3 ? 45 : 2,
  score: null,
}));

describe("RescueRevealDialog (RF-18)", () => {
  it("explica con quiénes se revela y exige el motivo", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(null);
    const onClose = vi.fn();
    render(<RescueRevealDialog jurors={JURORS} onClose={onClose} onConfirm={onConfirm} />);

    expect(screen.getByRole("dialog", { name: "¿Revelar con 3 de 4 jurados?" })).toBeInTheDocument();
    expect(screen.getByText(/Jurado 1, Jurado 2, Jurado 4/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Revelar con 3 jurados" }));
    expect(onConfirm).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Motivo (queda en el log)"), "Jurado 3 sin conexión");
    await user.click(screen.getByRole("button", { name: "Revelar con 3 jurados" }));

    expect(onConfirm).toHaveBeenCalledWith("Jurado 3 sin conexión");
    expect(onClose).toHaveBeenCalled();
  });

  it("Seguir esperando cierra sin revelar", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<RescueRevealDialog jurors={JURORS} onClose={onClose} onConfirm={onConfirm} />);

    await user.click(screen.getByRole("button", { name: "Seguir esperando" }));

    expect(onClose).toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
