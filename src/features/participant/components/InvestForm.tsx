"use client";

import { AmountField, Button } from "@/shared/ui";
import { JURY_SIZE, useInvestForm } from "../hooks/useInvestForm";
import type { InvestmentResult, WalletInfo } from "../types";
import styles from "./InvestForm.module.css";

interface InvestFormProps {
  wallet: WalletInfo;
  /** Envía el monto validado. Devuelve el resultado que muestra el portal. */
  onConfirm: (amount: number) => Promise<InvestmentResult>;
}

/** Formulario de monto: campo con atajos, vista previa del retorno según el jurado y confirmación. */
export function InvestForm({ wallet, onConfirm }: InvestFormProps) {
  const form = useInvestForm(wallet, onConfirm);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void form.submit();
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <AmountField
        name="amount"
        label="Monto a invertir"
        value={form.draft}
        onChange={form.setDraft}
        placeholder="0"
        suffix="coins"
        error={form.errorMessage}
        shortcuts={form.shortcuts}
        shortcutsLabel="Atajos de monto"
      />

      <div className={styles.preview} role="group" aria-label="Retorno según el jurado">
        <p className={styles.previewTitle}>Retorno según el jurado</p>
        {form.preview.map((row) => (
          <div key={row.backs} className={styles.row}>
            <span className={styles.scenario}>
              {row.backs} de {JURY_SIZE} respaldan · {row.multiplierText}
            </span>
            <span className={`${styles.value} ${styles[row.tone]}`}>{row.payoutText ?? "—"}</span>
          </div>
        ))}
      </div>

      <p className={styles.note}>No podrás retirar tu inversión antes del veredicto.</p>

      <Button
        type="submit"
        variant="primary"
        size="lg"
        fullWidth
        disabled={!form.canSubmit}
        loading={form.pending}
        loadingLabel="Enviando inversión"
      >
        Confirmar inversión
      </Button>
    </form>
  );
}
