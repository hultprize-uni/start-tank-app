"use client";

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react";
import { BrandLogo, StartTankLoader } from "@/shared/ui";
import { LOADER_MIN_MS, useMinDelay } from "@/shared/lib/use-min-delay";
import { PAGE_ROUTES } from "@/shared/lib/api-routes";
import { useScreenState } from "../hooks/useScreenState";
import type { ScreenViewModel } from "../types";
import { StartupTicker } from "./parts";
import { BetweenPhase, ClosingPhase, MarketPhase, Rail, RevealPhase, VotingPhase, WaitingPhase } from "./phases";
import s from "./stage.module.css";

const STAGE_W = 1920;
const STAGE_H = 1080;

interface StageFit {
  scale: number;
  width: number;
  top: number;
}

/**
 * Escala el escenario para que 1920×1080 quepa entero. En pantallas más anchas estira el ancho, así
 * llena la ventana sin bandas laterales; en las más altas centra el bloque, porque estirar el alto
 * solo deja espacio vacío. Se mide antes de pintar para que no salte.
 */
function useStageFit(): StageFit | null {
  const [fit, setFit] = useState<StageFit | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
      setFit({ scale, width: window.innerWidth / scale, top: (window.innerHeight - STAGE_H * scale) / 2 });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return fit;
}

function renderPhase(vm: ScreenViewModel): ReactNode {
  switch (vm.phase) {
    case "WAITING":
      return <WaitingPhase vm={vm} />;
    case "MARKET":
    case "LAST_CALL":
    case "REVEAL":
      // El panel lateral queda en la misma posición del árbol: la tabla no se vuelve a montar.
      return (
        <div className={s.split}>
          {vm.phase === "REVEAL" ? <RevealPhase vm={vm} /> : <MarketPhase vm={vm} />}
          <Rail vm={vm} />
        </div>
      );
    case "VOTING":
      return <VotingPhase vm={vm} />;
    case "BETWEEN":
      return <BetweenPhase vm={vm} />;
    case "CLOSING":
      return <ClosingPhase vm={vm} />;
  }
}

/** Pantalla pública del escenario (RF-25): sin sesión y sin escrituras. */
export function ScreenClient() {
  const { vm, offline, empty } = useScreenState();
  const fit = useStageFit();
  const [joinHost, setJoinHost] = useState("");
  useEffect(() => setJoinHost(`${window.location.host}${PAGE_ROUTES.participant}`), []);
  // El loader de entrada cubre la medición del escenario y la primera lectura del evento.
  const ready = useMinDelay(fit !== null && (vm !== null || empty), LOADER_MIN_MS);

  return (
    <main className={s.viewport}>
      <div
        className={s.stage}
        style={
          fit
            ? { width: fit.width, top: fit.top, transform: `scale(${fit.scale})` }
            : { visibility: "hidden" }
        }
        data-phase={vm?.phase ?? "LOADING"}
      >
        <header className={s.top}>
          <BrandLogo variant="horizontal" className={s.logo} priority />
          {vm ? <StartupTicker items={vm.ticker} /> : <span />}
          <div className={s.join}>
            <span className={s.label}>Entra e invierte</span>
            <span className={s.joinUrl}>{joinHost}</span>
          </div>
        </header>

        {vm?.manualMode ? (
          <p className={s.manual} role="status">
            Modo manual activo: el conductor registra el veredicto a mano.
          </p>
        ) : null}

        <div className={s.body}>
          {vm ? (
            renderPhase(vm)
          ) : (
            <section className={s.center}>
              <p className={s.calm}>{empty ? "El evento aún no tiene rondas cargadas." : "Conectando con el evento."}</p>
            </section>
          )}
        </div>

        {offline ? (
          <p className={s.offline} role="status">
            Sin conexión. Se muestra la última lectura.
          </p>
        ) : null}
      </div>

      {!ready ? (
        <div className={s.loading}>
          <StartTankLoader label="Conectando con el evento..." className={s.loader} />
        </div>
      ) : null}
    </main>
  );
}
