"use client";

import { useEffect, useState } from "react";
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
  segundosIniciales: number;
}

/*
 * Cuenta local de un segundo. La pantalla la reinicia con cada lectura del
 * estado (la clave cambia con `actualizadoEn`), de modo que la cifra
 * siempre parte del valor recibido de la fuente.
 */
function CuentaRegresiva({ segundosIniciales }: CuentaRegresivaProps) {
  const [restantes, setRestantes] = useState(segundosIniciales);

  useEffect(() => {
    const id = setInterval(() => {
      setRestantes((segundos) => Math.max(0, segundos - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const inminente = restantes <= UMBRAL_INMINENTE;

  return (
    <section aria-label="Cuenta regresiva de la última llamada">
      <p className={styles.eyebrow}>Última llamada: cierre automático</p>
      <p
        className={`${styles.cifraGrande} ${styles.cifraAcento} ${inminente ? styles.pulso : ""}`}
        role="timer"
      >
        {formatearCuenta(restantes)}
      </p>
      {inminente && restantes > 0 ? (
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
      <CuentaRegresiva key={vm.actualizadoEn} segundosIniciales={vm.segundosRestantes} />
    </>
  );
}
