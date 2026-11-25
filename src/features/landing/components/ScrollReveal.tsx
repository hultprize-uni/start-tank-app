"use client";

import { useEffect } from "react";
import { INTRO_DONE_EVENT } from "./LandingIntro";

/*
 * Activa el barrido de entrada de los elementos marcados con data-reveal dentro de la portada.
 * Sin JavaScript, sin IntersectionObserver o con movimiento reducido no se oculta nada: el estado
 * oculto solo existe cuando la portada lleva data-reveal-ready. Si la intro está en pantalla,
 * espera a que termine para que los primeros barridos se vean.
 */
export function ScrollReveal() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>("[data-reveal-root]");
    if (
      root === null ||
      typeof IntersectionObserver === "undefined" ||
      typeof window.matchMedia !== "function" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    root.setAttribute("data-reveal-ready", "");
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-revealed", "");
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.12 },
    );
    const start = () => root.querySelectorAll("[data-reveal]").forEach((element) => observer.observe(element));

    const introPlaying = document.querySelector("[data-intro]") !== null;
    if (introPlaying) {
      window.addEventListener(INTRO_DONE_EVENT, start, { once: true });
    } else {
      start();
    }

    return () => {
      window.removeEventListener(INTRO_DONE_EVENT, start);
      observer.disconnect();
      root.removeAttribute("data-reveal-ready");
    };
  }, []);

  return null;
}
