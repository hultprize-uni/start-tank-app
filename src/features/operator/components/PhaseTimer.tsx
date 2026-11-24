"use client";

import { Button } from "@/shared/ui";
import { usePhaseSeconds } from "@/shared/lib/use-server-clock";
import type { PhaseClock } from "@/shared/domain/types";

import { formatClock, formatScheduleDelta, formatShortTime } from "../labels";
import type { PhaseDurations, RoundStatus, ScheduleView, TimerCommand } from "../types";

import styles from "./Admin.module.css";

/** Segundos a partir de los cuales el cronómetro se resalta. */
const LOW_SECONDS = 10;

interface PhaseTimerProps {
  status: RoundStatus;
  clock: PhaseClock;
  durations: PhaseDurations;
  schedule: ScheduleView;
  /** La fase admite pausa y +1 min. */
  adjustable: boolean;
  /** Solo el conductor ve los controles (RF-05). */
  canControl: boolean;
  busy: boolean;
  onCommand: (command: TimerCommand) => void;
}

/**
 * Fase y segundos que se muestran. Con el mercado abierto el cronómetro cubre el pitch y el toma y
 * dame: mientras quede más que el toma y dame, se muestra lo que resta del pitch.
 */
export function phaseDisplay(
  status: RoundStatus,
  secondsLeft: number | null,
  durations: PhaseDurations,
): { label: string; seconds: number | null } {
  switch (status) {
    case "OPEN":
      if (secondsLeft !== null && secondsLeft > durations.qa) {
        return { label: "Pitch", seconds: secondsLeft - durations.qa };
      }
      return { label: "Toma y dame", seconds: secondsLeft };
    case "LAST_CALL":
      return { label: "Última llamada", seconds: secondsLeft };
    case "VOTING":
      return { label: "Votación", seconds: secondsLeft };
    default:
      return { label: "Sin cronómetro", seconds: null };
  }
}

/**
 * Cronómetro de la fase con la hora del servidor (RF-07, RNF-15), +1 min, pausa y el indicador de
 * adelanto o atraso del evento (tarea 5.3).
 */
export function PhaseTimer({
  status,
  clock,
  durations,
  schedule,
  adjustable,
  canControl,
  busy,
  onCommand,
}: PhaseTimerProps) {
  const secondsLeft = usePhaseSeconds(clock);
  const display = phaseDisplay(status, secondsLeft, durations);
  const low = display.seconds !== null && display.seconds <= LOW_SECONDS && !clock.paused;
  const className = [
    styles.timer,
    clock.paused ? styles.timerPaused : "",
    low ? styles.timerLow : "",
  ].join(" ");

  return (
    <div className={className}>
      <p className={styles.timerLabel}>
        {display.label}
        {clock.paused ? " · En pausa" : ""}
      </p>
      <p className={styles.timerValue} role="timer" aria-live="off">
        {display.seconds === null ? "--:--" : formatClock(display.seconds)}
      </p>
      {canControl && adjustable ? (
        <div className={styles.timerControls}>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => onCommand("add_minute")}
          >
            +1 min
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => onCommand(clock.paused ? "resume" : "pause")}
          >
            {clock.paused ? "Reanudar" : "Pausa"}
          </Button>
        </div>
      ) : null}
      {schedule.deltaSeconds !== null ? (
        <p
          className={`${styles.schedule} ${schedule.deltaSeconds >= 60 ? styles.scheduleLate : ""}`}
        >
          {formatScheduleDelta(schedule.deltaSeconds)}
          {schedule.plannedAt !== null
            ? ` respecto a las ${formatShortTime(new Date(schedule.plannedAt))}`
            : ""}
        </p>
      ) : null}
    </div>
  );
}
