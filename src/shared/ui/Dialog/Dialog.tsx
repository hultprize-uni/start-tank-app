"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import styles from "./Dialog.module.css";

export interface DialogProps {
  /** Indica si el diálogo está visible. */
  open: boolean;
  /** Se invoca al pulsar Escape o, si closeOnBackdrop está activo, al hacer clic en el fondo. */
  onClose: () => void;
  /** Título visible, usado como nombre accesible del diálogo. */
  title: ReactNode;
  /** Descripción breve enlazada mediante aria-describedby. */
  description?: ReactNode;
  /** Contenido principal del diálogo. */
  children: ReactNode;
  /** Contenido colocado antes del título, por ejemplo un tirador visual. */
  lead?: ReactNode;
  /** Cierra el diálogo al hacer clic en el fondo. Predeterminado: false. */
  closeOnBackdrop?: boolean;
  /** Ubicación del panel: centrado o anclado a la parte inferior. Predeterminado: "center". */
  placement?: "center" | "bottom";
  /** Clase adicional para el panel. */
  panelClassName?: string;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/** Devuelve los elementos enfocables del contenedor, en orden de tabulación. */
function getFocusable(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !element.hasAttribute("hidden"),
  );
}

/**
 * Diálogo modal accesible. Atrapa el foco dentro del panel, cierra con Escape,
 * bloquea el desplazamiento del fondo y devuelve el foco al elemento que lo abrió.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  lead,
  closeOnBackdrop = false,
  placement = "center",
  panelClassName,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const initialTarget = panel ? (getFocusable(panel)[0] ?? panel) : null;
    initialTarget?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !panel) return;

      const items = getFocusable(panel);
      if (items.length === 0) {
        event.preventDefault();
        panel.focus();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      const insidePanel = active instanceof Node && panel.contains(active);

      if (event.shiftKey && (active === first || !insidePanel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !insidePanel)) {
        event.preventDefault();
        first.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const panelClasses = [
    styles.panel,
    placement === "bottom" ? styles.bottom : null,
    panelClassName,
  ]
    .filter(Boolean)
    .join(" ");

  return createPortal(
    <div className={placement === "bottom" ? `${styles.layer} ${styles.layerBottom}` : styles.layer}>
      <div
        aria-hidden="true"
        className={styles.backdrop}
        onClick={closeOnBackdrop ? () => onCloseRef.current() : undefined}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={panelClasses}
      >
        {lead}
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        {description ? (
          <p id={descriptionId} className={styles.description}>
            {description}
          </p>
        ) : null}
        <div className={styles.body}>{children}</div>
      </div>
    </div>,
    document.body,
  );
}
