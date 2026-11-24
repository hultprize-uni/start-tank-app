import type { Criterion } from "@/shared/domain/types";
import { Badge, ProgressBar } from "@/shared/ui";
import { formatScore, SCORE_LABELS } from "../criteria";
import type { JuryVotesView, OwnVerdictView } from "../types";
import styles from "./VoteRegistered.module.css";

interface VoteRegisteredProps {
  ownVerdict: OwnVerdictView;
  criteria: readonly Criterion[];
  votes: JuryVotesView;
}

/** Confirmación del envío definitivo del jurado, con el avance de envíos de la ronda. */
export function VoteRegistered({ ownVerdict, criteria, votes }: VoteRegisteredProps) {
  const countText = `${votes.emitted} de ${votes.total} jurados enviaron`;

  return (
    <section className={styles.panel} aria-labelledby="registrado-titulo">
      <Badge tone={ownVerdict.abstained ? "yellow" : "cyan"}>
        {ownVerdict.abstained ? "Abstención registrada" : "Notas enviadas"}
      </Badge>

      <h2 id="registrado-titulo" className={styles.decision}>
        {ownVerdict.abstained
          ? "Conflicto de interés declarado"
          : ownVerdict.score !== null
            ? `Puntaje: ${formatScore(ownVerdict.score)} / 5`
            : "Calificación registrada"}
      </h2>

      {ownVerdict.abstained ? (
        <p className={styles.lead}>
          Tu abstención queda excluida del promedio de la startup. El resto del jurado continúa con
          la evaluación.
        </p>
      ) : (
        <>
          <p className={styles.lead}>
            Tus notas quedaron bloqueadas y nadie las verá hasta que el operador revele el
            veredicto.
          </p>
          <ul className={styles.notes}>
            {criteria.map((criterion) => {
              const value = ownVerdict.notes[criterion.id];
              return (
                <li key={criterion.id} className={styles.noteRow}>
                  <span className={styles.noteName}>{criterion.name}</span>
                  <span className={styles.noteValue}>
                    {value !== undefined ? `${value} / 5 · ${SCORE_LABELS[value]}` : "—"}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <ProgressBar
        label="Jurados que enviaron"
        value={votes.emitted}
        max={votes.total}
        valueText={countText}
        tone="cyan"
      />
      <p className={styles.count} aria-live="polite">
        {countText}
      </p>
    </section>
  );
}
