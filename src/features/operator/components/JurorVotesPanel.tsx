"use client";

import { Button, ProgressBar } from "@/shared/ui";

import type { JurorSense, JurorVoteView } from "../types";

import panel from "./Panel.module.css";

interface JurorVotesPanelProps {
  jurors: JurorVoteView[];
  canSimulateVote: boolean;
  onSimulateVote: (jurorId: string) => void;
}

const SENSE_LABELS: Record<JurorSense, string> = {
  backs: "Respalda",
  rejects: "Rechaza",
  abstains: "Se abstiene",
};

/**
 * Votos del jurado. Antes de revelar solo se muestra si el voto fue emitido; el sentido aparece
 * al revelar o liquidar la ronda.
 */
export function JurorVotesPanel({ jurors, canSimulateVote, onSimulateVote }: JurorVotesPanelProps) {
  const emittedCount = jurors.filter((juror) => juror.emitted).length;

  return (
    <section className={panel.panel} aria-labelledby="votos-jurado">
      <div className={panel.header}>
        <h2 id="votos-jurado" className={panel.title}>
          Votos del jurado
        </h2>
        <span className={panel.muted}>
          {emittedCount} de {jurors.length} emitidos
        </span>
      </div>
      <ProgressBar
        value={emittedCount}
        max={jurors.length}
        label="Votos emitidos"
        valueText={`${emittedCount} de ${jurors.length} emitidos`}
        tone="cyan"
      />
      <ul className={panel.jurorGrid}>
        {jurors.map((juror) => {
          const cardClass = [
            panel.jurorCard,
            juror.emitted || juror.sense !== null ? panel.jurorCardEmitted : panel.jurorCardMissing,
          ].join(" ");
          return (
            <li key={juror.id} className={cardClass}>
              <span className={panel.jurorName}>{juror.label}</span>
              {juror.sense !== null ? (
                <span className={panel.jurorStatus}>{SENSE_LABELS[juror.sense]}</span>
              ) : (
                <span
                  className={
                    juror.emitted
                      ? panel.jurorStatus
                      : `${panel.jurorStatus} ${panel.jurorStatusMissing}`
                  }
                >
                  {juror.emitted ? "Emitido" : "Falta"}
                </span>
              )}
              {canSimulateVote && !juror.emitted ? (
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => onSimulateVote(juror.id)}
                >
                  Simular voto
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className={panel.note}>
        El sentido de cada voto se muestra solo al revelar el veredicto.
      </p>
    </section>
  );
}
