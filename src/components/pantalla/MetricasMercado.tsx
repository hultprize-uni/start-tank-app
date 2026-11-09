import styles from "./pantalla.module.css";
import { formatearEntero } from "./formato";

interface MetricasMercadoProps {
  precio: number;
  acumulado: number;
  inversoresUnicos: number;
}

/** Precio en vivo y las dos cifras de participación de la ronda: monto acumulado e inversores únicos. */
export function MetricasMercado({ precio, acumulado, inversoresUnicos }: MetricasMercadoProps) {
  return (
    <div>
      <p className={styles.eyebrow}>Precio en vivo</p>
      <p className={styles.cifraGrande} aria-label={`Precio ${precio}`}>
        {formatearEntero(precio)}
      </p>
      <div className={styles.rejilla}>
        <article className={styles.tarjeta}>
          <p className={styles.eyebrow}>Monto acumulado</p>
          <p className={`${styles.valorTarjeta} ${styles.acentoCyan}`}>
            {formatearEntero(acumulado)} IC
          </p>
        </article>
        <article className={styles.tarjeta}>
          <p className={styles.eyebrow}>Inversores únicos</p>
          <p className={`${styles.valorTarjeta} ${styles.acentoAmarillo}`}>
            {formatearEntero(inversoresUnicos)}
          </p>
        </article>
      </div>
    </div>
  );
}
