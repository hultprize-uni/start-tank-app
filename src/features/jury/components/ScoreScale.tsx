"use client";

import { SCORE_LABELS, SCORE_VALUES, type ScoreValue } from "../criteria";
import styles from "./ScoreScale.module.css";

interface ScoreScaleProps {
  criterionId: string;
  criterionName: string;
  anchorMin: string;
  anchorMax: string;
  value: ScoreValue | null;
  disabled?: boolean;
  onChange: (value: ScoreValue) => void;
}

/**
 * Escala de 1 a 5 para calificar un criterio (RF-14), con etiquetas de escala y frases de
 * referencia de las notas extremas (1 y 5).
 */
export function ScoreScale({
  criterionId,
  criterionName,
  anchorMin,
  anchorMax,
  value,
  disabled = false,
  onChange,
}: ScoreScaleProps) {
  return (
    <div className={styles.wrapper}>
      <div
        role="radiogroup"
        aria-label={`Puntaje para ${criterionName}`}
        className={styles.scale}
      >
        {SCORE_VALUES.map((score) => {
          const checked = value === score;
          return (
            <label
              key={score}
              className={`${styles.option} ${checked ? styles.selected : ""}`}
            >
              <input
                type="radio"
                className="visually-hidden"
                name={`criterio-${criterionId}`}
                value={score}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(score)}
              />
              <span className={styles.number}>{score}</span>{" "}
              <span className={styles.label}>{SCORE_LABELS[score]}</span>
            </label>
          );
        })}
      </div>

      <div className={styles.anchors}>
        <p className={styles.anchor}>
          <span className={styles.anchorTag}>1</span> {anchorMin}
        </p>
        <p className={`${styles.anchor} ${styles.anchorEnd}`}>
          <span className={styles.anchorTag}>5</span> {anchorMax}
        </p>
      </div>
    </div>
  );
}
