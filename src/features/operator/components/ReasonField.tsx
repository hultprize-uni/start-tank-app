"use client";

import { useId } from "react";

import styles from "./Admin.module.css";

interface ReasonFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  /** Muestra el aviso de motivo obligatorio. */
  showRequired?: boolean;
}

/** Campo de motivo obligatorio. El texto queda en el log de acciones (RF-09). */
export function ReasonField({
  value,
  onChange,
  label = "Motivo (queda en el log)",
  placeholder,
  showRequired = false,
}: ReasonFieldProps) {
  const id = useId();
  const errorId = `${id}-error`;
  const missing = showRequired && value.trim() === "";
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <textarea
        id={id}
        className={styles.textarea}
        value={value}
        placeholder={placeholder}
        maxLength={500}
        required
        aria-invalid={missing}
        aria-describedby={missing ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
      {missing ? (
        <p id={errorId} className={styles.error}>
          Escribe el motivo para continuar.
        </p>
      ) : null}
    </div>
  );
}
