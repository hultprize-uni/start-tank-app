import type { RoundView } from "@/lib/api/operator.types";

import { ROUND_STATUS_LABELS, formatCoins } from "./labels";
import styles from "./OperatorConsole.module.css";

interface RoundHeaderProps {
  round: RoundView;
  connectedAttendees: number;
  screenSynced: boolean;
}

/** Encabezado de la ronda en curso: número, startup, estado y conexión con la pantalla del evento. */
export function RoundHeader({
  round,
  connectedAttendees,
  screenSynced,
}: RoundHeaderProps) {
  return (
    <header className={styles.roundHeader}>
      <div>
        <p className="st-eyebrow">Consola de ronda</p>
        <h2 className={styles.roundTitle}>
          Ronda {round.number} de {round.total} · {round.startupName}
        </h2>
      </div>
      <div className={styles.roundMeta}>
        <span className={`${styles.pill} ${styles.pillAccent}`}>
          {ROUND_STATUS_LABELS[round.status]}
        </span>
        <span className={styles.pill}>
          {formatCoins(connectedAttendees)} conectados
        </span>
        <span
          className={`${styles.pill} ${screenSynced ? styles.pillSynced : ""}`}
        >
          Pantalla: {screenSynced ? "sincronizada" : "sin sincronizar"}
        </span>
      </div>
    </header>
  );
}
