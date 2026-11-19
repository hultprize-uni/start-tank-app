"use client";

import { useJuryState } from "../hooks/useJuryState";
import { AccessForm } from "./AccessForm";
import { JuryShell } from "./JuryShell";
import { JurySession } from "./JurySession";

/** Contenedor del portal del jurado: obtiene el estado y elige el acceso o la sesión. */
export function JuryPortal() {
  const { state, actions } = useJuryState();

  return (
    <JuryShell>
      {state.jurorLabel === null ? (
        <AccessForm access={state.access} onSubmit={actions.submitCode} />
      ) : (
        <JurySession jurorLabel={state.jurorLabel} state={state} actions={actions} />
      )}
    </JuryShell>
  );
}
