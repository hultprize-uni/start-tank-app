import type { InvestPreviewRow } from "../hooks/useInvestForm";
import styles from "./InvestForm.module.css";

/** Lo que recibiría el asistente con cada puntaje del jurado, de 1 a 5 (RF-24). */
export function InvestPreview({ rows }: { rows: readonly InvestPreviewRow[] }) {
  return (
    <div className={styles.preview} role="group" aria-label="Lo que recibirías según el jurado">
      <p className={styles.previewTitle}>Si el jurado pone…</p>
      {rows.map((row) => (
        <div key={row.score} className={styles.row}>
          <span className={styles.scenario}>
            {row.score} de 5 <span className={styles.multiplier}>{row.multiplierText}</span>
          </span>
          <span className={`${styles.value} ${styles[row.tone]}`}>{row.payoutText ?? "—"}</span>
        </div>
      ))}
    </div>
  );
}
