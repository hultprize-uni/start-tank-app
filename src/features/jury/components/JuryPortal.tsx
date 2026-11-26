"use client";

import { StartTankLoader } from "@/shared/ui";
import { LOADER_MIN_MS, useMinDelay } from "@/shared/lib/use-min-delay";
import { useJuryState } from "../hooks/useJuryState";
import { AccessForm } from "./AccessForm";
import { JuryShell } from "./JuryShell";
import { JurySession } from "./JurySession";
import styles from "./JuryPortal.module.css";

/** Contenedor del portal del jurado: obtiene el estado y elige el acceso o la sesión. */
export function JuryPortal() {
  const { state, actions, restoring = false } = useJuryState();
  // El loader de entrada cubre la consulta de la sesión vigente y dura al menos un despegue.
  const ready = useMinDelay(!restoring, LOADER_MIN_MS);

  return (
    <JuryShell>
      {!ready ? (
        <div className={styles.loading}>
          <StartTankLoader label="Cargando el portal del jurado..." />
        </div>
      ) : state.jurorLabel === null ? (
        <AccessForm access={state.access} onSubmit={actions.submitCode} />
      ) : (
        <JurySession jurorLabel={state.jurorLabel} state={state} actions={actions} />
      )}
    </JuryShell>
  );
}
