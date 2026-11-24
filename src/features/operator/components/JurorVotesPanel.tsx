import { ProgressBar } from "@/shared/ui";

import { JUROR_STATUS_LABELS, formatAgo, formatJuryScore } from "../labels";
import type { JurorView } from "../types";

import panel from "./Panel.module.css";
import styles from "./Admin.module.css";

interface JurorVotesPanelProps {
  jurors: readonly JurorView[];
}

/**
 * Jurados en vivo (RF-17, RF-26): conexión, y si están pendientes, calificando, con notas enviadas
 * o sin notas por abstención. La nota solo aparece después de revelar (RNF-11).
 */
export function JurorVotesPanel({ jurors }: JurorVotesPanelProps) {
  const sent = jurors.filter((juror) => juror.status === "sent" || juror.status === "abstained").length;

  return (
    <section className={panel.panel} aria-labelledby="jurados-ronda">
      <div className={panel.header}>
        <h2 id="jurados-ronda" className={panel.title}>
          Jurados
        </h2>
        <span className={panel.muted}>
          {sent} de {jurors.length} enviados
        </span>
      </div>
      <ProgressBar
        value={sent}
        max={Math.max(1, jurors.length)}
        label="Envíos del jurado"
        valueText={`${sent} de ${jurors.length} enviados`}
        tone="cyan"
      />
      <ul className={styles.jurorList}>
        {jurors.map((juror) => (
          <li key={juror.id} className={styles.jurorRow}>
            <span
              className={`${styles.jurorDot} ${juror.online ? "" : styles.jurorDotOffline}`}
              aria-hidden="true"
            />
            <span>
              <span className={styles.jurorName}>{juror.name}</span>
              <span className={styles.jurorMeta}>
                {juror.online ? "Conectado" : `Desconectado · ${formatAgo(juror.lastSeenSeconds)}`}
              </span>
            </span>
            <span className={`${styles.jurorStatus} ${styles[`jurorStatus-${juror.status}`] ?? ""}`}>
              {juror.score !== null
                ? `${formatJuryScore(juror.score)} de 5`
                : JUROR_STATUS_LABELS[juror.status]}
            </span>
          </li>
        ))}
      </ul>
      <p className={panel.note}>Las notas se ocultan hasta revelar.</p>
    </section>
  );
}
