"use client";

import type { Criterion } from "@/shared/domain/types";
import { SCORE_LABELS, type ScoreValue } from "../criteria";
import { ScoreScale } from "./ScoreScale";
import styles from "./CriteriaCard.module.css";

interface CriteriaCardProps {
  index: number;
  criterion: Criterion;
  value: ScoreValue | null;
  disabled?: boolean;
  onChange: (value: ScoreValue) => void;
}

/**
 * Tarjeta interactiva de un criterio de evaluación (RF-14): muestra el nombre, peso, nota
 * seleccionada y la escala del 1 al 5 con frases de referencia.
 */
export function CriteriaCard({
  index,
  criterion,
  value,
  disabled = false,
  onChange,
}: CriteriaCardProps) {
  const weightPct = `${Math.round(criterion.weight * 100)}%`;

  return (
    <article className={styles.card} aria-labelledby={`criterio-${criterion.id}-titulo`}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.index} aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <h3 id={`criterio-${criterion.id}-titulo`} className={styles.name}>
            {criterion.name}
          </h3>
        </div>
        <span className={styles.weight}>{weightPct}</span>
      </div>

      <p className={styles.selected}>
        {value !== null ? (
          <>
            Nota elegida: <strong>{value} / 5</strong> · {SCORE_LABELS[value]}
          </>
        ) : (
          "Elige una nota del 1 al 5"
        )}
      </p>

      <ScoreScale
        criterionId={criterion.id}
        criterionName={criterion.name}
        anchorMin={criterion.anchorMin}
        anchorMax={criterion.anchorMax}
        value={value}
        disabled={disabled}
        onChange={onChange}
      />
    </article>
  );
}
