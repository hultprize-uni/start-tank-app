"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/neon-auth-client";
import { EVENT_CONFIG } from "@/lib/domain/config";
import { ActionButton } from "./ActionButton";
import { BrandMark } from "./BrandMark";
import { formatCoins } from "./format";
import styles from "./LoginScreen.module.css";

const SIGN_IN_ERROR = "No fue posible iniciar sesión. Intenta de nuevo.";

/** Pantalla de ingreso del inversionista. El acceso es solo por OAuth con Google, sin contraseñas. */
export function LoginScreen() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setPending(true);
    setError(null);
    try {
      const { error: signInError } = await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
      if (signInError) {
        setError(SIGN_IN_ERROR);
        setPending(false);
      }
    } catch {
      setError(SIGN_IN_ERROR);
      setPending(false);
    }
  };

  return (
    <section className={styles.screen}>
      <BrandMark size="md" />
      <div className={styles.spacer} />
      <p className={styles.eyebrow}>Shark Tank Universitario · 26 Nov</p>
      <h1 className={styles.title}>El público invierte. El jurado decide.</h1>
      <p className={styles.lead}>
        Recibes {formatCoins(EVENT_CONFIG.initialBalance)} Impact Coins. Invierte en las startups que te convenzan.
      </p>
      <ActionButton variant="primary" size="lg" onClick={signInWithGoogle} disabled={pending}>
        Ingresar con mi cuenta
      </ActionButton>
      {error !== null && (
        <p className={styles.footnote} role="alert">
          {error}
        </p>
      )}
      <p className={styles.footnote}>No guardamos contraseñas · Hult Prize at UNI</p>
    </section>
  );
}
