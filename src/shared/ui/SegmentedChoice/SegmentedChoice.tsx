"use client";

import { useId, type ReactNode } from "react";
import styles from "./SegmentedChoice.module.css";

export interface SegmentedChoiceOption<T extends string = string> {
  /** Valor que representa la opción. Debe ser único dentro del grupo. */
  value: T;
  /** Texto visible de la opción. */
  label: ReactNode;
  /** Impide seleccionar la opción. */
  disabled?: boolean;
}

export interface SegmentedChoiceProps<T extends string = string> {
  /** Nombre accesible del grupo. Es obligatorio para identificar la elección. */
  label: string;
  /** Opciones disponibles, en orden de presentación. */
  options: SegmentedChoiceOption<T>[];
  /** Valor seleccionado. */
  value: T;
  /** Se invoca con el valor de la opción elegida. */
  onChange: (value: T) => void;
  /** Deshabilita todas las opciones del grupo. */
  disabled?: boolean;
  className?: string;
}

/**
 * Selector de una sola opción con semántica role="radiogroup". Usa botones de radio nativos,
 * de modo que el teclado (flechas, Tab y Espacio) funciona sin código adicional.
 */
export function SegmentedChoice<T extends string = string>({
  label,
  options,
  value,
  onChange,
  disabled = false,
  className,
}: SegmentedChoiceProps<T>) {
  const groupName = useId();
  const classes = [styles.group, className].filter(Boolean).join(" ");

  return (
    <div role="radiogroup" aria-label={label} className={classes}>
      {options.map((option) => {
        const checked = option.value === value;
        const optionDisabled = disabled || option.disabled === true;
        const optionClasses = [
          styles.option,
          checked ? styles.selected : null,
          optionDisabled ? styles.optionDisabled : null,
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <label key={option.value} className={optionClasses}>
            <input
              type="radio"
              className={styles.input}
              name={groupName}
              value={option.value}
              checked={checked}
              disabled={optionDisabled}
              onChange={() => onChange(option.value)}
            />
            <span className={styles.text}>{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}
