"use client";

import { useState } from "react";

import { Button, Dialog, Toast } from "@/shared/ui";
import type { EventCloseSummary } from "@/shared/domain/types";

import { closeEvent } from "../api/client";
import { formatCoins, formatJuryScore } from "../labels";

import panel from "./Panel.module.css";
import styles from "./Admin.module.css";

interface CloseEventPanelProps {
  /** Resultado de un cierre anterior, si existe. */
  initialSummary?: EventCloseSummary | null;
  /** Ejecuta el cierre. Por defecto llama a la ruta close-event. */
  onClose?: typeof closeEvent;
}

/**
 * Cierre del evento (RF-30, CU-17). Llama a la ruta close-event, que ejecuta el proceso batch de
 * F7 y devuelve la ganadora por puntaje final (60% jurado y 40% asistentes), el top 3 de
 * inversionistas y el mejor ojo. Se confirma en un diálogo porque no se puede repetir.
 */
export function CloseEventPanel({ initialSummary = null, onClose = closeEvent }: CloseEventPanelProps) {
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<EventCloseSummary | null>(initialSummary);

  async function confirm() {
    setSending(true);
    const result = await onClose();
    setSending(false);
    setConfirming(false);
    if (result.ok) {
      setSummary(result.value);
      setError(null);
    } else {
      setError(result.message);
    }
  }

  return (
    <section className={panel.panel} aria-labelledby="cierre-evento">
      <div className={panel.header}>
        <h2 id="cierre-evento" className={panel.title}>
          Cierre del evento
        </h2>
      </div>

      {summary === null ? (
        <>
          <p className={panel.note}>
            Las 5 rondas terminaron. El cierre calcula el puntaje final de cada startup (60% jurado,
            40% asistentes que invirtieron), la ganadora, el top 3 y el mejor ojo, y exporta los
            saldos finales.
          </p>
          <div>
            <Button size="lg" onClick={() => setConfirming(true)}>
              Cerrar el evento
            </Button>
          </div>
        </>
      ) : (
        <div className={styles.summary}>
          {summary.winnerStartup !== null ? (
            <div>
              <p className={panel.note}>Startup ganadora</p>
              <p className={styles.winnerName}>{summary.winnerStartup.name}</p>
              <dl className={styles.kv}>
                <dt>Puntaje del jurado</dt>
                <dd>{formatJuryScore(summary.winnerStartup.juryScore)} de 5</dd>
                <dt>Sala que invirtió</dt>
                <dd>{Math.round(summary.winnerStartup.investorShare * 100)}%</dd>
                <dt>Puntaje final</dt>
                <dd>{summary.winnerStartup.finalScore.toFixed(2)}</dd>
              </dl>
            </div>
          ) : (
            <p className={panel.note}>Ninguna startup quedó liquidada con puntaje.</p>
          )}
          <div>
            <p className={panel.note}>Top 3 de inversionistas</p>
            <ol className={panel.list}>
              {summary.topInvestors.map((investor, index) => (
                <li key={`${investor.name}-${index}`} className={panel.standingRow}>
                  <span className={panel.muted}>{index + 1}</span>
                  <span>
                    {investor.name} <span className={panel.muted}>{investor.hits} aciertos</span>
                  </span>
                  <span className={panel.standingScore}>{formatCoins(investor.balance)} IC</span>
                </li>
              ))}
            </ol>
          </div>
          {summary.bestEye !== null ? (
            <p>
              Mejor ojo: <strong>{summary.bestEye.name}</strong>, {summary.bestEye.hits} aciertos.
            </p>
          ) : null}
        </div>
      )}

      {error !== null ? (
        <Toast tone="negative" role="alert">
          {error}
        </Toast>
      ) : null}

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="¿Cerrar el evento?"
        description="Se calcularán los resultados finales y se publicarán en la pantalla y en los teléfonos. Hazlo solo después de la última ronda."
      >
        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
          <Button loading={sending} loadingLabel="Cerrando el evento" onClick={() => void confirm()}>
            Cerrar el evento
          </Button>
        </div>
      </Dialog>
    </section>
  );
}
