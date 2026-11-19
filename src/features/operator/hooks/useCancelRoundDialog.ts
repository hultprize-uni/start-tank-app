import { useCallback, useState } from "react";

import type { CancelMode } from "../types";

/** Paso del diálogo de anulación: elegir el modo, o confirmar el modo elegido. */
export type CancelStep = "choose" | "confirm";

export interface CancelRoundDialogState {
  step: CancelStep;
  /** Modo elegido en el primer paso. Es null mientras no se haya elegido. */
  mode: CancelMode | null;
  /** Avanza al paso de confirmación con el modo indicado. */
  choose: (mode: CancelMode) => void;
  /** Regresa al paso de elección y descarta el modo seleccionado. */
  back: () => void;
}

/**
 * Estado del diálogo de anulación en dos pasos. El diálogo se monta al abrirse, por lo que el paso
 * inicial se restablece en cada apertura. Solo la confirmación del segundo paso invoca la anulación.
 */
export function useCancelRoundDialog(): CancelRoundDialogState {
  const [step, setStep] = useState<CancelStep>("choose");
  const [mode, setMode] = useState<CancelMode | null>(null);

  const choose = useCallback((next: CancelMode) => {
    setMode(next);
    setStep("confirm");
  }, []);

  const back = useCallback(() => {
    setMode(null);
    setStep("choose");
  }, []);

  return { step, mode, choose, back };
}
