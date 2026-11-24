"use client";

import { useLayoutEffect, useRef } from "react";
import type { PhaseClock } from "@/shared/domain/types";
import { useAnimatedNumber } from "@/shared/lib/use-animated-number";
import { usePhaseSeconds, useServerNow } from "@/shared/lib/use-server-clock";
import type { FeedItem, InvestorRow, JurySeat, MarketPoint, StageStartup, TickerItem } from "../types";
import s from "./stage.module.css";

/* Piezas del escenario. Cada una es un componente pequeño que las fases combinan. */

export const formatIc = (value: number) => Math.round(value).toLocaleString("en-US");
export const formatX = (value: number) => `${value.toFixed(2).replace(/0$/, "")}x`;
export const formatScore = (value: number) => value.toFixed(2).replace(/\.?0+$/, "").replace(/^(\d)$/, "$1.0");
const clockText = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

/** Número que cuenta hasta su valor nuevo (RF-22). */
export function Count({ value, format = formatIc, ms = 900 }: { value: number; format?: (v: number) => string; ms?: number }) {
  return <>{format(useAnimatedNumber(value, ms))}</>;
}

export function StartupMark({ startup, size }: { startup: StageStartup; size: number }) {
  return (
    <span className={s.mark} style={{ width: size, height: size, fontSize: size * 0.3 }} aria-hidden="true">
      {startup.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- logos externos de tamaño fijo
        <img src={startup.logoUrl} alt="" />
      ) : (
        startup.initials
      )}
    </span>
  );
}

const TICKER_TEXT: Record<TickerItem["status"], string> = {
  done: "",
  live: "en escena",
  voting: "votación",
  next: "siguiente",
  pending: "por jugar",
  cancelled: "anulada",
};

/** Cinta de startups con su multiplicador final a medida que cierran (6.4). */
export function StartupTicker({ items }: { items: TickerItem[] }) {
  return (
    <ol className={s.ticker} aria-label="Startups de la noche">
      {items.map((item) => (
        <li key={item.number} className={s.chip} data-status={item.status}>
          <span className={s.chipName}>{item.name}</span>
          {item.multiplier !== null ? (
            <span className={item.multiplier >= 1 ? s.up : s.down}>
              {item.multiplier >= 1 ? "▲" : "▼"} {formatX(item.multiplier)}
            </span>
          ) : (
            <span className={s.chipState}>
              <span className={s.ring} aria-hidden="true" />
              {TICKER_TEXT[item.status]}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Cronómetro de la fase con la hora del servidor. */
export function StageClock({ clock, label, big = false }: { clock: PhaseClock | null; label: string | null; big?: boolean }) {
  const seconds = usePhaseSeconds(clock);
  if (seconds === null || label === null) return null;
  return (
    <div className={big ? s.clockBig : s.clock} role="timer" aria-label={`${label}: quedan ${clockText(seconds)}`}>
      <span className={s.label}>{clock?.paused ? `${label} en pausa` : label}</span>
      <span className={seconds <= 10 ? `${s.clockValue} ${s.warn}` : s.clockValue}>{clockText(seconds)}</span>
    </div>
  );
}

/**
 * Curva del monto acumulado (6.2): un escalón y un pulso por inversión. Con el veredicto, la
 * línea punteada salta hasta lo que recibe la sala.
 */
export function InvestmentChart({ points, returned }: { points: MarketPoint[]; returned?: number }) {
  const W = 1200;
  const H = 360;
  const last = points[points.length - 1]?.total ?? 0;
  const top = Math.max(last, returned ?? 0, 1) * 1.12;
  const width = returned === undefined ? W : W * 0.84;
  const x = (i: number) => (points.length === 0 ? 0 : (i / points.length) * width);
  const y = (v: number) => H - (v / top) * H;

  let line = `0,${H}`;
  points.forEach((p, i) => {
    const prev = i === 0 ? 0 : points[i - 1].total;
    line += ` ${x(i + 1)},${y(prev)} ${x(i + 1)},${y(p.total)}`;
  });
  const area = `${line} ${x(points.length)},${H}`;

  return (
    <svg className={s.chart} viewBox={`0 -24 ${W} ${H + 24}`} preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="stage-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--st-cyan)" stopOpacity="0.32" />
          <stop offset="1" stopColor="var(--st-cyan)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} className={s.grid} x1="0" x2={W} y1={H * f} y2={H * f} />
      ))}
      <polygon points={area} fill="url(#stage-area)" />
      <polyline className={s.line} points={line} />
      {points.map((p, i) => (
        <circle
          key={p.at + i}
          className={i === points.length - 1 && returned === undefined ? `${s.dot} ${s.pulse}` : s.dot}
          cx={x(i + 1)}
          cy={y(p.total)}
          r="6"
        />
      ))}
      {returned !== undefined ? (
        <g className={s.jump}>
          <line className={s.jumpLine} x1={x(points.length)} y1={y(last)} x2={W - 30} y2={y(returned)} />
          <circle className={s.jumpHalo} cx={W - 30} cy={y(returned)} r="26" />
          <circle className={s.jumpDot} cx={W - 30} cy={y(returned)} r="13" />
        </g>
      ) : null}
    </svg>
  );
}

function movement(row: InvestorRow): { text: string; className: string; label: string } {
  if (row.previousPosition === null) return { text: "=", className: s.flat, label: "sin cambio" };
  const delta = row.previousPosition - row.position;
  if (delta > 0) return { text: `▲${delta}`, className: s.up, label: `sube ${delta}` };
  if (delta < 0) return { text: `▼${-delta}`, className: s.down, label: `baja ${-delta}` };
  return { text: "=", className: s.flat, label: "sin cambio" };
}

/**
 * Tabla de inversores por patrimonio (6.3). Al cambiar el orden, cada fila se desliza de su
 * posición anterior a la nueva (técnica FLIP); con movimiento reducido salta directo.
 */
export function InvestorTable({
  rows,
  title,
  wide = false,
  replay = false,
}: {
  rows: InvestorRow[];
  title: string;
  wide?: boolean;
  /** Al montar, desliza cada fila desde su posición del corte anterior (secuencia del veredicto). */
  replay?: boolean;
}) {
  const list = useRef<HTMLOListElement>(null);
  const tops = useRef(new Map<string, number>());

  useLayoutEffect(() => {
    const el = list.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? true;
    const items = Array.from(el.children) as HTMLElement[];
    const pitch = items.length > 1 ? items[1].offsetTop - items[0].offsetTop : 0;
    const firstPass = tops.current.size === 0;
    const next = new Map<string, number>();
    for (const item of items) {
      const top = item.offsetTop;
      next.set(item.dataset.id!, top);
      let before = tops.current.get(item.dataset.id!);
      if (before === undefined && firstPass && replay && item.dataset.prev) {
        before = top + (Number(item.dataset.prev) - Number(item.dataset.pos)) * pitch;
      }
      if (!reduce && before !== undefined && before !== top) {
        item.animate([{ transform: `translateY(${before - top}px)` }, { transform: "translateY(0)" }], {
          duration: 700,
          delay: firstPass ? 350 : 0,
          easing: "cubic-bezier(0.2, 0.8, 0.2, 1)",
          fill: "backwards",
        });
      }
    }
    tops.current = next;
  }, [rows, replay]);

  return (
    <section className={wide ? `${s.panel} ${s.tableWide}` : s.panel} aria-label={title}>
      <header className={s.panelHead}>
        <h2 className={s.panelTitle}>{title}</h2>
        <span className={s.muted}>Top {rows.length}</span>
      </header>
      {rows.length === 0 ? (
        <p className={s.muted}>La tabla aparece cuando cierre la primera ronda.</p>
      ) : (
        <ol ref={list} className={s.rows}>
          {rows.map((row) => {
            const move = movement(row);
            return (
              <li
                key={row.id}
                data-id={row.id}
                data-pos={row.position}
                data-prev={row.previousPosition ?? undefined}
                className={row.position <= 3 ? `${s.row} ${s.podium}` : s.row}
              >
                <span className={s.pos}>{row.position}</span>
                <span className={s.avatar} aria-hidden="true">
                  {row.name.slice(0, 1)}
                </span>
                <span className={s.name}>{row.name}</span>
                <span className={s.balance}>
                  <Count value={row.balance} />
                </span>
                <span className={`${s.move} ${move.className}`} aria-label={move.label}>
                  {move.text}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function ago(at: string, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(at)) / 1000));
  if (seconds < 3) return "ahora";
  if (seconds < 60) return `hace ${seconds} s`;
  return `hace ${Math.floor(seconds / 60)} min`;
}

/** Feed de eventos de la ronda (6.6). */
export function EventFeed({ items }: { items: FeedItem[] }) {
  const now = useServerNow(1000);
  return (
    <section className={s.panel} aria-label="En vivo">
      <h2 className={s.panelTitle}>En vivo</h2>
      <ol className={s.feed} aria-live="polite">
        {items.map((item) => (
          <li key={item.id} className={s.feedItem} data-tone={item.tone}>
            <span className={s.feedText}>{item.text}</span>
            <span className={s.muted}>{ago(item.at, now)}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * Asientos del jurado (6.5): se iluminan al enviar sin mostrar la nota. Al revelar, las 4 notas
 * aparecen a la vez.
 */
export function JurySeats({ seats, compact = false }: { seats: JurySeat[]; compact?: boolean }) {
  return (
    <ol className={compact ? `${s.seats} ${s.seatsCompact}` : s.seats} aria-label="Jurado">
      {seats.map((seat) => {
        const revealed = seat.score !== null;
        const state = revealed ? "revealed" : seat.abstained && seat.sent ? "abstained" : seat.sent ? "sent" : "waiting";
        const caption = revealed
          ? "Puntaje"
          : state === "abstained"
            ? "Se abstiene"
            : seat.sent
              ? "Notas enviadas"
              : "Calificando";
        return (
          <li key={seat.label} className={s.seat} data-state={state}>
            <span className={s.seatOrb}>{revealed ? formatScore(seat.score!) : seat.sent ? "" : "…"}</span>
            <span className={s.seatName}>{seat.label}</span>
            <span className={s.seatCaption}>{caption}</span>
          </li>
        );
      })}
    </ol>
  );
}
