import { useEffect, useState } from "react";

/** Situación de la sesión del operador al cargar el portal. */
export type OperatorSessionStatus = "checking" | "anonymous" | "authorized";

export interface OperatorSessionState {
  status: OperatorSessionStatus;
  /** Cambia la situación de la sesión, por ejemplo tras un acceso o al cerrar sesión. */
  setStatus: (status: OperatorSessionStatus) => void;
}

/**
 * Restaura la sesión del operador al montar el portal. La comprobación la realiza la función
 * recibida, que devuelve true cuando la cookie de sesión sigue siendo válida. Mientras se
 * verifica, la situación es "checking"; si la comprobación falla, el acceso se muestra.
 */
export function useSessionRestore(
  checkSession: () => Promise<boolean>,
): OperatorSessionState {
  const [status, setStatus] = useState<OperatorSessionStatus>("checking");

  useEffect(() => {
    let active = true;
    checkSession()
      .then((valid) => {
        if (active) setStatus(valid ? "authorized" : "anonymous");
      })
      .catch(() => {
        if (active) setStatus("anonymous");
      });
    return () => {
      active = false;
    };
  }, [checkSession]);

  return { status, setStatus };
}
