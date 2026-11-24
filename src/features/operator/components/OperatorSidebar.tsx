"use client";

import { BrandLogo, Button } from "@/shared/ui";

import { ROUND_STATUS_LABELS, formatMultiplier } from "../labels";
import type { OperatorRole, RoundSummaryView } from "../types";

import styles from "./Admin.module.css";

/** Secciones de la consola, en el orden del menú. */
export const OPERATOR_SECTIONS = [
  { id: "consola", label: "Consola" },
  { id: "salud", label: "Salud y alertas" },
  { id: "asistentes", label: "Asistentes" },
  { id: "log", label: "Log de acciones" },
  { id: "configuracion", label: "Configuración" },
  { id: "antes", label: "Antes del evento" },
] as const;

export type OperatorSection = (typeof OPERATOR_SECTIONS)[number]["id"];

interface OperatorSidebarProps {
  role: OperatorRole;
  operatorName: string;
  section: OperatorSection;
  onSection: (section: OperatorSection) => void;
  rounds: readonly RoundSummaryView[];
  currentRound: number;
  onLogout: () => void;
}

function roundSummary(round: RoundSummaryView, currentRound: number): string {
  if (round.status === "CANCELLED") return "Anulada";
  if (round.status === "SETTLED") {
    return round.multiplier === null ? "Liquidada" : formatMultiplier(round.multiplier);
  }
  if (round.number === currentRound) return ROUND_STATUS_LABELS[round.status];
  return "Pendiente";
}

/** Barra lateral: marca, rol (RF-03), menú de secciones, rondas y salida. */
export function OperatorSidebar({
  role,
  operatorName,
  section,
  onSection,
  rounds,
  currentRound,
  onLogout,
}: OperatorSidebarProps) {
  const conductor = role === "CONDUCTOR";
  return (
    <aside className={styles.sidebar} aria-label="Consola del admin">
      <BrandLogo variant="horizontal" className={styles.brandLogo} />
      <p className={styles.roleChip}>
        <span className={`${styles.roleName} ${conductor ? "" : styles.roleSupport}`}>
          {conductor ? "Conductor" : "Soporte"}
        </span>
        <span>{conductor ? "Ejecuta acciones" : "Solo lectura"}</span>
      </p>
      <p className={styles.rowMeta}>{operatorName}</p>

      <nav aria-label="Secciones">
        <ul className={styles.nav}>
          {OPERATOR_SECTIONS.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className={styles.navButton}
                aria-current={section === item.id ? "page" : undefined}
                onClick={() => onSection(item.id)}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <ol className={styles.sidebarRounds} aria-label="Rondas del evento">
        {rounds.map((round) => (
          <li
            key={round.number}
            className={styles.sidebarRound}
            aria-current={round.number === currentRound ? "true" : undefined}
          >
            <span className={styles.sidebarRoundNumber}>{round.number}</span>
            <span className={styles.sidebarRoundName}>
              <span>{round.startupName}</span>
              <span className={styles.sidebarRoundSummary}>{roundSummary(round, currentRound)}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className={styles.sidebarFooter}>
        <Button variant="ghost" onClick={onLogout}>
          Cerrar sesión
        </Button>
      </div>
    </aside>
  );
}
