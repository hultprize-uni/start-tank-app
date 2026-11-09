"use client";

import type { UltimaLlamada } from "@/lib/api/screen.types";
import { CabeceraRonda } from "./CabeceraRonda";
import { MetricasMercado } from "./MetricasMercado";
import styles from "./pantalla.module.css";

/** Umbral en segundos a partir del cual la cuenta se muestra como cierre inminente. */
const UMBRAL_INMINENTE = 10;

function formatearCuenta(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  const resto = String(segundos % 60).padStart(2, "0");
  return `${String(minutos).padStart(2, "0")}:${resto}`;
}

interface CuentaRegresivaProps {
  /** Segundos restantes calculados por el hook con la hora del servidor. */
  segundos: number;
}

/* Presenta la cuenta recibida. El hook `useScreenState` la recalcula cada segundo. */
function CuentaRegresiva({ segundos }: CuentaRegresivaProps) {
  const inminente = segundos <= UMBRAL_INMINENTE;

  return (
    <section aria-label="Cuenta regresiva de la última llamada">
      <p className={styles.eyebrow}>Última llamada: cierre automático</p>
      <p
        className={`${styles.cifraGrande} ${styles.cifraAcento} ${inminente ? styles.pulso : ""}`}
        role="timer"
      >
        {formatearCuenta(segundos)}
      </p>
      {inminente && segundos > 0 ? (
        <p className={styles.subtitulo}>El mercado cierra en segundos.</p>
      ) : null}
    </section>
  );
}

interface FaseUltimaLlamadaProps {
  vm: UltimaLlamada;
}

/** Fase Última llamada: cuenta regresiva de 60 segundos sobre el precio vigente. */
export function FaseUltimaLlamada({ vm }: FaseUltimaLlamadaProps) {
  return (
    <>
      <CabeceraRonda ronda={vm.ronda} />
      <MetricasMercado
        precio={vm.precio}
        acumulado={vm.acumulado}
        inversoresUnicos={vm.inversoresUnicos}
      />
      <CuentaRegresiva segundos={vm.segundosRestantes} />
    </>
  );
}
