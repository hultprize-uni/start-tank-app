// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { PAGE_ROUTES } from "@/shared/lib/api-routes";
import { landingMetadata } from "../metadata";
import { LandingPage } from "./LandingPage";

afterEach(cleanup);

describe("LandingPage: estructura", () => {
  it("expone encabezado, navegación, contenido y pie, con un solo h1", () => {
    render(<LandingPage />);

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Principal" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Cinco startups. Tu capital. El jurado decide.",
    );
  });

  it("enlaza la navegación con las secciones de la página", () => {
    render(<LandingPage />);
    const nav = screen.getByRole("navigation", { name: "Principal" });

    for (const [name, href] of [
      ["El evento", "#evento"],
      ["Cómo se juega", "#como-se-juega"],
      ["Programa", "#programa"],
      ["Plataforma", "#plataforma"],
    ]) {
      expect(within(nav).getByRole("link", { name })).toHaveAttribute("href", href);
      expect(document.querySelector(href)).not.toBeNull();
    }
  });

  it("lleva el CTA principal al portal del inversionista", () => {
    render(<LandingPage />);
    for (const link of screen.getAllByRole("link", { name: "Entrar a invertir" })) {
      expect(link).toHaveAttribute("href", PAGE_ROUTES.participant);
    }
  });

  it("enlaza los cuatro portales de la plataforma y la inscripción en Luma", () => {
    render(<LandingPage />);

    expect(screen.getByRole("link", { name: "Pantalla del auditorio" })).toHaveAttribute(
      "href",
      PAGE_ROUTES.screen,
    );
    expect(screen.getByRole("link", { name: "Portal del jurado" })).toHaveAttribute(
      "href",
      PAGE_ROUTES.jury,
    );
    expect(screen.getByRole("link", { name: "Consola del operador" })).toHaveAttribute(
      "href",
      PAGE_ROUTES.operator,
    );
    expect(screen.getByRole("link", { name: "Inscribirme en Luma" })).toHaveAttribute(
      "href",
      "https://luma.com/yj5tp4fe",
    );
  });

  it("muestra los datos del evento y el programa", () => {
    render(<LandingPage />);

    expect(screen.getByText("26 nov")).toBeInTheDocument();
    expect(screen.getByText("2:00 p. m.")).toBeInTheDocument();
    expect(screen.getByText("CTIC")).toBeInTheDocument();
    expect(screen.getByText("80 a 100")).toBeInTheDocument();

    expect(screen.getByText("14:00")).toBeInTheDocument();
    expect(screen.getByText("14:30")).toBeInTheDocument();
    expect(screen.getByText("Cierre y reconocimiento a los jurados")).toBeInTheDocument();
    expect(screen.getByText("Detalle y anuncio de la gran final de Hult Prize UNI")).toBeInTheDocument();
    expect(screen.queryByText("Idea millonaria en 20 minutos")).not.toBeInTheDocument();
  });
});

describe("LandingPage: reglas vigentes", () => {
  it("explica la inversión única por ronda y el multiplicador continuo", () => {
    render(<LandingPage />);

    expect(screen.getByText("Desde 250 IC hasta el 30% de tu saldo. Una sola vez por ronda.")).toBeInTheDocument();
    const bars = screen.getByRole("list", { name: "Multiplicador según el puntaje del jurado" });
    expect(within(bars).getAllByRole("listitem").map((item) => item.textContent)).toEqual([
      "0.2xPuntaje 1",
      "0.6xPuntaje 2",
      "1.0xPuntaje 3",
      "1.4xPuntaje 4",
      "1.8xPuntaje 5",
    ]);
  });

  it("no menciona las reglas anteriores ni otro proveedor de ingreso", () => {
    const { container } = render(<LandingPage />);
    expect(container.textContent).not.toMatch(/respald|rechaz|Microsoft/i);
  });
});

describe("LandingPage: metadatos", () => {
  it("incluye título y descripción con la fecha del evento", () => {
    expect(String(landingMetadata.title)).toContain("Start Tank");
    expect(landingMetadata.description).toContain("26 de noviembre");
    expect(landingMetadata.openGraph).toMatchObject({
      locale: "es_PE",
      siteName: "Start Tank",
    });
    expect(landingMetadata.twitter).toMatchObject({
      card: "summary",
    });
  });
});
