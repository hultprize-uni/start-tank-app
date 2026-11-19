"use client";

import { useId, type ReactNode } from "react";
import { Button } from "../Button";
import styles from "./AmountField.module.css";

export interface AmountShortcut {
  /** Texto visible del atajo. */
  label: ReactNode;
  /** Valor que se asigna al campo al pulsar el atajo. */
  value: string;
}

export interface AmountFieldProps {
  /** Etiqueta visible asociada al campo. */
  label: ReactNode;
  /** Valor actual del campo, como cadena para conservar lo escrito. */
  value: string;
  /** Se invoca con el nuevo valor cada vez que cambia el campo o se pulsa un atajo. */
  onChange: (value: string) => void;
  /** Texto de ayuda que describe el campo. Se enlaza mediante aria-describedby. */
  hint?: ReactNode;
  /** Mensaje de error. Activa aria-invalid y se enlaza mediante aria-describedby. */
  error?: ReactNode;
  /** Texto que acompaña al número, por ejemplo una unidad monetaria. */
  suffix?: ReactNode;
  /** Atajos que asignan un valor predefinido, por ejemplo montos sugeridos. */
  shortcuts?: AmountShortcut[];
  /** Nombre accesible del grupo de atajos. Obligatorio cuando se reciben atajos. */
  shortcutsLabel?: string;
  /** Texto de marcador cuando el campo está vacío. */
  placeholder?: string;
  /** Valor mínimo permitido, aplicado como atributo del campo. */
  min?: number;
  /** Valor máximo permitido, aplicado como atributo del campo. */
  max?: number;
  /** Incremento del campo. Predeterminado: 1. */
  step?: number;
  /** Nombre del campo en formularios. */
  name?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Campo numérico con etiqueta, ayuda, error asociado mediante aria-describedby,
 * sufijo y atajos de monto. Se usa de forma controlada.
 */
export function AmountField({
  label,
  value,
  onChange,
  hint,
  error,
  suffix,
  shortcuts,
  shortcutsLabel,
  placeholder,
  min,
  max,
  step = 1,
  name,
  disabled = false,
  className,
}: AmountFieldProps) {
  const inputId = useId();
  const hintId = useId();
  const errorId = useId();

  const describedBy = [hint ? hintId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={[styles.field, className].filter(Boolean).join(" ")}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>

      <div className={[styles.control, error ? styles.controlInvalid : null, disabled ? styles.controlDisabled : null].filter(Boolean).join(" ")}>
        <input
          id={inputId}
          name={name}
          type="number"
          inputMode="decimal"
          className={styles.input}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
        />
        {suffix ? <span className={styles.suffix}>{suffix}</span> : null}
      </div>

      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      ) : null}

      {shortcuts && shortcuts.length > 0 ? (
        <div role="group" aria-label={shortcutsLabel} className={styles.shortcuts}>
          {shortcuts.map((shortcut) => (
            <Button
              key={shortcut.value}
              type="button"
              variant="ghost"
              size="md"
              disabled={disabled}
              onClick={() => onChange(shortcut.value)}
            >
              {shortcut.label}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
