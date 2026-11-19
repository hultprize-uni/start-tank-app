import type { JuryActions, JuryViewModel } from "../types";
import { CriteriaCard } from "./CriteriaCard";
import { HistoryPanel } from "./HistoryPanel";
import { JuryBody } from "./JuryBody";
import { JuryMobileHeader } from "./JuryMobileHeader";
import { JuryRail } from "./JuryRail";
import { RoundStatus } from "./RoundStatus";
import { StartupCard } from "./StartupCard";
import styles from "./JurySession.module.css";

interface JurySessionProps {
  jurorLabel: string;
  state: JuryViewModel;
  actions: JuryActions;
}

/**
 * Sesión del jurado ingresado: recorrido del evento, estado de la ronda y pantalla vigente. En
 * laptop se muestra en dos columnas; en pantallas estrechas, en una sola.
 */
export function JurySession({ jurorLabel, state, actions }: JurySessionProps) {
  const { phase, round } = state;

  return (
    <div className={styles.session}>
      <JuryRail jurorLabel={jurorLabel} rail={state.rail} onLogout={actions.logout} />

      <div className={styles.main}>
        <JuryMobileHeader jurorLabel={jurorLabel} onLogout={actions.logout} />
        <h1 className="visually-hidden">Portal del jurado</h1>

        <div className={styles.grid}>
          <div className={styles.column}>
            {phase !== null && <RoundStatus phase={phase} round={round} />}
            {round !== null && (
              <>
                <StartupCard round={round} />
                <CriteriaCard criteria={state.criteria} />
              </>
            )}
          </div>

          <div className={styles.column}>
            <JuryBody state={state} actions={actions} />
            <HistoryPanel rail={state.rail} />
          </div>
        </div>
      </div>
    </div>
  );
}
