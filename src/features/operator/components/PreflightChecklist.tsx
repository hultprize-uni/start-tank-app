"use client";

import { useCallback, useEffect, useState } from "react";

import { Button, Dialog, Toast } from "@/shared/ui";

import { readPreflight, resetRehearsal, startEvent } from "../api/client";
import type { PreflightView } from "../types";

import panel from "./Panel.module.css";
import styles from "./Admin.module.css";

interface PreflightChecklistProps {
  canWrite: boolean;
  onSessionExpired: () => void;
  /** Se invoca después de iniciar el evento o reiniciar el ensayo, para refrescar la consola. */
  onChanged: () => void;
}

type Pending = "start" | "rehearsal" | null;

/**
 * Antes del evento (RF-29, CU-10): checklist con 5 startups, 4 jurados, base de datos y login.
 * Iniciar evento se habilita solo con todo en verde; el modo ensayo reinicia los datos y queda
 * bloqueado una vez iniciado el evento.
 */
export function PreflightChecklist({ canWrite, onSessionExpired, onChanged }: PreflightChecklistProps) {
  const [preflight, setPreflight] = useState<PreflightView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setChecking(true);
    const result = await readPreflight();
    setChecking(false);
    if (result.ok) {
      setPreflight(result.value);
    } else if (result.sessionExpired) {
      onSessionExpired();
    } else {
      setError(result.message);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirm() {
    if (pending === null) return;
    setSending(true);
    const result = pending === "start" ? await startEvent() : await resetRehearsal();
    setSending(false);
    if (result.ok) {
      setNotice(pending === "start" ? "Evento iniciado." : "Datos de ensayo reiniciados.");
      setError(null);
      onChanged();
    } else if (result.sessionExpired) {
      onSessionExpired();
    } else {
      setError(result.message);
    }
    setPending(null);
    await load();
  }

  const started = preflight?.eventStarted ?? false;
  const ready = preflight?.ready ?? false;

  return (
    <>
      <div className={styles.sectionHeader}>
        <div>
          <h1 className={styles.sectionTitle}>Antes de abrir la primera ronda</h1>
          <p className={styles.sectionLead}>Todo debe estar en verde 30 minutos antes de empezar.</p>
        </div>
        <Button variant="ghost" loading={checking} loadingLabel="Comprobando" onClick={() => void load()}>
          Probar de nuevo
        </Button>
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

      <section className={panel.panel} aria-label="Checklist previo">
        {preflight === null ? (
          <p className={panel.muted}>Comprobando…</p>
        ) : (
          <ul className={styles.rows}>
            {preflight.items.map((item) => (
              <li key={item.id} className={styles.checkRow}>
                <span
                  className={`${styles.checkIcon} ${item.ok ? styles.checkOk : styles.checkFail}`}
                  aria-hidden="true"
                >
                  {item.ok ? "✓" : "!"}
                </span>
                <span>
                  <p className={styles.rowTitle}>
                    {item.label}
                    <span className={styles.srOnly}>{item.ok ? " (en verde)" : " (en rojo)"}</span>
                  </p>
                  <p className={styles.rowMeta}>{item.detail}</p>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className={styles.twoColumns}>
        <section className={panel.panel} aria-labelledby="modo-ensayo">
          <h2 id="modo-ensayo" className={panel.title}>
            Modo ensayo
          </h2>
          <p className={panel.note}>
            Reinicia saldos, inversiones y votos para ensayar. Se bloquea al iniciar el evento.
          </p>
          <div>
            <Button
              variant="ghost"
              disabled={!canWrite || started}
              onClick={() => setPending("rehearsal")}
            >
              Reiniciar datos de ensayo
            </Button>
          </div>
          {started ? <p className={panel.note}>El evento ya está iniciado.</p> : null}
        </section>

        <section className={panel.panel} aria-labelledby="iniciar-evento">
          <h2 id="iniciar-evento" className={panel.title}>
            Iniciar el evento
          </h2>
          <p className={panel.note}>
            {started
              ? "El evento está iniciado."
              : "Disponible cuando todos los puntos estén en verde."}
          </p>
          <div>
            <Button
              disabled={!canWrite || started || !ready}
              onClick={() => setPending("start")}
            >
              Iniciar evento
            </Button>
          </div>
        </section>
      </div>

      <Dialog
        open={pending !== null}
        onClose={() => setPending(null)}
        title={pending === "start" ? "¿Iniciar el evento?" : "¿Reiniciar los datos de ensayo?"}
        description={
          pending === "start"
            ? "Desde ahora el modo ensayo queda bloqueado. Abre la primera ronda desde la consola."
            : "Se borran inversiones y votos, los saldos vuelven al capital inicial y las rondas quedan programadas. Se hace un respaldo antes."
        }
      >
        <div className={styles.actions}>
          <Button variant="ghost" onClick={() => setPending(null)}>
            Cancelar
          </Button>
          <Button
            variant={pending === "start" ? "primary" : "danger"}
            loading={sending}
            loadingLabel="Procesando"
            onClick={() => void confirm()}
          >
            {pending === "start" ? "Iniciar evento" : "Reiniciar"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
