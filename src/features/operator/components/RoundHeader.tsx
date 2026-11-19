import { Badge, Countdown, Eyebrow, type BadgeTone } from "@/shared/ui";

import { ROUND_STATUS_LABELS, formatCoins } from "../labels";
import type { RoundStatus, RoundView } from "../types";

import { StatusLine } from "./StatusLine";
import styles from "./OperatorConsole.module.css";

interface RoundHeaderProps {
  round: RoundView;
  /** Segundos restantes de la última llamada. Es null fuera de esa fase. */
  lastCallRemaining: number | null;
  connectedAttendees: number;
}

/** Tono de la etiqueta de estado: la votación resalta en rosa, el mercado abierto en cian. */
function toneOf(status: RoundStatus): BadgeTone {
  if (status === "VOTING") return "pink";
  if (status === "OPEN" || status === "LAST_CALL") return "cyan";
  return "yellow";
}

/** Estados en los que el mercado o la votación están en curso. */
function isLive(status: RoundStatus): boolean {
  return status === "OPEN" || status === "LAST_CALL" || status === "VOTING";
}

/** Encabezado de la ronda: estado, startup, cuenta regresiva de la última llamada y línea de estados. */
export function RoundHeader({ round, lastCallRemaining, connectedAttendees }: RoundHeaderProps) {
  return (
    <header className={styles.roundHeader}>
      <div className={styles.roundIdentity}>
        <div className={styles.roundBadges}>
          <Badge tone={toneOf(round.status)} live={isLive(round.status)}>
            {ROUND_STATUS_LABELS[round.status]}
          </Badge>
          <Eyebrow as="span">
            Ronda {round.number} de {round.total}
          </Eyebrow>
        </div>
        <h1 className={styles.roundTitle}>{round.startupName}</h1>
        <div className={styles.stepper}>
          <StatusLine status={round.status} />
        </div>
      </div>
      <div className={styles.roundMeta}>
        {lastCallRemaining !== null ? (
          <Countdown
            seconds={lastCallRemaining}
            label="Tiempo restante de la última llamada"
            tone={lastCallRemaining <= 10 ? "warning" : "default"}
          />
        ) : null}
        <p className={styles.narrowOnly}>
          Conectados {formatCoins(connectedAttendees)}
        </p>
      </div>
    </header>
  );
}
