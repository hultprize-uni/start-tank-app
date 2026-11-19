import type { JuryActions, JuryViewModel } from "../types";
import { ResultPanel } from "./ResultPanel";
import { VotePanel } from "./VotePanel";
import { VoteRegistered } from "./VoteRegistered";
import { WaitingScreen } from "./WaitingScreen";

interface JuryBodyProps {
  state: JuryViewModel;
  actions: JuryActions;
}

/** Elige la pantalla de la columna principal según la fase y el voto propio. */
export function JuryBody({ state, actions }: JuryBodyProps) {
  const { screen, phase, round } = state;

  if (screen === "voting" && round !== null) {
    return <VotePanel startupName={round.startupName} vote={state.vote} actions={actions} />;
  }
  if (screen === "vote_registered" && state.ownVote !== null) {
    return <VoteRegistered ownVote={state.ownVote} votes={state.votes} />;
  }
  if (screen === "result" && state.reveal !== null) {
    return <ResultPanel reveal={state.reveal} />;
  }
  if (screen === "waiting" && phase !== null) {
    return <WaitingScreen phase={phase} />;
  }
  return null;
}
