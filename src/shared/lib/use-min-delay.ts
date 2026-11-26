import { useEffect, useState } from "react";

/**
 * Devuelve verdadero cuando `ready` es verdadero y además pasaron `ms` milisegundos desde el
 * montaje. Sirve para que un loader de entrada no destelle cuando la carga es instantánea.
 */
export function useMinDelay(ready: boolean, ms: number): boolean {
  const [elapsed, setElapsed] = useState(ms <= 0);

  useEffect(() => {
    const id = window.setTimeout(() => setElapsed(true), ms);
    return () => window.clearTimeout(id);
  }, [ms]);

  return ready && elapsed;
}

/** Un ciclo completo del StartTankLoader en bucle (--cycle: 3.4s): despegue, mordida y salida. En las pruebas es 0 para no esperar la animación. */
export const LOADER_MIN_MS = process.env.NODE_ENV === "test" ? 0 : 3_400;
