import type { Cierre } from "@/lib/api/screen.types";
import { formatearEntero, formatearPorcentaje } from "./formato";
import styles from "./pantalla.module.css";

interface FaseCierreProps {
  vm: Cierre;
}

/** Fase Cierre del evento: startup ganadora, top 3 de inversionistas y mejor ojo. */
export function FaseCierre({ vm }: FaseCierreProps) {
  const { ganadora } = vm;
  const puntos = Math.round(ganadora.puntaje * 100);

  return (
    <>
      <section className={styles.ganadora} aria-label="Startup ganadora">
        <p className={styles.eyebrow}>Startup ganadora</p>
        <h1 className={`${styles.titulo} ${styles.tituloGanadora}`}>{ganadora.nombre}</h1>
        <p className={styles.insignia}>
          ODS {ganadora.ods.numero}: {ganadora.ods.nombre}
        </p>
        <p className={`${styles.cifraGrande} ${styles.acentoAmarillo}`}>
          {puntos} <span className={styles.subtitulo}>de 100 puntos</span>
        </p>
        <p className={styles.subtitulo}>
          {formatearPorcentaje(ganadora.fraccionRespaldo)} de respaldo del jurado y{" "}
          {formatearPorcentaje(ganadora.porcentajeInversores)} de la sala invirtió
        </p>
      </section>
      <div className={styles.rejilla}>
        {vm.top3.map((fila) => (
          <article key={fila.posicion} className={styles.tarjeta}>
            <p className={styles.eyebrow}>Puesto {fila.posicion}</p>
            <p className={styles.subtitulo}>{fila.nombre}</p>
            <p className={`${styles.valorTarjeta} ${styles.acentoCyan}`}>
              {formatearEntero(fila.saldo)} IC
            </p>
          </article>
        ))}
      </div>
      <article className={styles.tarjeta} aria-label="Mejor ojo">
        <p className={styles.eyebrow}>Mejor ojo</p>
        <p className={styles.subtitulo}>
          {vm.mejorOjo.nombre} con {vm.mejorOjo.aciertos} aciertos
        </p>
      </article>
    </>
  );
}
