"use client";

import { useEffect, useRef, useState } from "react";
import { BrandLogo } from "@/shared/ui";
import styles from "./landing.module.css";

/*
 * Tiempos de la intro, iguales a los de la referencia que pidió el cliente: la marca entra en
 * 700 ms, se sostiene 1150 ms después de que la página termina de cargar (como mucho se espera
 * 1600 ms la carga) y luego el fondo se desarma en celdas durante 1150 ms, cada celda en 420 ms.
 */
const TIMING = { cellSize: 40, cellSizeTouch: 56, hold: 1150, wipe: 1150, cell: 420, maxWaitForLoad: 1600 };
const CELL_EASING = "cubic-bezier(.65,0,.35,1)";
/** Evento que avisa al resto de la portada que la intro terminó. */
export const INTRO_DONE_EVENT = "st:intro-done";

type Phase = "hold" | "wipe" | "done";

interface Grid {
  cols: number;
  rows: number;
}

/** Curva de entrada y salida cúbica: el barrido arranca lento, acelera y frena al final. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/*
 * Intro de la portada: el logo aparece sobre un fondo sólido y luego el fondo se desarma en
 * cuadrados en diagonal, de la esquina inferior izquierda a la superior derecha, hasta dejar la
 * portada a la vista. Se reproduce en cada carga. Con movimiento reducido, el fondo se desvanece.
 */
export function LandingIntro() {
  const [grid, setGrid] = useState<Grid | null>(null);
  const [phase, setPhase] = useState<Phase>("hold");
  const gridRef = useRef<HTMLDivElement>(null);
  const brandRef = useRef<HTMLDivElement>(null);

  // La cuadrícula depende de la ventana, así que se arma en el cliente; hasta entonces el fondo es sólido.
  useEffect(() => {
    const touch = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
    const size = touch ? TIMING.cellSizeTouch : TIMING.cellSize;
    setGrid({
      cols: Math.max(1, Math.ceil(window.innerWidth / size)),
      rows: Math.max(1, Math.ceil(window.innerHeight / size)),
    });
  }, []);

  useEffect(() => {
    const cellsRoot = gridRef.current;
    const brand = brandRef.current;
    if (grid === null || cellsRoot === null || brand === null) return;

    const root = document.documentElement;
    root.style.overflow = "hidden";
    const timers: number[] = [];
    const animations: Animation[] = [];
    const later = (fn: () => void, ms: number) => timers.push(window.setTimeout(fn, ms));
    const reduced =
      typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const wipe = () => {
      setPhase("wipe");
      if (reduced) {
        animations.push(cellsRoot.parentElement!.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 400, fill: "forwards" }));
        later(() => setPhase("done"), 420);
        return;
      }
      animations.push(
        brand.animate(
          [
            { opacity: 1, transform: "translateY(0)" },
            { opacity: 0, transform: "translateY(-12px)" },
          ],
          { duration: 350, easing: "ease", fill: "forwards" },
        ),
      );
      const lastRow = grid.rows - 1;
      const lastCol = grid.cols - 1;
      const spread = TIMING.wipe - TIMING.cell;
      Array.from(cellsRoot.children).forEach((cell, index) => {
        const row = Math.floor(index / grid.cols);
        const col = index % grid.cols;
        const progress = (lastRow - row + col) / (lastRow + lastCol || 1);
        animations.push(
          cell.animate(
            [
              { opacity: 1, transform: "scale(1.02)" },
              { opacity: 0, transform: "scale(.86)" },
            ],
            { duration: TIMING.cell, delay: easeInOutCubic(progress) * spread, easing: CELL_EASING, fill: "forwards" },
          ),
        );
      });
      later(() => setPhase("done"), TIMING.wipe + 120);
    };

    // La espera empieza cuando la página terminó de cargar, con un tope para conexiones lentas.
    let started = false;
    const startHold = () => {
      if (started) return;
      started = true;
      later(wipe, reduced ? 500 : TIMING.hold);
    };
    if (document.readyState === "complete") {
      startHold();
    } else {
      window.addEventListener("load", startHold, { once: true });
      later(startHold, TIMING.maxWaitForLoad);
    }

    return () => {
      window.removeEventListener("load", startHold);
      timers.forEach((id) => window.clearTimeout(id));
      animations.forEach((animation) => animation.cancel());
      root.style.overflow = "";
    };
  }, [grid]);

  // Se avisa después de retirar la capa del DOM, cuando el resto de la portada ya escucha.
  useEffect(() => {
    if (phase !== "done") return;
    document.documentElement.style.overflow = "";
    window.dispatchEvent(new Event(INTRO_DONE_EVENT));
  }, [phase]);

  if (phase === "done") return null;

  return (
    <div className={styles.intro} data-intro={phase} aria-hidden="true">
      <div
        ref={gridRef}
        className={styles.introGrid}
        style={
          grid
            ? { gridTemplateColumns: `repeat(${grid.cols}, 1fr)`, gridTemplateRows: `repeat(${grid.rows}, 1fr)` }
            : undefined
        }
      >
        {grid ? Array.from({ length: grid.cols * grid.rows }, (_, index) => <div key={index} className={styles.introCell} />) : null}
      </div>
      <div ref={brandRef} className={styles.introBrand}>
        <BrandLogo variant="vertical" priority className={styles.introLogo} />
      </div>
    </div>
  );
}
