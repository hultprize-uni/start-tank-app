"use client";

import { useRouter } from "next/navigation";
import { PAGE_ROUTES } from "@/shared/lib/api-routes";
import type { ScreenPhase } from "../types";
import { SCREEN_PHASES } from "./phases";
import styles from "./screen.module.css";

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
        onChange={(event) => router.push(`${PAGE_ROUTES.screen}?phase=${event.target.value}`)}
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
