"use client";

import { AmountField, Button } from "@/shared/ui";
import { useInvestForm } from "../hooks/useInvestForm";
import type { InvestmentResult, WalletInfo } from "../types";
import { InvestConfirm } from "./InvestConfirm";
import { InvestPreview } from "./InvestPreview";
import styles from "./InvestForm.module.css";

interface InvestFormProps {
  startupName: string;
  wallet: WalletInfo;
  /** Envía el monto validado. Devuelve el resultado que muestra el portal. */
  onConfirm: (amount: number) => Promise<InvestmentResult>;
}

/** Formulario en dos pasos: elegir el monto con su vista previa, y confirmar (RF-12, RF-24). */
export function InvestForm({ startupName, wallet, onConfirm }: InvestFormProps) {
  const form = useInvestForm(wallet, onConfirm);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (form.step === "amount") form.review();
    else void form.submit();
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      {form.step === "amount" ? (
        <>
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
            hint={`Tu tope en esta ronda: ${form.maxAmount.toLocaleString("en-US")} coins`}
          />
          <InvestPreview rows={form.preview} />
          <Button type="submit" variant="primary" size="lg" fullWidth disabled={!form.canReview}>
            Revisar inversión
          </Button>
        </>
      ) : (
        <InvestConfirm
          amount={form.amount}
          startupName={startupName}
          balanceAfter={wallet.balance - form.amount}
          pending={form.pending}
          onBack={form.back}
        />
      )}
    </form>
  );
}
