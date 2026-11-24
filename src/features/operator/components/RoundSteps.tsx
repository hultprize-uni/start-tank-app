import type { RoundStepView } from "../types";

import styles from "./Admin.module.css";

interface RoundStepsProps {
  steps: readonly RoundStepView[];
}

/** Línea de pasos de la ronda: hechos en cian, el actual en rosa y los pendientes en gris. */
export function RoundSteps({ steps }: RoundStepsProps) {
  return (
    <nav aria-label="Pasos de la ronda">
      <ol className={styles.steps}>
        {steps.map((step) => {
          const className = [
            styles.step,
            step.state === "done" ? styles.stepDone : "",
            step.state === "current" ? styles.stepCurrent : "",
          ].join(" ");
          return (
            <li
              key={step.id}
              className={className}
              aria-current={step.state === "current" ? "step" : undefined}
            >
              {step.label}
              {step.state === "done" ? <span className={styles.srOnly}> (hecho)</span> : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
