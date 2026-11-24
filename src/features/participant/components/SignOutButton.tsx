"use client";

import { useState } from "react";
import { Button } from "@/shared/ui";
import { PAGE_ROUTES } from "@/shared/lib/api-routes";
import { authClient } from "../api/auth-client";

/** Cierra la sesión de Neon Auth y devuelve al inversionista a la pantalla de ingreso. */
export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const [pending, setPending] = useState(false);

  const signOut = async () => {
    setPending(true);
    try {
      await authClient.signOut();
    } finally {
      window.location.assign(PAGE_ROUTES.participant);
    }
  };

  return (
    <Button variant="ghost" size="md" onClick={signOut} disabled={pending}>
      {/* En la cabecera del móvil, "Salir" deja la marca, el saldo y el botón en una sola fila. */}
      {compact ? "Salir" : "Cerrar sesión"}
    </Button>
  );
}
