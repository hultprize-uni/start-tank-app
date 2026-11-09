import styles from "./Toast.module.css";

interface ToastProps {
  message: string;
}

/** Aviso breve superpuesto en la parte superior del portal. */
export function Toast({ message }: ToastProps) {
  return (
    <div className={styles.toast} role="status">
      {message}
    </div>
  );
}
