"use client";

import { useRouter } from "next/navigation";
import type { ScreenPhase } from "@/lib/api/screen.types";
import { FASES_PANTALLA } from "./fases";
import styles from "./pantalla.module.css";

interface SelectorFaseProps {
  faseActual: ScreenPhase;
}

/*
 * Selector de fase para desarrollo. Cambia el parametro `fase` de la URL.
 * El servidor lo renderiza solo en modo desarrollo.
 */
export function SelectorFase({ faseActual }: SelectorFaseProps) {
  const router = useRouter();

  return (
    <label className={styles.selectorDesarrollo}>
      <span>Fase (solo desarrollo)</span>
      <select
        value={faseActual}
        onChange={(evento) => router.push(`/pantalla?fase=${evento.target.value}`)}
      >
        {FASES_PANTALLA.map((fase) => (
          <option key={fase.valor} value={fase.valor}>
            {fase.etiqueta}
          </option>
        ))}
      </select>
    </label>
  );
}
