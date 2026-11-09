"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth/neon-auth-client";
import { ActionButton } from "./ActionButton";
import styles from "./PortalHeader.module.css";

/** Cierra la sesión de Neon Auth y devuelve al inversionista a la pantalla de ingreso. */
export function SignOutButton() {
  const [pending, setPending] = useState(false);

  const signOut = async () => {
    setPending(true);
    try {
      await authClient.signOut();
    } finally {
      window.location.assign("/");
    }
  };

  return (
    <ActionButton variant="ghost" size="md" onClick={signOut} disabled={pending} className={styles.signOut}>
      Cerrar sesión
    </ActionButton>
  );
}
