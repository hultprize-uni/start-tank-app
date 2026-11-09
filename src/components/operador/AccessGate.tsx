"use client";

import { useState, type FormEvent } from "react";

import styles from "./AccessGate.module.css";

interface AccessGateProps {
  /** Valida el código ingresado. Devuelve el mensaje de error, o null cuando el acceso se concede. */
  onSubmit: (code: string) => Promise<string | null>;
  /** Aviso mostrado al llegar al acceso, por ejemplo cuando la sesión venció. */
  aviso?: string | null;
}

/** Pantalla de acceso al portal del operador mediante código de acceso. */
export function AccessGate({ onSubmit, aviso = null }: AccessGateProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando) return;
    setEnviando(true);
    const mensaje = await onSubmit(code);
    setEnviando(false);
    setError(mensaje);
  }

  const mensaje = error ?? aviso;

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
            aria-describedby={mensaje ? "codigo-error" : undefined}
          />
          {mensaje ? (
            <p id="codigo-error" className={styles.error} role="alert">
              {mensaje}
            </p>
          ) : null}
          <button
            type="submit"
            className={styles.submit}
            disabled={code.trim().length === 0 || enviando}
          >
            Entrar
          </button>
        </form>
      </section>
    </main>
  );
}
