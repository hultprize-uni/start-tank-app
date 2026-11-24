"use client";

import { useEffect, useState } from "react";

import { Button, Toast } from "@/shared/ui";

import { adjustBalance, searchAttendees } from "../api/client";
import { formatAgo, formatCoins } from "../labels";
import type { AttendeeSearchView, AttendeeView } from "../types";

import { BalanceAdjustDialog } from "./BalanceAdjustDialog";
import panel from "./Panel.module.css";
import styles from "./Admin.module.css";

/** Espera tras la última tecla antes de buscar, en milisegundos. */
const SEARCH_DEBOUNCE_MS = 300;

interface AttendeeSearchProps {
  /** El conductor puede ajustar saldos; el soporte solo consulta (HU-17). */
  canAdjust: boolean;
  onSessionExpired: () => void;
}

/**
 * Asistentes (RF-26, HU-17, CU-19): búsqueda por nombre o correo con el saldo, la posición, la
 * última conexión y la última inversión. El conductor abre desde aquí el ajuste de saldo (RF-11).
 */
export function AttendeeSearch({ canAdjust, onSessionExpired }: AttendeeSearchProps) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<AttendeeSearchView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adjusting, setAdjusting] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      const result = await searchAttendees(query);
      if (cancelled) return;
      if (result.ok) {
        setData(result.value);
        setError(null);
      } else if (result.sessionExpired) {
        onSessionExpired();
      } else {
        setError(result.message);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, version, onSessionExpired]);

  const items = data?.items ?? [];
  const selected: AttendeeView | undefined =
    items.find((item) => item.id === selectedId) ?? items[0];

  async function adjust(amount: number, reason: string): Promise<string | null> {
    if (selected === undefined) return "Elige un asistente.";
    const result = await adjustBalance(selected.id, amount, reason);
    if (!result.ok) {
      if (result.sessionExpired) onSessionExpired();
      return result.message;
    }
    setNotice(
      `Saldo de ${selected.name} actualizado a ${formatCoins(result.value.balance ?? 0)} IC.`,
    );
    setVersion((value) => value + 1);
    return null;
  }

  return (
    <>
      <div className={styles.sectionHeader}>
        <div>
          <h1 className={styles.sectionTitle}>Asistentes</h1>
          <p className={styles.sectionLead}>
            {canAdjust
              ? "Busca a un asistente para ver su saldo y su posición, o corregir su saldo."
              : "Como soporte puedes ver saldos y posiciones. Los ajustes de saldo los hace el conductor."}
          </p>
        </div>
        <dl className={styles.kv}>
          <dt>Conectados</dt>
          <dd>{data?.online ?? "—"}</dd>
          <dt>Billeteras</dt>
          <dd>{data?.total ?? "—"}</dd>
        </dl>
      </div>

      <div className={styles.field}>
        <label htmlFor="buscar-asistente" className={styles.label}>
          Buscar por nombre o correo
        </label>
        <input
          id="buscar-asistente"
          className={styles.input}
          type="search"
          value={query}
          autoComplete="off"
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {error !== null ? (
        <Toast tone="negative" role="alert">
          {error}
        </Toast>
      ) : null}
      {notice !== null ? (
        <Toast tone="positive" role="status">
          {notice}
        </Toast>
      ) : null}

      <div className={styles.twoColumns}>
        <section className={panel.panel} aria-label="Resultados">
          {items.length === 0 ? (
            <p className={panel.muted}>{data === null ? "Buscando…" : "Sin resultados."}</p>
          ) : (
            <ul className={styles.rows}>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={styles.resultButton}
                    aria-pressed={selected?.id === item.id}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span>
                      <span className={styles.rowTitle}>{item.name}</span>
                      <span className={styles.rowMeta}> #{item.position}</span>
                    </span>
                    <span className={styles.num}>{formatCoins(item.balance)} IC</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {selected !== undefined ? (
          <section className={`${panel.panel} ${styles.attendeeCard}`} aria-labelledby="ficha-asistente">
            <div className={styles.attendeeHeader}>
              <h2 id="ficha-asistente" className={styles.attendeeName}>
                {selected.name}
              </h2>
              <span className={panel.muted}>{selected.email ?? ""}</span>
            </div>
            <dl className={styles.kv}>
              <dt>Saldo actual</dt>
              <dd>{formatCoins(selected.balance)} IC</dd>
              <dt>Posición</dt>
              <dd>
                #{selected.position} de {data?.total ?? "—"}
              </dd>
              <dt>Última inversión</dt>
              <dd>
                {selected.lastInvestment === null
                  ? "Sin inversiones"
                  : `${formatCoins(selected.lastInvestment.amount)} IC en ${selected.lastInvestment.startupName} (ronda ${selected.lastInvestment.roundNumber})`}
              </dd>
              <dt>Última conexión</dt>
              <dd>{formatAgo(selected.lastSeenSeconds)}</dd>
            </dl>
            {canAdjust ? (
              <div>
                <Button variant="ghost" onClick={() => setAdjusting(true)}>
                  Ajustar saldo…
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      {adjusting && selected !== undefined ? (
        <BalanceAdjustDialog
          attendee={selected}
          onClose={() => setAdjusting(false)}
          onConfirm={adjust}
        />
      ) : null}
    </>
  );
}
