"use client";

import { useState, type FormEvent } from "react";

import type {
  ManualResult,
  ManualSettlementInput,
} from "@/lib/api/operator.types";

import styles from "./OperatorConsole.module.css";

interface ManualSettlementPanelProps {
  onSubmit: (input: ManualSettlementInput) => void;
  onClose: () => void;
}

const MIN_MULTIPLIER = 0.2;
const MAX_MULTIPLIER = 1.8;

/**
 * Formulario de liquidación manual. Reemplaza el cálculo por votos
 * con el multiplicador y el resultado que captura el operador.
 */
export function ManualSettlementPanel({
  onSubmit,
  onClose,
}: ManualSettlementPanelProps) {
  const [multiplierText, setMultiplierText] = useState("1.00");
  const [result, setResult] = useState<ManualResult>("aprobada");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const multiplier = Number(multiplierText.replace(",", "."));
    if (
      !Number.isFinite(multiplier) ||
      multiplier < MIN_MULTIPLIER ||
      multiplier > MAX_MULTIPLIER
    ) {
      setError(
        `El multiplicador debe estar entre ${MIN_MULTIPLIER.toFixed(2)} y ${MAX_MULTIPLIER.toFixed(2)}.`,
      );
      return;
    }
    setError(null);
    onSubmit({ multiplier, result });
  }

  return (
    <section
      className={`${styles.panel} ${styles.manualPanel}`}
      aria-labelledby="modo-manual"
    >
      <div className={styles.panelHeader}>
        <h3 id="modo-manual" className={styles.panelTitle}>
          Modo manual
        </h3>
        <span className={styles.muted}>
          Reemplaza el cálculo por votos para esta ronda.
        </span>
      </div>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <div className={styles.field}>
          <label htmlFor="manual-multiplicador" className={styles.label}>
            Multiplicador
          </label>
          <input
            id="manual-multiplicador"
            name="multiplicador"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            className={styles.input}
            value={multiplierText}
            onChange={(event) => setMultiplierText(event.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="manual-resultado" className={styles.label}>
            Resultado de la ronda
          </label>
          <select
            id="manual-resultado"
            name="resultado"
            className={styles.input}
            value={result}
            onChange={(event) => setResult(event.target.value as ManualResult)}
          >
            <option value="aprobada">Aprobada</option>
            <option value="no_aprobada">No aprobada</option>
          </select>
        </div>
        {error ? (
          <p className={styles.errorText} role="alert">
            {error}
          </p>
        ) : null}
        <div className={styles.formActions}>
          <button type="button" className={styles.button} onClick={onClose}>
            Cerrar
          </button>
          <button
            type="submit"
            className={`${styles.button} ${styles.buttonPrimary}`}
          >
            Aplicar liquidación manual
          </button>
        </div>
      </form>
    </section>
  );
}
