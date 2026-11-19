"use client";

import { useState } from "react";
import { authClient } from "../api/auth-client";
import { EVENT_CONFIG } from "@/shared/domain/config";
import { PAGE_ROUTES } from "@/shared/lib/api-routes";
import { BrandLogo, Button } from "@/shared/ui";
import { formatCoins } from "../format";
import styles from "./LoginScreen.module.css";

const SIGN_IN_ERROR = "No fue posible iniciar sesión. Intenta de nuevo.";

interface LoginScreenProps {
  /** Verdadero para el diseño de escritorio: logotipo vertical a la izquierda y texto a la derecha. */
  isDesktop: boolean;
}

/** Pantalla de ingreso del inversionista. El acceso es solo por OAuth con Google, sin contraseñas. */
export function LoginScreen({ isDesktop }: LoginScreenProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signInWithGoogle = async () => {
    setPending(true);
    setError(null);
    try {
      const { error: signInError } = await authClient.signIn.social({
        provider: "google",
        callbackURL: PAGE_ROUTES.participant,
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
    <section className={isDesktop ? styles.desktop : styles.mobile}>
      {isDesktop ? (
        <BrandLogo variant="vertical" priority className={styles.hero} />
      ) : null}

      <div className={styles.copy}>
        {isDesktop ? null : <BrandLogo variant="horizontal" priority className={styles.logo} />}
        <p className={styles.eyebrow}>Shark Tank Universitario · 26 Nov · Auditorio CTIC</p>
        <h1 className={styles.title}>El público invierte. El jurado decide.</h1>
        <p className={styles.lead}>
          Recibes {formatCoins(EVENT_CONFIG.initialBalance)} Impact Coins. Invierte en las startups que
          te convenzan.
        </p>

        <Button
          variant="primary"
          size="lg"
          fullWidth={!isDesktop}
          onClick={signInWithGoogle}
          disabled={pending}
          loading={pending}
          loadingLabel="Conectando con Google"
        >
          Ingresar con mi cuenta
        </Button>

        {error !== null ? (
          <p className={styles.error} role="alert">
            {error}
          </p>
        ) : null}
        <p className={styles.footnote}>No guardamos contraseñas · Hult Prize at UNI</p>
      </div>
    </section>
  );
}
