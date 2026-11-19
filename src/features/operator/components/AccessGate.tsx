"use client";

import type { FormEvent } from "react";

import { AnimatedBackground, BrandLogo, Button, Eyebrow, Toast } from "@/shared/ui";

import { useAccessCode } from "../hooks/useAccessCode";

import styles from "./AccessGate.module.css";

interface AccessGateProps {
  /** Valida el código ingresado. Devuelve el mensaje de error, o null cuando el acceso se concede. */
  onSubmit: (code: string) => Promise<string | null>;
  /** Aviso mostrado al llegar al acceso, por ejemplo cuando la sesión venció. */
  notice?: string | null;
  /** Código de demostración visible solo con los datos de muestra. */
  demoCode?: string;
}

/** Pantalla de acceso al portal del operador mediante código de acceso. */
export function AccessGate({ onSubmit, notice = null, demoCode }: AccessGateProps) {
  const access = useAccessCode(onSubmit);
  const message = access.error ?? notice;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void access.submit();
  }

  return (
    <main className={styles.page}>
      <AnimatedBackground />
      <div className={styles.layout}>
        <div className={styles.intro}>
          <BrandLogo variant="horizontal" priority className={styles.logo} />
          <Eyebrow>Portal del operador</Eyebrow>
          <h1 className={styles.title}>Tú conduces el evento.</h1>
          <p className={styles.lead}>
            Ingresa con el código del equipo organizador. Cada acción queda registrada.
          </p>
        </div>

        <section className={styles.card} aria-labelledby="acceso-operador">
          <h2 id="acceso-operador" className={styles.cardTitle}>
            Acceso a la consola
          </h2>
          {notice && access.error === null ? (
            <Toast tone="warning" role="status">
              {notice}
            </Toast>
          ) : null}
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <label htmlFor="codigo-operador" className={styles.label}>
              Código de acceso
            </label>
            <input
              id="codigo-operador"
              name="codigo"
              type="password"
              autoComplete="off"
              placeholder="Código de acceso"
              className={styles.input}
              value={access.code}
              onChange={(event) => access.changeCode(event.target.value)}
              aria-invalid={access.error !== null}
              aria-describedby={message ? "codigo-error" : undefined}
            />
            {access.error !== null ? (
              <div id="codigo-error">
                <Toast tone="negative" role="alert">
                  {access.error}
                </Toast>
              </div>
            ) : null}
            <Button
              type="submit"
              size="lg"
              fullWidth
              loading={access.sending}
              loadingLabel="Verificando el código"
              disabled={!access.canSubmit}
            >
              Entrar
            </Button>
          </form>
          {demoCode !== undefined ? (
            <p className={styles.demo}>Demo: {demoCode}</p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
