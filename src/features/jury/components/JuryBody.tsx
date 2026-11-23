import type { JuryActions, JuryViewModel } from "../types";
import { ResultPanel } from "./ResultPanel";
import { VotePanel } from "./VotePanel";
import { VoteRegistered } from "./VoteRegistered";
import { WaitingScreen } from "./WaitingScreen";

interface JuryBodyProps {
  state: JuryViewModel;
  actions: JuryActions;
}

/** Elige la pantalla principal según la fase de la ronda y el envío propio. */
export function JuryBody({ state, actions }: JuryBodyProps) {
  const { screen, phase, round } = state;

  if (screen === "grading" && round !== null && phase !== null) {
    return (
      <VotePanel
        startupName={round.startupName}
        phase={phase}
        criteria={state.criteria}
        draftNotes={state.draftNotes}
        draftStatus={state.draftStatus}
        draftError={state.draftError}
        vote={state.vote}
        actions={actions}
      />
    );
  }
  if (screen === "vote_registered" && state.ownVerdict !== null) {
    return (
      <VoteRegistered
        ownVerdict={state.ownVerdict}
        criteria={state.criteria}
        votes={state.votes}
      />
    );
  }
  if (screen === "result" && state.reveal !== null) {
    return <ResultPanel reveal={state.reveal} criteria={state.criteria} />;
  }
  if (screen === "waiting" && phase !== null) {
    return <WaitingScreen phase={phase} />;
  }
  return null;
}
