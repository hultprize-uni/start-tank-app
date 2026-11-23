"use client";

import { Dialog } from "@/shared/ui";
import type { InvestmentResult, StartupInfo, WalletInfo } from "../types";
import { InvestForm } from "./InvestForm";
import styles from "./InvestModal.module.css";

interface InvestModalProps {
  open: boolean;
  onClose: () => void;
  startup: StartupInfo;
  wallet: WalletInfo;
  /** En el teléfono la ventana sube desde abajo; en el escritorio aparece centrada. */
  isDesktop: boolean;
  onConfirm: (amount: number) => Promise<InvestmentResult>;
}

/**
 * Ventana de inversión de tamaño medio (RF-12): logo, ODS y descripción de la startup arriba, y el
 * formulario en dos pasos debajo. El formulario se monta solo con la ventana abierta, así el monto
 * en borrador se descarta al cerrar.
 */
export function InvestModal({ open, onClose, startup, wallet, isDesktop, onConfirm }: InvestModalProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Invertir en ${startup.name}`}
      description={startup.sdg}
      placement={isDesktop ? "center" : "bottom"}
      panelClassName={styles.panel}
      closeOnBackdrop
      lead={
        <div className={styles.logo} aria-hidden="true">
          {startup.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- logos externos de tamaño fijo
            <img src={startup.logoUrl} alt="" width={56} height={56} />
          ) : (
            <span>{startup.name.slice(0, 1)}</span>
          )}
        </div>
      }
    >
      {startup.description ? <p className={styles.description}>{startup.description}</p> : null}
      {open ? <InvestForm startupName={startup.name} wallet={wallet} onConfirm={onConfirm} /> : null}
    </Dialog>
  );
}
