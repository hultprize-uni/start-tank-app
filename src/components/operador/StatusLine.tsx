import {
  ROUND_STATUS_SEQUENCE,
  type RoundStatus,
} from "@/lib/api/operator.types";

import { ROUND_STATUS_LABELS } from "./labels";
import styles from "./OperatorConsole.module.css";

interface StatusLineProps {
  status: RoundStatus;
}

/** Línea de estados de la ronda: marca los estados recorridos y el estado actual. */
export function StatusLine({ status }: StatusLineProps) {
  const cancelled = status === "ANULADA";
  const currentIndex = ROUND_STATUS_SEQUENCE.findIndex(
    (item) => item === status,
  );
  const lastIndex = ROUND_STATUS_SEQUENCE.length - 1;

  return (
    <nav aria-label="Estados de la ronda">
      <ol className={styles.statusList}>
        {ROUND_STATUS_SEQUENCE.map((item, index) => {
          const passed = !cancelled && currentIndex > index;
          const current = !cancelled && currentIndex === index;
          const className = [
            styles.statusStep,
            passed ? styles.statusStepPassed : "",
            current ? styles.statusStepCurrent : "",
          ].join(" ");
          return (
            <li
              key={item}
              className={className}
              aria-current={current ? "step" : undefined}
            >
              {ROUND_STATUS_LABELS[item]}
              {index < lastIndex ? (
                <span className={styles.statusArrow} aria-hidden="true">
                  ›
                </span>
              ) : null}
            </li>
          );
        })}
        {cancelled ? (
          <li
            className={`${styles.statusStep} ${styles.statusStepCurrent}`}
            aria-current="step"
          >
            {ROUND_STATUS_LABELS.ANULADA}
          </li>
        ) : null}
      </ol>
    </nav>
  );
}
