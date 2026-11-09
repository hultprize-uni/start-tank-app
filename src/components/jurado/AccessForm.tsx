"use client";

import { useRef, useState, type FormEvent } from "react";
import type { JuryAccessView } from "@/lib/api/jury.types";
import styles from "./AccessForm.module.css";

const CODE_LENGTH = 4;

interface AccessFormProps {
  access: JuryAccessView;
  onSubmit: (code: string) => void;
}

/** Formulario de acceso con código de cuatro dígitos. */
export function AccessForm({ access, onSubmit }: AccessFormProps) {
  const [digits, setDigits] = useState<string[]>(
    Array.from({ length: CODE_LENGTH }, () => ""),
  );
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const code = digits.join("");
  const isValidating = access.status === "validando";
  const isComplete = code.length === CODE_LENGTH;

  function updateDigit(index: number, value: string) {
    const digit = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => prev.map((d, i) => (i === index ? digit : d)));
    if (digit !== "" && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, key: string) {
    if (key === "Backspace" && digits[index] === "" && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isComplete || isValidating) return;
    onSubmit(code);
  }

  return (
    <section className={styles.panel} aria-labelledby="acceso-titulo">
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <p className={styles.eyebrow}>Acceso</p>
        <h1 id="acceso-titulo" className={styles.title}>
          Ingresa tu código
        </h1>
        <p className={styles.lead}>
          Usa el código de acceso que te entregó la organización.
        </p>

        <fieldset className={styles.fieldset} disabled={isValidating}>
          <legend className={styles.legend}>Código de cuatro dígitos</legend>
          <div className={styles.digits}>
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(node) => {
                  inputs.current[index] = node;
                }}
                className={styles.digit}
                type="text"
                inputMode="numeric"
                autoComplete={index === 0 ? "one-time-code" : "off"}
                maxLength={1}
                value={digit}
                aria-label={`Dígito ${index + 1} de ${CODE_LENGTH}`}
                aria-invalid={access.status === "error"}
                onChange={(event) => updateDigit(index, event.target.value)}
                onKeyDown={(event) => handleKeyDown(index, event.key)}
              />
            ))}
          </div>
        </fieldset>

        {access.errorMessage !== null && (
          <p className={styles.error} role="alert">
            {access.errorMessage}
          </p>
        )}

        <button
          className={styles.submit}
          type="submit"
          disabled={!isComplete || isValidating}
        >
          {isValidating ? "Validando..." : "Entrar"}
        </button>
      </form>
    </section>
  );
}
