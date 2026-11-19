// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { landingMetadata } from "../metadata";
import { marketFrame } from "./market-demo";
import { LandingPage } from "./LandingPage";

afterEach(cleanup);

/** Renderiza la portada una vez por prueba. */
function renderLanding() {
  return render(<LandingPage />);
}

describe("LandingPage: estructura semántica", () => {
  it("expone encabezado, navegación principal, contenido y pie", () => {
    renderLanding();

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Principal" })).toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("contentinfo")).toBeInTheDocument();
  });

  it("organiza los títulos con un único h1 y secciones con h2", () => {
    renderLanding();

    const h1 = screen.getAllByRole("heading", { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0]).toHaveTextContent("El público invierte.");
    expect(h1[0]).toHaveTextContent("El jurado decide.");

    for (const title of [
      /Tres horas, dos partes/,
      /Una ronda dura trece minutos/,
      /Cuatro módulos, una sola base de datos/,
      /¿Tienes una startup\?/,
      /Trae tu criterio\./,
    ]) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeInTheDocument();
    }
  });

  it("nombra cada sección con su encabezado", () => {
    renderLanding();

    expect(screen.getByRole("region", { name: "Cuatro módulos, una sola base de datos" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Tres horas, dos partes" })).toBeInTheDocument();
  });

  it("incluye los datos estructurados del evento", () => {
    const { container } = renderLanding();
    const script = container.querySelector('script[type="application/ld+json"]');

    expect(script).not.toBeNull();
    const data = JSON.parse(script?.textContent ?? "{}") as { name?: string; startDate?: string };
    expect(data.name).toBe("Shark Tank Universitario, Edición Impacto ODS");
    expect(data.startDate).toBe("2026-11-26T14:00:00-05:00");
  });
});

describe("LandingPage: enlaces", () => {
  it("lleva el CTA de ingreso a /participant", () => {
    renderLanding();

    const login = within(screen.getByRole("navigation", { name: "Principal" })).getByRole("link", {
      name: "Ingresar",
    });
    expect(login).toHaveAttribute("href", "/participant");
  });

  it("enlaza la inscripción a la sección correspondiente", () => {
    renderLanding();

    const signup = screen.getAllByRole("link", { name: "Inscríbete en Luma" });
    expect(signup.length).toBeGreaterThanOrEqual(2);
    for (const link of signup) {
      expect(link).toHaveAttribute("href", "#inscripcion");
    }
    expect(document.getElementById("inscripcion")).not.toBeNull();
  });

  it("enlaza cada módulo de la plataforma a su portal", () => {
    renderLanding();

    const modules = screen.getAllByRole("link", { name: /Abrir módulo/ });
    expect(modules.map((link) => link.getAttribute("href"))).toEqual([
      "/screen",
      "/participant",
      "/jury",
      "/operator",
    ]);
  });

  it("enlaza los portales del pie de página", () => {
    renderLanding();

    const footer = screen.getByRole("contentinfo");
    expect(within(footer).getByRole("link", { name: "Inversionista" })).toHaveAttribute(
      "href",
      "/participant",
    );
    expect(within(footer).getByRole("link", { name: "Jurado" })).toHaveAttribute("href", "/jury");
    expect(within(footer).getByRole("link", { name: "Operador" })).toHaveAttribute(
      "href",
      "/operator",
    );
    expect(within(footer).getByRole("link", { name: "Pantalla" })).toHaveAttribute(
      "href",
      "/screen",
    );
  });

  it("protege cualquier enlace externo con rel noopener noreferrer", () => {
    const { container } = renderLanding();
    const blank = Array.from(container.querySelectorAll('a[target="_blank"]'));

    for (const link of blank) {
      expect(link.getAttribute("rel")).toContain("noopener");
      expect(link.getAttribute("rel")).toContain("noreferrer");
    }
    for (const link of Array.from(container.querySelectorAll('a[href^="http"]'))) {
      expect(link.getAttribute("rel")).toContain("noopener");
      expect(link.getAttribute("rel")).toContain("noreferrer");
    }
  });
});

describe("LandingPage: imágenes y contenido", () => {
  it("asigna texto alternativo a cada imagen", () => {
    renderLanding();

    const images = screen.getAllByRole("img");
    expect(images.length).toBeGreaterThan(0);
    for (const image of images) {
      expect(image).toHaveAttribute("alt");
      expect(image.getAttribute("alt")).not.toBe("");
    }
  });

  it("presenta las cifras del evento", () => {
    renderLanding();

    const facts = screen.getByRole("region", { name: "Datos del evento" });
    expect(within(facts).getByText("80+")).toBeInTheDocument();
    expect(within(facts).getByText("10K")).toBeInTheDocument();
    expect(within(facts).getByText("asistentes en el Auditorio CTIC")).toBeInTheDocument();
  });

  it("muestra la primera tarjeta de mercado con la startup y el precio iniciales", () => {
    renderLanding();

    expect(screen.getByText("Pétreo")).toBeInTheDocument();
    expect(screen.getByText(marketFrame(0, 2).price)).toBeInTheDocument();
    expect(screen.getByText("Mercado en vivo")).toBeInTheDocument();
  });

  it("indica la fecha, la hora y el lugar del evento", () => {
    renderLanding();

    expect(screen.getByText("Jueves 26 de noviembre")).toBeInTheDocument();
    expect(screen.getByText("2:00 a 5:00 p. m.")).toBeInTheDocument();
    expect(screen.getByText("Auditorio CTIC, UNI")).toBeInTheDocument();
  });
});

describe("landingMetadata", () => {
  it("declara el título, la descripción y las etiquetas Open Graph", () => {
    expect(landingMetadata.title).toContain("Start Tank");
    expect(String(landingMetadata.description)).toContain("Auditorio CTIC");
    expect(landingMetadata.openGraph).toMatchObject({
      type: "website",
      locale: "es_PE",
      siteName: "Start Tank",
    });
    expect(landingMetadata.twitter).toMatchObject({ card: "summary" });
  });
});
