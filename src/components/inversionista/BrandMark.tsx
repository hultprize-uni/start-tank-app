import styles from "./BrandMark.module.css";

interface BrandMarkProps {
  size?: "sm" | "md";
}

/** Marca Start Tank: isotipo degradado y nombre del evento. */
export function BrandMark({ size = "md" }: BrandMarkProps) {
  return (
    <div className={`${styles.brand} ${styles[size]}`}>
      <span className={styles.mark} aria-hidden="true" />
      <span className={styles.name}>Start Tank</span>
    </div>
  );
}
