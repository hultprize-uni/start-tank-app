"use client";

import { useId, useState, type FormEvent } from "react";
import { BrandLogo, Button } from "@/shared/ui";
import { USE_MOCKS } from "@/shared/lib/env";
import type { JuryAccessView } from "../types";
import styles from "./AccessForm.module.css";

interface AccessFormProps {
  access: JuryAccessView;
  onSubmit: (code: string) => void;
}

/** Longitud máxima del código de acceso. */
export const ACCESS_CODE_MAX_LENGTH = 32;

/** Caracteres admitidos en el código: letras, dígitos, guiones y espacios. */
const DISALLOWED_CODE_CHARACTERS = /[^\p{L}\p{N}\- ]/gu;

/**
 * Filtra la entrada del campo: conserva letras, dígitos, guiones y espacios, y limita la longitud.
 * No modifica las mayúsculas.
 */
export function sanitizeAccessCode(raw: string): string {
  return raw.replace(DISALLOWED_CODE_CHARACTERS, "").slice(0, ACCESS_CODE_MAX_LENGTH);
}

/** Normaliza el código antes de enviarlo: recorta los extremos y colapsa los espacios internos. */
export function normalizeAccessCode(code: string): string {
  return code.trim().replace(/\s+/g, " ");
}

/** Pantalla de acceso con código personal del jurado. */
export function AccessForm({ access, onSubmit }: AccessFormProps) {
  const [code, setCode] = useState("");
  const errorId = useId();
  const titleId = useId();
  const isValidating = access.status === "validating";
  const hasError = access.errorMessage !== null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isValidating) return;
    onSubmit(normalizeAccessCode(code));
  }

  return (
    <section className={styles.layout} aria-labelledby={titleId}>
      <div className={styles.hero} aria-hidden="true">
        <BrandLogo variant="vertical" alt="" className={styles.float} />
      </div>

      <div className={styles.panel}>
        <BrandLogo variant="horizontal" alt="Start Tank" className={styles.mobileLogo} />
        <p className={styles.eyebrow}>Portal del jurado</p>
        <h1 id={titleId} className={styles.title}>
          Tu voto define el retorno.
        </h1>
        <p className={styles.lead}>
          Ingresa con tu código personal. Este portal solo registra votos.
        </p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <label htmlFor={`${titleId}-codigo`} className="visually-hidden">
            Código de acceso
          </label>
          <input
            id={`${titleId}-codigo`}
            className={styles.input}
            type="text"
            value={code}
            placeholder="Código de acceso"
            autoComplete="off"
            maxLength={ACCESS_CODE_MAX_LENGTH}
            spellCheck={false}
            disabled={isValidating}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : undefined}
            onChange={(event) => setCode(sanitizeAccessCode(event.target.value))}
          />
          {hasError && (
            <p id={errorId} className={styles.error} role="alert">
              {access.errorMessage}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            fullWidth
            loading={isValidating}
            loadingLabel="Validando código"
          >
            Entrar
          </Button>
        </form>

        {USE_MOCKS && (
          <p className={styles.hint}>Demo: usa JUR-1, JUR-2, JUR-3 o JUR-4.</p>
        )}
      </div>
    </section>
  );
}
