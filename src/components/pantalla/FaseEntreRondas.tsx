import type { EntreRondas } from "@/lib/api/screen.types";
import { formatearEntero } from "./formato";
import styles from "./pantalla.module.css";

/** Filas visibles por leaderboard. La pantalla muestra el total en el pie. */
const FILAS_VISIBLES = 10;

interface FaseEntreRondasProps {
  vm: EntreRondas;
}

/*
 * Fase Entre rondas: clasificacion de los inversionistas y acumulado de cada
 * startup hasta la ronda cerrada.
 */
export function FaseEntreRondas({ vm }: FaseEntreRondasProps) {
  const inversionistas = vm.inversionistas.slice(0, FILAS_VISIBLES);
  const startups = vm.startups.slice(0, FILAS_VISIBLES);

  return (
    <>
      <section>
        <p className={styles.eyebrow}>Ronda {vm.rondaCerrada.numero} cerrada</p>
        <h1 className={styles.titulo}>Clasificación</h1>
      </section>
      <div className={styles.rejillaDos}>
        <section className={styles.tablaLista} aria-labelledby="titulo-inversionistas">
          <h2 id="titulo-inversionistas" className={styles.subtitulo}>
            Inversionistas
          </h2>
          <ol className={styles.lista}>
            {inversionistas.map((fila) => (
              <li key={fila.posicion} className={styles.fila}>
                <span>
                  {fila.posicion}. {fila.nombre}
                </span>
                <span className={styles.valorFila}>{formatearEntero(fila.saldo)} IC</span>
              </li>
            ))}
          </ol>
          <p className={styles.pie}>
            Mostrando {inversionistas.length} de {vm.inversionistas.length} inversionistas
          </p>
        </section>
        <section className={styles.tablaLista} aria-labelledby="titulo-startups">
          <h2 id="titulo-startups" className={styles.subtitulo}>
            Startups
          </h2>
          <ol className={styles.lista}>
            {startups.map((fila) => (
              <li key={fila.posicion} className={styles.fila}>
                <span>
                  {fila.posicion}. {fila.nombre}
                </span>
                <span className={styles.valorFila}>
                  {formatearEntero(fila.acumulado)} IC · precio {formatearEntero(fila.precio)}
                </span>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
