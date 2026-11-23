import { Button } from "@/shared/ui";
import { formatCoins } from "../format";
import styles from "./InvestForm.module.css";

interface InvestConfirmProps {
  amount: number;
  startupName: string;
  /** Saldo que quedará después de invertir. */
  balanceAfter: number;
  pending: boolean;
  onBack: () => void;
}

/**
 * Segundo paso de la inversión: resume el monto y recuerda que es la única inversión de la ronda y
 * que no se puede retirar. El botón Confirmar envía el formulario que lo contiene.
 */
export function InvestConfirm({ amount, startupName, balanceAfter, pending, onBack }: InvestConfirmProps) {
  return (
    <div className={styles.confirm}>
      <p className={styles.confirmAmount}>
        {formatCoins(amount)} <span className={styles.unit}>coins</span>
      </p>
      <p className={styles.confirmText}>
        en {startupName}. Es tu única inversión de esta ronda y no se puede retirar. Te quedarán{" "}
        {formatCoins(balanceAfter)} coins.
      </p>
      <div className={styles.actions}>
        <Button type="button" variant="ghost" size="lg" onClick={onBack} disabled={pending}>
          Cambiar monto
        </Button>
        <Button type="submit" variant="primary" size="lg" loading={pending} loadingLabel="Enviando inversión">
          Confirmar inversión
        </Button>
      </div>
    </div>
  );
}
