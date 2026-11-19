"use client";

import { useJuryState } from "@/lib/api/jury";
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
      {state.screen === "access" && (
        <AccessForm access={state.access} onSubmit={actions.submitCode} />
      )}

      {state.screen === "waiting" && state.round !== null && (
        <WaitingScreen round={state.round} criteria={state.criteria} />
      )}

      {state.screen === "voting" && state.round !== null && (
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

      {state.screen === "vote_registered" && state.round !== null && (
        <VoteRegistered round={state.round} votes={state.votes} />
      )}
    </JuryShell>
  );
}
