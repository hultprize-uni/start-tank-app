import { useEffect, useState } from "react";

/**
 * Devuelve verdadero cuando `ready` es verdadero y además pasaron `ms` milisegundos desde el
 * montaje. Sirve para que un loader de entrada no destelle cuando la carga es instantánea.
 */
export function useMinDelay(ready: boolean, ms: number): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setElapsed(true), ms);
    return () => window.clearTimeout(id);
  }, [ms]);

  return ready && elapsed;
}
