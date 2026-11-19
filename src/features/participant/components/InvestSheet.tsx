"use client";

import { BottomSheet } from "@/shared/ui";
import type { InvestmentResult, WalletInfo } from "../types";
import { InvestForm } from "./InvestForm";

interface InvestSheetProps {
  open: boolean;
  onClose: () => void;
  startupName: string;
  wallet: WalletInfo;
  onConfirm: (amount: number) => Promise<InvestmentResult>;
}

/**
 * Hoja inferior para inversión en el móvil. El formulario se monta solo mientras la hoja está abierta,
 * de modo que el monto en borrador se descarta al cerrarla.
 */
export function InvestSheet({ open, onClose, startupName, wallet, onConfirm }: InvestSheetProps) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="¿Cuánto inviertes?"
      description={`en ${startupName}`}
      closeOnBackdrop
    >
      <InvestForm wallet={wallet} onConfirm={onConfirm} />
    </BottomSheet>
  );
}
