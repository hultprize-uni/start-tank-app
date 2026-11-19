"use client";

import { useRouter } from "next/navigation";
import type { ScreenPhase } from "@/lib/api/screen.types";
import { SCREEN_PHASES } from "./fases";
import styles from "./pantalla.module.css";

interface PhaseSelectorProps {
  currentPhase: ScreenPhase;
}

/*
 * Selector de fase para desarrollo. Cambia el parametro `fase` de la URL.
 * El servidor lo renderiza solo en modo desarrollo.
 */
export function PhaseSelector({ currentPhase: currentPhase }: PhaseSelectorProps) {
  const router = useRouter();

  return (
    <label className={styles.devSelector}>
      <span>Fase (solo desarrollo)</span>
      <select
        value={currentPhase}
        onChange={(event) => router.push(`/pantalla?fase=${event.target.value}`)}
      >
        {SCREEN_PHASES.map((phase) => (
          <option key={phase.value} value={phase.value}>
            {phase.label}
          </option>
        ))}
      </select>
    </label>
  );
}
