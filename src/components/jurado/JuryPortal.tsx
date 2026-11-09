"use client";

import { useJuryState } from "@/lib/api/jury.mock";
import { AccessForm } from "./AccessForm";
import { JuryShell } from "./JuryShell";
import { VotePanel } from "./VotePanel";
import { VoteRegistered } from "./VoteRegistered";
import { WaitingScreen } from "./WaitingScreen";

/** Contenedor del portal del jurado: obtiene el estado y elige la pantalla visible. */
export function JuryPortal() {
  const { state, actions } = useJuryState();

  return (
    <JuryShell jurorLabel={state.jurorLabel}>
      {state.screen === "acceso" && (
        <AccessForm access={state.access} onSubmit={actions.submitCode} />
      )}

      {state.screen === "espera" && state.round !== null && (
        <WaitingScreen round={state.round} criteria={state.criteria} />
      )}

      {state.screen === "votacion" && state.round !== null && (
        <VotePanel
          round={state.round}
          criteria={state.criteria}
          vote={state.vote}
          onSelect={actions.selectDecision}
          onRequestConfirm={actions.requestConfirm}
          onCancelConfirm={actions.cancelConfirm}
          onConfirm={actions.confirmVote}
        />
      )}

      {state.screen === "voto_registrado" && state.round !== null && (
        <VoteRegistered round={state.round} votes={state.votes} />
      )}
    </JuryShell>
  );
}
