import { EVENT_CONFIG } from "@/lib/domain/config";
import { ActionButton } from "./ActionButton";
import { BrandMark } from "./BrandMark";
import { formatCoins } from "./format";
import styles from "./LoginScreen.module.css";

interface LoginScreenProps {
  /** Inicia el flujo de ingreso con el proveedor OAuth. */
  onLogin: () => void;
}

/** Pantalla de ingreso del inversionista. El acceso es solo por OAuth, sin contraseñas. */
export function LoginScreen({ onLogin }: LoginScreenProps) {
  return (
    <section className={styles.screen}>
      <BrandMark size="md" />
      <div className={styles.spacer} />
      <p className={styles.eyebrow}>Shark Tank Universitario · 26 Nov</p>
      <h1 className={styles.title}>El público invierte. El jurado decide.</h1>
      <p className={styles.lead}>
        Recibes {formatCoins(EVENT_CONFIG.initialBalance)} Impact Coins. Invierte en las startups que te convenzan.
      </p>
      <ActionButton variant="primary" size="lg" onClick={onLogin}>
        Ingresar con mi cuenta
      </ActionButton>
      <p className={styles.footnote}>No guardamos contraseñas · Hult Prize at UNI</p>
    </section>
  );
}
