"use client";

import { useAnimatedNumber } from "@/shared/lib/use-animated-number";
import type { ScreenViewModel } from "../types";
import {
  Count,
  EventFeed,
  InvestmentChart,
  InvestorTable,
  JurySeats,
  StageClock,
  StartupMark,
  formatIc,
  formatScore,
  formatX,
} from "./parts";
import s from "./stage.module.css";

/* Las 7 fases del escenario (6.8), según los frames E1 a E5 de Figma (05 Escenario). */

type Props = { vm: ScreenViewModel };

function StartupHeading({ vm, status }: Props & { status: string }) {
  if (!vm.startup) return null;
  return (
    <div className={s.heading}>
      <StartupMark startup={vm.startup} size={96} />
      <div>
        <p className={s.pill}>
          <span className={s.liveDot} aria-hidden="true" />
          {status}
          {vm.round ? `, ronda ${vm.round.number} de ${vm.round.total}` : null}
        </p>
        <h1 className={s.startupName}>{vm.startup.name}</h1>
        <p className={s.sdg}>{vm.startup.sdg}</p>
      </div>
    </div>
  );
}

/**
 * Panel lateral del mercado y del veredicto. ScreenClient lo mantiene montado entre fases para que
 * la tabla conserve sus posiciones; en el veredicto las filas se reordenan con animación.
 */
export function Rail({ vm }: Props) {
  return (
    <aside className={s.rail}>
      <InvestorTable rows={vm.investors} title="Inversores por patrimonio" replay={vm.phase === "REVEAL"} />
      {vm.feed.length > 0 ? <EventFeed items={vm.feed} /> : null}
    </aside>
  );
}

/** Espera antes de la primera ronda. */
export function WaitingPhase({ vm }: Props) {
  if (!vm.startup) return null;
  return (
    <section className={`${s.center} ${s.phaseIn}`} aria-label="Espera">
      <p className={s.label}>A continuación</p>
      <div className={s.introRow}>
        <StartupMark startup={vm.startup} size={140} />
        <h1 className={s.introName}>{vm.startup.name}</h1>
      </div>
      <p className={s.sdgLarge}>{vm.startup.sdg}</p>
      <p className={s.introText}>{vm.startup.description}</p>
      <p className={s.calm}>El mercado abrirá en breve.</p>
    </section>
  );
}

/** Pitch, mercado abierto y última llamada (E1). */
export function MarketPhase({ vm }: Props) {
  const market = vm.market;
  const price = useAnimatedNumber(market?.price ?? 100, 700);
  const lastCall = vm.phase === "LAST_CALL";
  // El mapeador etiqueta el cronómetro "Pitch" solo con la ronda en PITCH: el mercado sigue cerrado.
  const pitch = vm.clockLabel === "Pitch";
  const status = lastCall
    ? "Última llamada"
    : vm.clock?.paused
      ? pitch ? "Pitch en pausa" : "Mercado en pausa"
      : pitch ? "Pitch en curso" : "Mercado abierto";
  if (!market) return null;
  return (
      <section className={`${s.main} ${s.phaseIn}`} aria-label="Mercado de la ronda">
        <div className={s.mainHead}>
          <StartupHeading vm={vm} status={status} />
          <StageClock clock={vm.clock} label={vm.clockLabel} big={lastCall} />
        </div>
        <div className={s.chartPanel}>
          <div className={s.chartHead}>
            <div>
              <p className={s.label}>{pitch ? "El mercado abre cuando termine el pitch" : "Monto acumulado de la sala"}</p>
              <p className={s.hugeNumber}>
                <Count value={market.accumulated} /> IC
              </p>
            </div>
            <dl className={s.stats}>
              <div>
                <dt className={s.label}>Precio en vivo</dt>
                <dd>{price.toFixed(1)}</dd>
              </div>
              <div>
                <dt className={s.label}>Ya invirtieron</dt>
                <dd className={s.cyan}>
                  {market.investors} de {market.attendees}
                </dd>
              </div>
            </dl>
          </div>
          <InvestmentChart points={market.points} />
        </div>
      </section>
  );
}

/** El jurado califica (E2): asientos que se encienden sin mostrar la nota. */
export function VotingPhase({ vm }: Props) {
  const sent = vm.jury.filter((seat) => seat.sent).length;
  const closed = vm.clockLabel === null;
  return (
    <section className={`${s.center} ${s.phaseIn}`} aria-label="Votación del jurado">
      <p className={s.pillWarn}>
        <span className={s.liveDot} aria-hidden="true" />
        Mercado cerrado
      </p>
      <h1 className={s.votingTitle}>
        {closed ? `Se cerró el mercado de ${vm.startup?.name}.` : `El jurado está calificando a ${vm.startup?.name}.`}
      </h1>
      <p className={s.votingLead}>
        {closed
          ? "El jurado califica en unos segundos."
          : `${sent} de ${vm.jury.length} jurados ya enviaron sus notas. Las notas se revelan todas a la vez.`}
      </p>
      <JurySeats seats={vm.jury} />
      <dl className={s.votingStats}>
        <div>
          <dt className={s.label}>La sala invirtió</dt>
          <dd>{formatIc(vm.market?.accumulated ?? 0)} IC</dd>
        </div>
        <div>
          <dt className={s.label}>Inversores</dt>
          <dd>
            {vm.market?.investors ?? 0} de {vm.market?.attendees ?? 0}
          </dd>
        </div>
        {!closed ? (
          <div>
            <StageClock clock={vm.clock} label="Tiempo de votación" />
          </div>
        ) : null}
      </dl>
    </section>
  );
}

/**
 * Veredicto (E3, 6.7). La secuencia completa dura menos de 1 segundo: notas, multiplicador, salto
 * de la curva y tabla reordenada, cada una con un retraso escalonado en CSS.
 */
export function RevealPhase({ vm }: Props) {
  const verdict = vm.verdict;
  const multiplier = useAnimatedNumber(verdict?.multiplier ?? 1, 600);
  if (!verdict) return null;
  const gain = verdict.returned - verdict.invested;
  return (
    <section className={`${s.main} ${s.phaseIn}`} aria-label="Veredicto de la ronda">
        <div className={s.verdictRow}>
          <div className={s.verdictCard}>
            <div className={s.verdictInner}>
              <p className={s.label}>
                {verdict.cancelled ? "Ronda anulada" : `Veredicto de ${vm.startup?.name}`}
              </p>
              <p className={s.multiplier}>{formatX(Math.round(multiplier * 100) / 100)}</p>
              <p className={s.verdictNote}>
                {verdict.cancelled
                  ? "Se devolvió lo invertido."
                  : `Puntaje del jurado ${formatScore(verdict.juryScore ?? 0)} de 5, ${verdict.scorePct}%`}
              </p>
            </div>
          </div>
          {!verdict.cancelled ? <JurySeats seats={vm.jury} compact /> : null}
        </div>
        <div className={`${s.chartPanel} ${s.revealChart}`}>
          <div className={s.chartHead}>
            <div>
              <p className={s.label}>La sala invirtió {formatIc(verdict.invested)} y recibe</p>
              <p className={`${s.hugeNumber} ${gain >= 0 ? s.up : s.down}`}>
                <Count value={verdict.returned} ms={800} /> IC
              </p>
            </div>
            <p className={`${s.gain} ${gain >= 0 ? s.up : s.down}`}>
              {gain >= 0 ? "+" : "-"}
              {formatIc(Math.abs(gain))}
            </p>
          </div>
          <InvestmentChart points={vm.market?.points ?? []} returned={verdict.returned} />
        </div>
      </section>
  );
}

/** Entre rondas (E4): tabla completa, la siguiente startup y las startups hasta ahora. */
export function BetweenPhase({ vm }: Props) {
  const played = vm.results.length;
  return (
    <div className={`${s.betweenGrid} ${s.phaseIn}`}>
      <section className={s.betweenMain} aria-label="Tabla de inversores">
        <h1 className={s.betweenTitle}>
          {vm.next ? `Así va la sala después de ${played} ${played === 1 ? "ronda" : "rondas"}.` : "Así terminó la sala."}
        </h1>
        <InvestorTable rows={vm.investors} title="Tabla de inversores" wide />
      </section>
      <aside className={s.rail}>
        {vm.next ? (
          <section className={s.panel} aria-label="Siguiente startup">
            <p className={s.label}>Sube al escenario</p>
            <div className={s.nextRow}>
              <StartupMark startup={vm.next} size={88} />
              <div>
                <p className={s.nextName}>{vm.next.name}</p>
                <p className={s.sdg}>{vm.next.sdg}</p>
              </div>
            </div>
            <p className={s.introTextSmall}>{vm.next.description}</p>
          </section>
        ) : (
          <section className={s.panel}>
            <p className={s.panelTitle}>El conductor cierra el evento en un momento.</p>
          </section>
        )}
        <section className={s.panel} aria-label="Startups hasta ahora">
          <h2 className={s.panelTitle}>Startups hasta ahora</h2>
          <ul className={s.results}>
            {vm.results.map((result) => (
              <li key={result.name} className={s.result}>
                <span>{result.name}</span>
                <span className={s.muted}>
                  {result.cancelled ? "anulada" : result.juryScore !== null ? `${formatScore(result.juryScore)} de 5` : ""}
                </span>
                <span className={result.multiplier !== null && result.multiplier >= 1 ? s.up : s.down}>
                  {result.multiplier !== null ? formatX(result.multiplier) : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

/** Cierre del evento (E5): ganadora, top 3 y mejor ojo (RF-30). */
export function ClosingPhase({ vm }: Props) {
  const closing = vm.closing;
  if (!closing) return null;
  const { winner } = closing;
  return (
    <div className={`${s.closingGrid} ${s.phaseIn}`}>
      <section className={s.winnerCard} aria-label="Startup ganadora">
        <div className={s.winnerInner}>
          <p className={s.label}>Startup ganadora del Shark Tank</p>
          <div className={s.introRow}>
            <StartupMark startup={winner} size={120} />
            <div>
              <h1 className={s.introName}>{winner.name}</h1>
              <p className={s.sdg}>{winner.sdg}</p>
            </div>
          </div>
          <p className={s.winnerPrize}>Pase directo a la gran final de Hult Prize at UNI.</p>
          <dl className={s.winnerStats}>
            <div>
              <dt className={s.label}>Multiplicador</dt>
              <dd>{winner.multiplier !== null ? formatX(winner.multiplier) : "-"}</dd>
            </div>
            <div>
              <dt className={s.label}>Puntaje del jurado</dt>
              <dd>{winner.juryScore !== null ? `${formatScore(winner.juryScore)} de 5` : "-"}</dd>
            </div>
            <div>
              <dt className={s.label}>Sala que invirtió</dt>
              <dd className={s.cyan}>{Math.round(winner.investorShare * 100)}%</dd>
            </div>
            <div>
              <dt className={s.label}>Puntaje final</dt>
              <dd className={s.pink}>{winner.finalScore.toFixed(2)}</dd>
            </div>
          </dl>
        </div>
      </section>
      <aside className={s.rail}>
        <InvestorTable rows={closing.top3} title="Top 3 inversionistas" />
        {closing.bestEye ? (
          <section className={s.panel} aria-label="Mejor ojo">
            <p className={s.label}>Mejor ojo</p>
            <p className={s.bestEye}>{closing.bestEye.name}</p>
            <p className={s.muted}>
              Acertó {closing.bestEye.hits} de {closing.bestEye.rounds} rondas.
            </p>
          </section>
        ) : null}
      </aside>
    </div>
  );
}
