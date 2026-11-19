"use client";

import { useCallback, useState } from "react";

/** Estado de la hoja de inversión en el móvil, ligado al número de ronda en que se abrió. */
export interface InvestSheetControl {
  /** Verdadero cuando la hoja está abierta para la ronda vigente y el mercado admite inversiones. */
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

/**
 * Controla la hoja de inversión. La hoja se abre para una ronda concreta y deja de mostrarse al
 * cambiar de ronda o al cerrar el mercado, de modo que no reaparece sola en la ronda siguiente.
 */
export function useInvestSheet(roundNumber: number | null, canInvest: boolean): InvestSheetControl {
  const [openRound, setOpenRound] = useState<number | null>(null);

  const open = useCallback(() => setOpenRound(roundNumber), [roundNumber]);
  const close = useCallback(() => setOpenRound(null), []);

  return {
    isOpen: canInvest && roundNumber !== null && openRound === roundNumber,
    open,
    close,
  };
}
