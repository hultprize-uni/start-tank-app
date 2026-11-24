import type { JuryActions, JuryViewModel } from "../types";
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
 * Sesión del jurado ingresado: barra lateral con el recorrido de rondas, barra de fase con reloj
 * del servidor, tarjeta de la startup en escena y área principal de calificación o resultado.
 */
export function JurySession({ jurorLabel, state, actions }: JurySessionProps) {
  const { phase, round } = state;

  return (
    <div className={styles.session}>
      <JuryRail jurorLabel={jurorLabel} rail={state.rail} onLogout={actions.logout} />

      <div className={styles.main}>
        <JuryMobileHeader jurorLabel={jurorLabel} onLogout={actions.logout} />
        <h1 className="visually-hidden">Portal del jurado</h1>
        {phase !== null && <RoundStatus phase={phase} round={round} clock={state.clock} />}

        <div className={styles.contentStack}>
          {round !== null && <StartupCard round={round} />}
          <JuryBody state={state} actions={actions} />
          <HistoryPanel rail={state.rail} />
        </div>
      </div>
    </div>
  );
}
