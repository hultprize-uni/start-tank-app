"use client";

import { useState, type FormEvent } from "react";

import styles from "./AccessGate.module.css";

interface AccessGateProps {
  /** Valida el código ingresado. Devuelve el mensaje de error, o null cuando el acceso se concede. */
  onSubmit: (code: string) => Promise<string | null>;
  /** Aviso mostrado al llegar al acceso, por ejemplo cuando la sesión venció. */
  notice?: string | null;
}

/** Pantalla de acceso al portal del operador mediante código de acceso. */
export function AccessGate({ onSubmit, notice = null }: AccessGateProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    const message = await onSubmit(code);
    setSending(false);
    setError(message);
  }

  const message = error ?? notice;

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="acceso-operador">
        <p className="st-eyebrow">Portal del operador</p>
        <h1 id="acceso-operador" className={styles.title}>
          Acceso a la consola
        </h1>
        <p className={styles.lead}>
          Ingresa el código de acceso para operar la ronda en curso.
        </p>
        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label htmlFor="codigo-operador" className={styles.label}>
            Código de acceso
          </label>
          <input
            id="codigo-operador"
            name="codigo"
            type="password"
            autoComplete="off"
            className={styles.input}
            value={code}
            onChange={(event) => setCode(event.target.value)}
            aria-invalid={error !== null}
            aria-describedby={message ? "codigo-error" : undefined}
          />
          {message ? (
            <p id="codigo-error" className={styles.error} role="alert">
              {message}
            </p>
          ) : null}
          <button
            type="submit"
            className={styles.submit}
            disabled={code.trim().length === 0 || sending}
          >
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
