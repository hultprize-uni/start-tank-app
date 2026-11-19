// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ParticipantShell } from "./ParticipantShell";

afterEach(cleanup);

/** Renderiza el shell con marcadores de texto en cada zona para comprobar su ubicación. */
function renderShell(isDesktop: boolean) {
  return render(
    <ParticipantShell
      isDesktop={isDesktop}
      header={<div>Cabecera móvil</div>}
      sidebar={<aside>Barra lateral</aside>}
      primary={<section>Pantalla de ronda</section>}
      secondary={<section>Panel complementario</section>}
    />,
  );
}

describe("ParticipantShell", () => {
  it("apila la cabecera, la pantalla y los paneles en el móvil", () => {
    renderShell(false);

    expect(screen.getByText("Cabecera móvil")).toBeInTheDocument();
    expect(screen.queryByText("Barra lateral")).not.toBeInTheDocument();
    expect(screen.getByText("Pantalla de ronda")).toBeInTheDocument();
    expect(screen.getByText("Panel complementario")).toBeInTheDocument();
  });

  it("muestra la barra lateral y las dos columnas en el escritorio", () => {
    renderShell(true);

    expect(screen.getByText("Barra lateral")).toBeInTheDocument();
    expect(screen.queryByText("Cabecera móvil")).not.toBeInTheDocument();
    expect(screen.getByText("Pantalla de ronda")).toBeInTheDocument();
    expect(screen.getByText("Panel complementario")).toBeInTheDocument();
  });
});
